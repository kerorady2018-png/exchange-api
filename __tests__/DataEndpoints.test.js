jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));

const fs = require('fs');
const axios = require('axios');
const bankHandler = require('../api/banquemisr').default;
const updateHandler = require('../api/update-data').default;
const now = Date.parse('2026-09-08T12:00:00.000Z');
const quote = overrides => ({ buy: 50, sell: 50.1, source: 'official', fetchedAt: new Date(now).toISOString(), sourceUpdatedAt: null, stale: false, ...overrides });
const response = () => {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => jest.restoreAllMocks());

function snapshot(rates) {
  fs.readFileSync.mockReturnValue(JSON.stringify({ currencies: { banqueMisrRates: rates, banqueMisrStatus: 'ok', banqueMisrSources: { official: { status: 'ok' } } } }));
}

test('bank endpoint reads shared snapshot and never calls upstream websites', async () => {
  snapshot({ USD: quote() });
  const res = response();
  await bankHandler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rates: { USD: quote() }, status: 'ok' }));
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage=300'));
  expect(axios.get).not.toHaveBeenCalled();
});

test('saved quotes retain timestamps and age into stale state', async () => {
  const saved = quote({ fetchedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() });
  snapshot({ USD: saved });
  const res = response();
  await bankHandler({ method: 'GET' }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'stale', rates: { USD: { ...saved, stale: true } } }));
});

test('expired, fabricated, inverted and undated bank quotes are not served', async () => {
  snapshot({ USD: quote({ fetchedAt: '2025-01-01T00:00:00Z' }), EUR: quote({ source: 'cbe' }), GBP: quote({ buy: 51 }), SAR: { buy: 13, sell: 14 } });
  const res = response();
  await bankHandler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rates: {}, status: 'unavailable' }));
});

test('missing or corrupt snapshot returns unavailable without scraping', async () => {
  fs.readFileSync.mockImplementation(() => { throw new Error('missing'); });
  const res = response();
  await bankHandler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(axios.get).not.toHaveBeenCalled();
});

test('bank endpoint rejects methods which could mutate data', async () => {
  const res = response();
  await bankHandler({ method: 'POST' }, res);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(fs.readFileSync).not.toHaveBeenCalled();
});

test('public update endpoint cannot trigger upstream requests or writes', async () => {
  const res = response();
  await updateHandler({ method: 'POST' }, res);
  expect(res.status).toHaveBeenCalledWith(410);
  expect(axios.get).not.toHaveBeenCalled();
});
