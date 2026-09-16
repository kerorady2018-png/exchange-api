jest.mock('axios', () => ({ create: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const TTL = 30 * 60 * 1000;
const sourceTime = '2025-01-01T00:00:00.000Z';
const snapshot = () => ({
  currencies: { rates: { USD: 1, EGP: 50, EUR: 0.9 }, banqueMisrRates: {} },
  metals: { goldData: { price_ounce: 2400 }, silverData: { price_ounce: 30 } },
  lastUpdated: sourceTime,
});

let storage;
let client;
let currencies;
let metals;
let values;
let clock;

function load() {
  storage = require('@react-native-async-storage/async-storage');
  storage.getItem.mockImplementation(async key => values.get(key) || null);
  storage.setItem.mockImplementation(async (key, value) => { values.set(key, value); });
  client = require('../src/api/apiConfig').apiClient;
  currencies = require('../src/services/currenciesCoreData').getCurrenciesData;
  metals = require('../src/services/FinalMetalData').getMetalsData;
}

beforeEach(() => {
  jest.resetModules();
  values = new Map();
  clock = Date.parse('2025-01-02T00:00:00.000Z');
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  load();
  client.get.mockResolvedValue({ data: snapshot() });
});

afterEach(() => { jest.restoreAllMocks(); });

test('cold currency and metal readers coalesce into one request', async () => {
  const [fx, metal] = await Promise.all([currencies(), metals('EGP'), currencies(true), metals('USD', {}, true)]);
  expect(client.get).toHaveBeenCalledTimes(1);
  expect(fx.rates.EGP).toBe(50);
  expect(metal.XAU_24.price).toBeGreaterThan(0);
});

test('force and sequential readers share the thirty minute TTL', async () => {
  await currencies();
  clock += 16 * 60 * 1000;
  await metals('USD', {}, true);
  await currencies(true);
  expect(client.get).toHaveBeenCalledTimes(1);
  clock += 14 * 60 * 1000;
  await currencies(true);
  expect(client.get).toHaveBeenCalledTimes(2);
});

test('persisted raw snapshot is shared after module reload', async () => {
  await currencies();
  jest.resetModules();
  load();
  const result = await metals('USD', {}, true);
  expect(client.get).not.toHaveBeenCalled();
  expect(result.XAU_OUNCE.price).toBe(2400);
});

test.each([{}, { currencies: {} }, { currencies: { rates: { USD: 1 } } }, { currencies: { rates: { EGP: 0, EUR: 'bad' } } }])('invalid response never advances freshness: %p', async payload => {
  client.get.mockResolvedValueOnce({ data: payload });
  const failed = await currencies();
  expect(failed._isFallback).toBe(true);
  expect(failed.rates).toEqual({});
  expect(failed.banqueMisrRates).toEqual({});
  expect(values.has('@last_static_file_request')).toBe(false);
  const recovered = await currencies();
  expect(recovered.rates.EGP).toBe(50);
  expect(client.get).toHaveBeenCalledTimes(2);
});

test('rejected request is cleared and retried on the next caller', async () => {
  client.get.mockRejectedValueOnce({ message: 'Unavailable', response: { status: 401 } });
  const failed = await currencies();
  expect(failed._isFallback).toBe(true);
  expect(values.has('@last_static_file_request')).toBe(false);
  expect((await currencies()).rates.EGP).toBe(50);
  expect(client.get).toHaveBeenCalledTimes(2);
});

test('storage write failure never discards successful currency or metal data', async () => {
  storage.setItem.mockRejectedValue(new Error('disk full'));
  const fx = await currencies();
  const metal = await metals('USD');
  expect(fx.rates.EGP).toBe(50);
  expect(fx._isFallback).not.toBe(true);
  expect(metal.XAU_OUNCE.price).toBe(2400);
  expect(metal._isFallback).not.toBe(true);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('malformed legacy caches do not block fresh data', async () => {
  values.set('@core_bm_rates_data', '{');
  values.set('@core_currencies_data', '[]');
  values.set('@cached_metals_data_v3', '{');
  values.set('@static_data_snapshot_v1', '{');
  expect((await currencies()).rates.EGP).toBe(50);
  expect((await metals('USD')).XAU_OUNCE.price).toBe(2400);
});

test('storage read failure does not prevent a network fetch', async () => {
  storage.getItem.mockRejectedValue(new Error('storage unavailable'));
  expect((await currencies()).rates.EGP).toBe(50);
  expect((await metals('USD')).XAU_OUNCE.price).toBe(2400);
});

test('metal calculations follow requested base and current forex even inside TTL', async () => {
  const egp = await metals('EGP');
  const usd = await metals('USD');
  const eur = await metals('EUR', { EUR: 0.8 });
  expect(egp.XAU_OUNCE.price).toBe(120000);
  expect(usd.XAU_OUNCE.price).toBe(2400);
  expect(eur.XAU_OUNCE.price).toBe(1920);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('expired successful snapshot survives network failure with original freshness', async () => {
  const original = await metals('USD');
  clock += TTL;
  client.get.mockRejectedValue({ message: 'Unavailable', response: { status: 401 } });
  const fallback = await metals('USD');
  expect(fallback.XAU_OUNCE.price).toBe(original.XAU_OUNCE.price);
  expect(fallback._isFallback).toBe(true);
  expect(fallback._lastUpdated).toBe(Date.parse(sourceTime));
  expect(fallback._fetchedAt).toBe(original._fetchedAt);
});

test('zero metal aggregate cannot replace a valid currency-scoped fallback', async () => {
  const original = await metals('USD');
  clock += TTL;
  client.get.mockResolvedValue({ data: { currencies: snapshot().currencies, metals: {} } });
  const fallback = await metals('USD', {}, true);
  expect(fallback.XAU_24.price).toBe(original.XAU_24.price);
  expect(fallback._isFallback).toBe(true);
  const unknown = await metals('JPY', {}, true);
  expect(unknown._isFallback).toBe(true);
  expect(unknown.XAU_24).toBeUndefined();
});

test('source freshness and absent bank quotes are not fabricated', async () => {
  const fx = await currencies();
  const metal = await metals('USD');
  expect(fx.banqueMisrRates).toEqual({});
  expect(fx._lastUpdated).toBe(Date.parse(sourceTime));
  expect(metal._lastUpdated).toBe(Date.parse(sourceTime));
});

test.each([null, {}, [], { payload: {}, fetchedAt: 1 }, { payload: snapshot(), fetchedAt: 'bad' }])('empty or invalid persisted snapshot is ignored: %p', async cached => {
  values.set('@static_data_snapshot_v1', JSON.stringify(cached));
  const result = await currencies();
  expect(result.rates.EGP).toBe(50);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('valid legacy bank quotes survive a response without bank quotes and are marked stale', async () => {
  const bank = { USD: { buy: 49.5, sell: 50 } };
  values.set('@core_bm_rates_data', JSON.stringify(bank));
  const result = await currencies();
  expect(result.banqueMisrRates).toEqual(bank);
  expect(result._bmIsFallback).toBe(true);
});

test('missing source timestamp is not replaced with the device clock', async () => {
  const payload = snapshot();
  delete payload.lastUpdated;
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx._lastUpdated).toBeNull();
  expect(fx._fetchedAt).toBe(clock);
});

test('nested API response is normalized once for both consumers', async () => {
  client.get.mockResolvedValue({ data: { success: true, data: snapshot() } });
  const [fx, metal] = await Promise.all([currencies(), metals('USD')]);
  expect(fx.rates.EGP).toBe(50);
  expect(metal.XAU_OUNCE.price).toBe(2400);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('unknown base never reuses another currency fallback after restart', async () => {
  await metals('EGP');
  clock += TTL;
  jest.resetModules();
  load();
  client.get.mockRejectedValue({ message: 'Unavailable', response: { status: 401 } });
  const usd = await metals('USD');
  expect(usd.XAU_OUNCE.price).toBe(2400);
  expect(usd._isFallback).toBe(true);
  const missing = await metals('JPY');
  expect(missing.XAU_24).toBeUndefined();
  expect(missing._isFallback).toBe(true);
});

test('a stopped scheduled update is not displayed as live merely because HTTP succeeds', async () => {
  const payload = snapshot();
  payload.checkedAt = sourceTime;
  client.get.mockResolvedValue({ data: payload });
  expect((await currencies())._isFallback).toBe(true);
});

test('stale metals preserve their section timestamp after a fresh currency update', async () => {
  const payload = snapshot();
  payload.lastUpdated = '2025-01-02T00:00:00.000Z';
  payload.metals.lastUpdated = sourceTime;
  payload.metals.status = 'stale';
  client.get.mockResolvedValue({ data: payload });
  const result = await metals('USD');
  expect(result._isFallback).toBe(true);
  expect(result._lastUpdated).toBe(Date.parse(sourceTime));
});

test('bank source metadata survives the snapshot and stale bank data is flagged', async () => {
  const payload = snapshot();
  payload.currencies.banqueMisrRates = { USD: { buy: 49, sell: 50, source: 'banquemisr', fetchedAt: sourceTime, stale: true } };
  payload.currencies.banqueMisrStatus = 'stale';
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx.banqueMisrRates.USD.source).toBe('banquemisr');
  expect(fx.banqueMisrRates.USD.fetchedAt).toBe(sourceTime);
  expect(fx._bmIsFallback).toBe(true);
});

test('authoritative unavailability can retain recent verified device quotes without renewing their time', async () => {
  const bank = { USD: { buy: 49, sell: 50, source: 'official', fetchedAt: sourceTime, stale: false } };
  values.set('@core_bm_rates_data', JSON.stringify(bank));
  const payload = snapshot();
  payload.currencies.banqueMisrStatus = 'unavailable';
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx.banqueMisrRates.USD).toEqual({ ...bank.USD, stale: true });
  expect(fx._bmIsFallback).toBe(true);
});

test('a single stale bank currency does not mark all other currency quotes stale', async () => {
  const payload = snapshot();
  payload.currencies.banqueMisrStatus = 'partial';
  payload.currencies.banqueMisrRates = {
    USD: { buy: 49, sell: 50, stale: false },
    EUR: { buy: 59, sell: 60, stale: true }
  };
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx._bmIsFallback).toBe(false);
  expect(fx.banqueMisrRates.EUR.stale).toBe(true);
});

test('authoritative bank unavailability clears old local quotes rather than resurrecting them', async () => {
  values.set('@core_bm_rates_data', JSON.stringify({ USD: { buy: 49, sell: 50 } }));
  const payload = snapshot();
  payload.currencies.banqueMisrStatus = 'unavailable';
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx.banqueMisrRates).toEqual({});
  expect(JSON.parse(values.get('@core_bm_rates_data'))).toEqual({});
});

test('server-stale forex keeps its own timestamp even when bank quotes were just refreshed', async () => {
  const payload = snapshot();
  payload.lastUpdated = '2025-01-02T00:00:00.000Z';
  payload.currencies.lastUpdated = sourceTime;
  payload.currencies.status = 'stale';
  client.get.mockResolvedValue({ data: payload });
  const fx = await currencies();
  expect(fx._isFallback).toBe(true);
  expect(fx._lastUpdated).toBe(Date.parse(sourceTime));
});

test('bank validation rejects inverted prices and expires timestamped quotes', () => {
  const { validBankRates } = require('../src/api/apiConfig');
  expect(validBankRates({ USD: { buy: 51, sell: 50 }, EUR: { buy: 50, sell: 51, fetchedAt: '2024-01-01T00:00:00.000Z' } })).toEqual({});
});

test('default network retry budget is one bounded attempt', async () => {
  const { withRetry } = require('../src/utils/networkUtils');
  const request = jest.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue('unexpected retry');
  await expect(withRetry(request)).rejects.toThrow('Network Error');
  expect(request).toHaveBeenCalledTimes(1);
});

test('explicit retry budget still supports transient recovery', async () => {
  const { withRetry } = require('../src/utils/networkUtils');
  const request = jest.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue('recovered');
  await expect(withRetry(request, 2, 0)).resolves.toBe('recovered');
  expect(request).toHaveBeenCalledTimes(2);
});
