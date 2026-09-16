jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('fs', () => ({ readFileSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../scripts/banque-misr.cjs', () => ({ fetchBanqueMisrRates: jest.fn() }));
jest.mock('../scripts/cbeFetcher.cjs', () => ({ fetchCBERates: jest.fn() }));

const axios = require('axios');
const fs = require('fs');
const { fetchBanqueMisrRates } = require('../scripts/banque-misr.cjs');
const { fetchCBERates } = require('../scripts/cbeFetcher.cjs');
const { fetchCurrenciesData, fetchMetalsData, main } = require('../scripts/data-fetcher.cjs');

const NOW = Date.parse('2026-07-01T12:00:00Z');
const ISO = new Date(NOW).toISOString();
const OLD = new Date(NOW - 86400000).toISOString();
const quote = (buy, sell, extra = {}) => ({ buy, sell, source: 'official', sourceUpdatedAt: ISO, fetchedAt: ISO, quoteType: 'transfer', stale: false, ...extra });
const bank = (rates = {}, status = 'ok') => ({ rates, status, sources: { official: { status } } });
const globalResponse = (rates = { USD: 1, EGP: 50, EUR: 0.5 }, extra = {}) => ({ data: { rates, time_last_update_unix: NOW / 1000, ...extra } });
const previous = () => ({ currencies: { rates: { USD: 1, EGP: 49, EUR: 0.8 }, lastUpdated: OLD, status: 'ok', banqueMisrRates: { USD: quote(48, 50, { sourceUpdatedAt: OLD, fetchedAt: OLD }) } } });
const cbeResponse = (rates = {}, status = 'ok', sourceUpdatedAt = ISO) => ({ status, rates, sourceUpdatedAt, fetchedAt: ISO });
const routes = ({ global = globalResponse(), cbe = null, gold = null, silver = null } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes('open.er-api')) return global === null ? Promise.reject(new Error('unavailable')) : Promise.resolve(global);
    if (url.endsWith('XAU')) return gold === null ? Promise.reject(new Error('unavailable')) : Promise.resolve(gold);
    if (url.endsWith('XAG')) return silver === null ? Promise.reject(new Error('unavailable')) : Promise.resolve(silver);
    return Promise.reject(new Error('unavailable'));
  });
  fetchCBERates.mockResolvedValue(cbe || { status: 'unavailable', rates: {} });
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  fs.readFileSync.mockImplementation(() => { throw new Error('missing'); });
  fetchBanqueMisrRates.mockResolvedValue(bank({}, 'unavailable'));
  fetchCBERates.mockResolvedValue({ status: 'unavailable', rates: {} });
  routes();
});

afterEach(() => jest.restoreAllMocks());

test('blends original global EGP cross prices and counts the selected bank quote once', async () => {
  routes({ cbe: cbeResponse({ USD: { buy: 58, sell: 62 }, EUR: { buy: 118, sell: 122 } }) });
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(68, 72), EUR: quote(138, 142) }));
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.rates.EGP).toBeCloseTo(60);
  expect(result.rates.EUR).toBeCloseTo(0.5);
  expect(result.rates.USD).toBe(1);
  expect(result.banqueMisrRates.USD.buy).toBe(68);
  expect(result.status).toBe('ok');
  expect(result.lastUpdated).toBe(ISO);
  expect(axios.get.mock.calls.some(([url]) => url.includes('/api/banquemisr'))).toBe(false);
  expect(fetchBanqueMisrRates).toHaveBeenCalledWith({ previousRates: {}, now: NOW });
});

test('CBE is never relabeled Banque Misr and CBE failure remains optional', async () => {
  routes({ cbe: cbeResponse({ USD: { buy: 59, sell: 61 } }) });
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.rates.EGP).toBe(55);
  expect(result.banqueMisrRates).toEqual({});
  expect(result.banqueMisrStatus).toBe('unavailable');
  routes();
  const optional = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(optional.sources.cbe.status).toBe('unavailable');
  expect(optional.status).toBe('partial');
});

test('stale bank quotes remain explicitly stale but never enter averages', async () => {
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(98, 102, { stale: true, sourceUpdatedAt: OLD }) }, 'stale'));
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.rates.EGP).toBe(50);
  expect(result.banqueMisrRates.USD.stale).toBe(true);
  expect(result.banqueMisrRates.USD.sourceUpdatedAt).toBe(OLD);
});

test('invalid and inverted quotes are omitted without fabricated spreads', async () => {
  routes({ cbe: cbeResponse({ USD: { buy: 'no', sell: 60 }, EUR: { buy: 120, sell: 100 } }) });
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(60, 50), EUR: quote(Infinity, Infinity), GBP: quote(70, undefined) }));
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.rates).toEqual({ USD: 1, EGP: 50, EUR: 0.5 });
  expect(result.banqueMisrRates).toEqual({});
});

test('fresh bank USD allows available bank crosses when global is malformed', async () => {
  routes({ global: { data: { rates: { USD: 1, EGP: 'NaN', EUR: 0 } } } });
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(49, 51), EUR: quote(99, 101) }));
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.rates).toEqual({ USD: 1, EGP: 50, EUR: 0.5 });
  expect(result.sources.global.status).toBe('unavailable');
  expect(result.status).toBe('partial');
});

test('all-down cache is unchanged, capped, and never recursively blended', async () => {
  const cache = previous();
  fs.readFileSync.mockReturnValue(JSON.stringify(cache));
  routes({ global: null });
  const result = await fetchCurrenciesData({ now: NOW });
  expect(result.rates).toEqual(cache.currencies.rates);
  expect(result.status).toBe('stale');
  expect(result.lastUpdated).toBe(OLD);
  expect(result.banqueMisrRates.USD.stale).toBe(true);
  expect(fetchBanqueMisrRates).toHaveBeenCalledWith({ previousRates: cache.currencies.banqueMisrRates, now: NOW });
  const again = await fetchCurrenciesData({ previousSnapshot: { currencies: result }, now: NOW + 1000 });
  expect(again.rates).toEqual(result.rates);
  expect(again.lastUpdated).toBe(OLD);
});

test.each([undefined, new Date(NOW - 8 * 86400000).toISOString()])('rejects unverified or expired cache timestamp %s', async (lastUpdated) => {
  routes({ global: null });
  const cache = previous();
  cache.currencies.lastUpdated = lastUpdated;
  await expect(fetchCurrenciesData({ previousSnapshot: cache, now: NOW })).rejects.toThrow();
});

test('expired upstream data and malformed cache cannot become live', async () => {
  routes({ global: globalResponse(undefined, { time_last_update_unix: (NOW - 8 * 86400000) / 1000 }) });
  const cache = previous();
  cache.currencies.rates.EGP = -1;
  await expect(fetchCurrenciesData({ previousSnapshot: cache, now: NOW })).rejects.toThrow();
});

test('missing live metals never produce static 2600/30 defaults', async () => {
  await expect(fetchMetalsData({ previousSnapshot: null, now: NOW })).rejects.toThrow();
  const result = await main({ previousSnapshot: null, now: NOW });
  expect(result.metals).toBeUndefined();
  expect(result.calculatedRates).toEqual({});
  expect(result.currencies.rates.XAU_24).toBeUndefined();
  expect(result.status).toBe('partial');
});

test('unavailable metals preserve the valid previous section and timestamp as stale', async () => {
  const cache = previous();
  cache.metals = { goldData: { price_gram_24k: 100, price_gram_21k: 87.5, price_gram_18k: 75, price_ounce: 3110.35 }, silverData: { price_gram: 1, price_ounce: 31.1035 }, lastUpdated: OLD, status: 'ok' };
  cache.calculatedRates = { XAU_24: 100, XAU_21: 87.5, XAU_18: 75, XAG_GRAM: 1 };
  const result = await main({ previousSnapshot: cache, now: NOW });
  expect(result.metals).toEqual({ ...cache.metals, status: 'stale' });
  expect(result.calculatedRates).toEqual(cache.calculatedRates);
  expect(result.currencies.rates.XAU_24).toBeUndefined();
  const metadata = JSON.parse(fs.writeFileSync.mock.calls[1][1]);
  expect(metadata.lastMetalsUpdate).toBe(OLD);
  expect(metadata.status).toBe('partial');
});

test('main persists actual bank quotes and source times with fresh metals schema', async () => {
  routes({ gold: { data: { price: 3110.35, updatedAt: OLD } }, silver: { data: { price: 31.1035, updatedAt: OLD } } });
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(49, 51) }));
  const result = await main({ previousSnapshot: null, now: NOW });
  expect(result.metals.goldData.price_gram_24k).toBeCloseTo(100);
  expect(result.metals.silverData.price_gram).toBeCloseTo(1);
  expect(result.metals.lastUpdated).toBe(OLD);
  expect(result.calculatedRates.XAU_21).toBeCloseTo(87.5);
  expect(JSON.parse(fs.writeFileSync.mock.calls[0][1]).currencies.banqueMisrRates.USD.sourceUpdatedAt).toBe(ISO);
});

test('starts global, CBE and the direct bank module before awaiting any source', async () => {
  let finishGlobal;
  axios.get.mockImplementation((url) => url.includes('open.er-api') ? new Promise((resolve) => { finishGlobal = resolve; }) : Promise.reject(new Error('404')));
  fetchCBERates.mockResolvedValue({ status: 'unavailable', rates: {} });
  const pending = fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(fetchCBERates).toHaveBeenCalledTimes(1);
  expect(fetchBanqueMisrRates).toHaveBeenCalledTimes(1);
  finishGlobal(globalResponse());
  await expect(pending).resolves.toMatchObject({ status: 'partial' });
});

test('cache does not influence a fresh global average, and unknown bank origins are rejected', async () => {
  const cache = previous();
  cache.currencies.rates.EGP = 90;
  cache.currencies.banqueMisrRates = {};
  fetchBanqueMisrRates.mockResolvedValue(bank({ USD: quote(99, 101, { source: 'cbe' }) }));
  const result = await fetchCurrenciesData({ previousSnapshot: cache, now: NOW });
  expect(result.rates.EGP).toBe(50);
  expect(result.rates.EUR).toBe(0.5);
  expect(result.banqueMisrRates).toEqual({});
});

test('unavailable source metadata retains original source times without refreshing them', async () => {
  const cache = previous();
  cache.currencies.sources = { global: { status: 'ok', sourceUpdatedAt: OLD, fetchedAt: OLD } };
  routes({ global: null });
  const result = await fetchCurrenciesData({ previousSnapshot: cache, now: NOW });
  expect(result.sources.global).toEqual({ status: 'unavailable', sourceUpdatedAt: OLD, fetchedAt: OLD, checkedAt: ISO });
});

test('omits expired or timestamp-free bank quotes even if marked fresh', async () => {
  fetchBanqueMisrRates.mockResolvedValue(bank({
    USD: quote(99, 101, { sourceUpdatedAt: new Date(NOW - 8 * 86400000).toISOString() }),
    EUR: quote(99, 101, { sourceUpdatedAt: null, fetchedAt: null })
  }));
  const result = await fetchCurrenciesData({ previousSnapshot: null, now: NOW });
  expect(result.banqueMisrRates).toEqual({});
  expect(result.rates.EGP).toBe(50);
});

test('one failed metal uses its cache without discarding the other live metal', async () => {
  const cache = previous();
  cache.metals = { goldData: { price_gram_24k: 90, price_gram_21k: 78.75, price_gram_18k: 67.5, price_ounce: 2799.315 }, silverData: { price_gram: 1, price_ounce: 31.1035 }, lastUpdated: OLD, status: 'ok' };
  routes({ gold: { data: { price: 3110.35 } } });
  const result = await main({ previousSnapshot: cache, now: NOW });
  expect(result.metals.goldData.price_ounce).toBe(3110.35);
  expect(result.metals.silverData.price_ounce).toBe(31.1035);
  expect(result.metals.silverData.stale).toBe(true);
  expect(result.metals.lastUpdated).toBe(OLD);
  expect(result.metals.status).toBe('partial');
  expect(result.currencies.rates.XAG_GRAM).toBeUndefined();
});

test('partial metals contain only actual successful quotes', async () => {
  routes({ gold: { data: { price: 3110.35 } }, silver: { data: { price: -30 } } });
  const result = await main({ previousSnapshot: null, now: NOW });
  expect(result.metals.status).toBe('partial');
  expect(result.metals.silverData).toBeUndefined();
  expect(result.calculatedRates.XAG_GRAM).toBeUndefined();
  expect(result.calculatedRates.XAU_24).toBeCloseTo(100);
});

test('main rejects no usable FX and propagates write failures without process.exit', async () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  routes({ global: null });
  await expect(main({ previousSnapshot: null, now: NOW })).rejects.toThrow();
  expect(exit).not.toHaveBeenCalled();
  routes();
  fs.writeFileSync.mockImplementation(() => { throw new Error('disk full'); });
  await expect(main({ previousSnapshot: null, now: NOW })).rejects.toThrow('disk full');
  expect(exit).not.toHaveBeenCalled();
});
