jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const {
  fetchBanqueMisrRates,
  parseOfficialRates,
  parse3omllaRates,
  parseBankliveRates,
  SOURCE_URLS,
  CODES,
  MAX_AGE_MS,
  REQUEST_TIMEOUT_MS,
  MAX_HTML_BYTES,
} = require('../scripts/banque-misr.cjs');

const NOW = Date.parse('2026-06-16T12:00:00.000Z');
const ISO_NOW = new Date(NOW).toISOString();
const page = content => `<html><head><title>Banque Misr Exchange Rates</title></head><body><h1>Banque Misr</h1>${content}</body></html>`;
const cells = values => `<tr>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
const officialTable = (rows, timestamp = '') => `<table><thead><tr class="first-row"><td rowspan="2">Currency</td><td colspan="2">Notes</td><td colspan="2">Transfer</td></tr><tr class="second-row"><td class="border-width">Buy</td><td>Sell</td><td class="border-width">Buy</td><td>Sell</td></tr></thead><tbody>${rows.map(cells).join('')}</tbody>${timestamp ? `<caption>Last updated <time datetime="${timestamp}">${timestamp}</time></caption>` : ''}</table>`;
const mirrorTable = (rows, timestamp = '') => `<table class="w-full"><thead><tr><th>Currency</th><th>Buy</th><th>Sell</th><th>Spread</th></tr></thead><tbody>${rows.map(([label, buy, sell]) => cells([`<div><span></span><div><div class="font-medium">${label}</div><div>${label === 'USD' ? 'US Dollar' : label}</div></div></div>`, `<div class="rate-number text-lg">${buy}</div><div class="text-xs text-muted-foreground">EGP</div>`, `<div class="rate-number text-lg">${sell}</div><div>EGP</div>`, '<span class="text-sm text-muted-foreground rate-number">0.1000</span>'])).join('')}</tbody>${timestamp ? `<caption>Last updated <time datetime="${timestamp}">${timestamp}</time></caption>` : ''}</table>`;
const bankliveTable = (rows, timestamp = '') => `<table class="banklive-tablse table table-hover text-center"><thead><tr><th>Currency</th><th>Buying Price</th><th>Selling Price</th></tr></thead><tbody>${rows.map(([code, buy, sell, bank = 'banque-misr']) => cells([`<a href="https://banklive.net/en/currency/${bank}/${code.toLowerCase()}-to-egp"><div class="info"><img><span class="code">${code}EGP</span></div><span class="currencyName">${code === 'USD' ? 'Us Dollar' : code}</span></a>`, `<span class="bankRate">${buy}</span><span class="small">EGP</span><div class="rate-change ltr fs-6 my-2"><i></i>0.02%</div>`, `<span class="bankRate">${sell}</span><span class="small">EGP</span><div>0.02%</div>`])).join('')}</tbody>${timestamp ? `<caption>Last updated <time datetime="${timestamp}">${timestamp}</time></caption>` : ''}</table>`;
const official = (rows = [['US Dollar', '50', '50.1', '49.9', '50.2']], time = '') => `<html><head><title>Banquemisr - Exchange rate and currencies</title></head><body><h1>Exchange rate and currencies</h1>${officialTable(rows, time)}</body></html>`;
const fullOfficial = () => official(CODES.map(code => {
  const label = code === 'JPY' ? '100 Japan Yen' : code;
  return [label, '50', '51', '49', '52'];
}));
const mirror = (rows = [['USD', '49.9', '50.2']], time = '') => `<html><head><title>Banque Misr Exchange Rates Today | 3omlla</title></head><body><h1>Banque Misr</h1>${mirrorTable(rows, time)}</body></html>`;
const banklive = (rows = [['USD', '49.9', '50.2']], time = '') => `<html><head><title>Exchange Rates in Banque Misr | BankLive</title></head><body>${bankliveTable(rows, time)}</body></html>`;
const previousQuote = overrides => ({
  buy: 49,
  sell: 49.5,
  source: 'official',
  fetchedAt: '2026-06-15T10:00:00.000Z',
  sourceUpdatedAt: null,
  quoteType: 'cash',
  stale: false,
  ...overrides,
});

function serve(pages) {
  axios.get.mockImplementation(async url => {
    const source = Object.keys(SOURCE_URLS).find(key => SOURCE_URLS[key] === url);
    if (!pages[source]) throw new Error('network unavailable');
    return { status: 200, data: pages[source] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockReset();
});

describe('table-scoped Banque Misr parsers', () => {
  test('verified official markup handles compact bank title, flag images and transfer-only currencies', () => {
    const html = official([
      ['<img class="img-flag" src="/-/media/flags/usd.ashx"><br>US Dollar', '50.97', '51.07', '50.97', '51.07'],
      ['Yuan', '0', '0', '7.594427', '7.614206'],
      ['Norway Krone', '0', '0', '5.495062', '5.524067'],
      ['indian rupee', '0', '0', '.537134', '.540309'],
      ['100 Japan Yen', '33.0095', '33.4009', '33.00952', '33.400916'],
    ]).replace('</body>', '<p>Last update 16 June 2026 12:30</p></body>');
    const result = parseOfficialRates(html);
    expect(result.USD).toMatchObject({ buy: 50.97, sell: 51.07, quoteType: 'cash', sourceUpdatedAt: null });
    expect(result.CNY).toMatchObject({ buy: 7.594427, sell: 7.614206, quoteType: 'transfer' });
    expect(result.NOK).toMatchObject({ buy: 5.495062, sell: 5.524067, quoteType: 'transfer' });
    expect(result.INR).toMatchObject({ buy: 0.537134, sell: 0.540309, quoteType: 'transfer' });
    expect(result.JPY.buy).toBeCloseTo(0.330095, 8);
    expect(result.JPY.sell).toBeCloseTo(0.334009, 8);
  });

  test('verified 3omlla cells select rate-number and not EGP or the Spread column', () => {
    const result = parse3omllaRates(mirror([['USD', '50.8700', '50.9700']]));
    expect(result).toEqual({ USD: { buy: 50.87, sell: 50.97, quoteType: 'unknown', sourceUpdatedAt: null } });
    expect(result.JPY).toBeUndefined();
  });

  test('verified Banklive cells select bankRate, validate the bank link and ignore page dates', () => {
    const html = banklive([['USD', '50.94', '51.04']])
      .replace('</body>', '<p>Today <time datetime="2026-06-16T12:00:00Z">16 June</time></p></body>');
    expect(parseBankliveRates(html)).toEqual({ USD: { buy: 50.94, sell: 51.04, quoteType: 'unknown', sourceUpdatedAt: null } });
    const codeOnly = html.replace('>Us Dollar<', '>Currency name<');
    expect(parseBankliveRates(codeOnly).USD.buy).toBe(50.94);
  });

  test('Banklive rejects other-bank rows despite a Banque Misr page title', () => {
    expect(() => parseBankliveRates(banklive([['USD', '999', '1000', 'national-bank-of-egypt']]))).toThrow();
    const result = parseBankliveRates(banklive([
      ['USD', '999', '1000', 'national-bank-of-egypt'],
      ['EUR', '55', '56'],
    ]));
    expect(result.USD).toBeUndefined();
    expect(result.EUR.buy).toBe(55);
  });

  test.each([
    ['https://banklive.net/en/currency/banque-misr/usd-to-egp', 'https://example.com/en/currency/banque-misr/usd-to-egp'],
    ['/banque-misr/usd-to-egp', '/banque-misr/eur-to-egp'],
    ['/banque-misr/usd-to-egp', '/banque-misr-fake/usd-to-egp'],
  ])('Banklive rejects mismatched link provenance', (oldValue, newValue) => {
    expect(() => parseBankliveRates(banklive().replace(oldValue, newValue))).toThrow();
  });

  test.each([
    [parse3omllaRates, mirror, 'rate-number text-lg'],
    [parseBankliveRates, banklive, 'bankRate'],
  ])('mirror parsers fail closed if dedicated price nodes disappear', (parser, fixture, priceClass) => {
    expect(() => parser(fixture().split(priceClass).join('advertisement-price'))).toThrow();
  });

  test('official grouped Notes/Transfer headers prefer cash and normalize 100 Japan Yen', () => {
    const result = parseOfficialRates(official([
      ['US Dollar', '50.0000', '50.1000', '49', '51'],
      ['100 Japan Yen', '31.25', '31.75', '31', '32'],
      ['Australian Dollar', '0', '0', '32.2', '32.6'],
    ]));
    expect(result.USD).toEqual({ buy: 50, sell: 50.1, quoteType: 'cash', sourceUpdatedAt: null });
    expect(result.JPY).toEqual({ buy: 0.3125, sell: 0.3175, quoteType: 'cash', sourceUpdatedAt: null });
    expect(result.AUD).toEqual({ buy: 32.2, sell: 32.6, quoteType: 'transfer', sourceUpdatedAt: null });
  });

  test.each([['3omlla', parse3omllaRates, mirror], ['banklive', parseBankliveRates, banklive]])('%s keeps per-unit JPY if present and excludes EGP and percentage suffixes', (_, parser, fixture) => {
    const result = parser(fixture([
      ['USD', '<strong>50.12</strong>', '50.22'],
      ['JPY', '0.3125', '0.3175'],
    ]));
    expect(result.USD.buy).toBe(50.12);
    expect(result.JPY).toEqual({ buy: 0.3125, sell: 0.3175, quoteType: 'unknown', sourceUpdatedAt: null });
  });

  test('ignores script prices, advertisements and comparison tables with bank columns', () => {
    const unrelated = '<script>const rates = {"USD": {"buy":999,"sell":999}}</script><table><tr><th>Bank</th><th>Currency</th><th>Buy</th><th>Sell</th></tr><tr><td>Other bank</td><td>USD</td><td>999</td><td>1000</td></tr></table><div>USD Buy 888 Sell 889</div>';
    expect(parse3omllaRates(page(unrelated + mirrorTable([['USD', '50', '51']]))).USD.buy).toBe(50);
  });

  test('does not silently pick a conflicting duplicate table', () => {
    expect(() => parse3omllaRates(page(mirrorTable([['USD', '50', '51']]) + mirrorTable([['USD', '100', '101']])))).toThrow();
  });

  test.each(['', '<html>Access denied</html>', '<h1>Other Bank</h1><table><tr><th>Currency</th><th>Buy</th><th>Sell</th></tr><tr><td>USD</td><td>50</td><td>51</td></tr></table>', page('<div>USD 50 51</div>')])('rejects empty, non-bank and non-table content', html => {
    expect(() => parseOfficialRates(html)).toThrow();
    expect(() => parse3omllaRates(html)).toThrow();
    expect(() => parseBankliveRates(html)).toThrow();
  });

  test.each([['0', '50'], ['50', '0'], ['51', '50'], ['NaN', '50'], ['Infinity', '51'], ['-2', '3'], ['', '51'], ['50junk', '51'], ['1,2', '51'], ['1e2', '101']])('rejects invalid price pair %s / %s', (buy, sell) => {
    expect(() => parse3omllaRates(mirror([['USD', buy, sell]]))).toThrow();
  });

  test('rejects inverted cash rather than concealing corruption with transfer values', () => {
    expect(() => parseOfficialRates(official([['USD', '51', '50', '49', '50']]))).toThrow();
  });

  test('supports missing cash and properly grouped thousands', () => {
    const result = parseOfficialRates(official([['Kuwaiti Dinar', '-', '-', '1,234.50', '1,235.75']]));
    expect(result.KWD).toMatchObject({ buy: 1234.5, sell: 1235.75, quoteType: 'transfer' });
  });

  test('only accepts an explicit timezone-qualified timestamp in the rates table', () => {
    expect(parse3omllaRates(mirror(undefined, '2026-06-16T13:30:00+03:00')).USD.sourceUpdatedAt).toBe('2026-06-16T10:30:00.000Z');
    expect(parse3omllaRates(mirror(undefined, '2026-06-16T13:30:00')).USD.sourceUpdatedAt).toBeNull();
    expect(parse3omllaRates(page('<time datetime="2026-06-16T11:00:00Z">Advertisement updated</time>' + mirrorTable([['USD', '50', '51']]))).USD.sourceUpdatedAt).toBeNull();
  });
});

describe('official-first fetching with lazy fallback mirrors', () => {
  test('fetches only official when it covers all tracked currencies', async () => {
    serve({ official: fullOfficial() });
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
    expect(result.sources.official.status).toBe('ok');
    expect(result.sources.banklive.status).toBe('skipped');
    expect(result.sources['3omlla'].status).toBe('skipped');
    expect(result.rates.USD).toMatchObject({ source: 'official' });
  });

  test('falls back to banklive and 3omlla only for missing currencies', async () => {
    serve({
      official: official(),
      banklive: banklive([['EUR', '55', '56'], ['JPY', '0.3125', '0.3175']]),
      '3omlla': mirror([['SAR', '13', '13.1']]),
    });
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(result.rates.USD).toMatchObject({ source: 'official', buy: 50, sell: 50.1 });
    expect(result.rates.EUR).toMatchObject({ source: 'banklive', buy: 55, sell: 56 });
    expect(result.rates.JPY).toMatchObject({ source: 'banklive' });
    expect(result.rates.SAR).toMatchObject({ source: '3omlla', buy: 13, sell: 13.1 });
    expect(result.status).toBe('partial');
  });

  test('uses banklive before 3omlla when both can fill a currency', async () => {
    serve({
      official: official(),
      banklive: banklive([['EUR', '55', '56']]),
      '3omlla': mirror([['EUR', '54', '57']]),
    });
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(result.rates.EUR).toMatchObject({ source: 'banklive' });
  });

  test('fetches mirrors when official fails entirely', async () => {
    serve({
      official: page('<p>Maintenance</p>'),
      banklive: banklive(),
      '3omlla': mirror(),
    });
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(result.status).toBe('partial');
    expect(result.sources.official.status).toBe('unavailable');
    expect(result.rates.USD).toMatchObject({ source: 'banklive', buy: 49.9, sell: 50.2 });
  });

  test('all down keeps original quote timestamps, marks stale, and does not mutate history', async () => {
    serve({});
    const original = previousQuote({ sourceUpdatedAt: '2026-06-15T09:00:00.000Z' });
    const result = await fetchBanqueMisrRates({ previousRates: { USD: original }, now: NOW });
    expect(result.status).toBe('stale');
    expect(result.rates.USD).toEqual({ ...original, stale: true });
    expect(original.stale).toBe(false);
    expect(Object.values(result.sources).every(source => source.status === 'unavailable')).toBe(true);
  });

  test('missing currencies carry last-good quotes even while another currency refreshes', async () => {
    serve({ official: official() });
    const original = previousQuote({ buy: 55, sell: 56 });
    const result = await fetchBanqueMisrRates({ previousRates: { EUR: original }, now: NOW });
    expect(result.status).toBe('partial');
    expect(result.rates.USD.stale).toBe(false);
    expect(result.rates.EUR).toEqual({ ...original, stale: true });
  });

  test('expires source-dated quotes without refreshing their age using later fetch times', async () => {
    serve({});
    const result = await fetchBanqueMisrRates({
      now: NOW,
      previousRates: {
        USD: previousQuote({ sourceUpdatedAt: new Date(NOW - MAX_AGE_MS - 1).toISOString(), fetchedAt: ISO_NOW }),
        EUR: previousQuote({ fetchedAt: new Date(NOW - MAX_AGE_MS - 1).toISOString() }),
        GBP: { buy: 60, sell: 61 },
        CHF: previousQuote({ fetchedAt: 'invalid' }),
        CAD: previousQuote({ fetchedAt: new Date(NOW + 1000).toISOString() }),
      },
    });
    expect(result).toMatchObject({ status: 'unavailable', rates: {} });
  });

  test('seven-day boundary is inclusive and repeated failures do not extend it', async () => {
    serve({});
    const previous = previousQuote({ fetchedAt: new Date(NOW - MAX_AGE_MS).toISOString() });
    const first = await fetchBanqueMisrRates({ now: NOW, previousRates: { USD: previous } });
    expect(first.status).toBe('stale');
    const next = await fetchBanqueMisrRates({ now: NOW + 1, previousRates: first.rates });
    expect(next.status).toBe('unavailable');
    expect(next.rates).toEqual({});
  });

  test('expired or future source-dated HTML cannot appear fresh just because it was fetched now', async () => {
    serve({ official: official(undefined, '2026-06-01T00:00:00Z'), '3omlla': mirror(undefined, '2026-06-17T00:00:00Z') });
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(result.status).toBe('unavailable');
    expect(result.rates).toEqual({});
  });

  test('timeouts make no retries or fabricated quotes', async () => {
    axios.get.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    const result = await fetchBanqueMisrRates({ now: NOW });
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(result.rates).toEqual({});
    expect(result.status).toBe('unavailable');
    expect(Object.values(result.sources).every(source => source.error === 'timeout')).toBe(true);
  });

  test('invalid previous values or provenance are not carried forward', async () => {
    serve({});
    const result = await fetchBanqueMisrRates({ now: NOW, previousRates: {
      USD: previousQuote({ buy: 0 }),
      EUR: previousQuote({ buy: 60, sell: 50 }),
      GBP: previousQuote({ source: 'other-bank' }),
      CHF: previousQuote({ sell: Infinity }),
      JPY: previousQuote({ buy: '0.31', sell: '0.32' }),
    } });
    expect(result.rates).toEqual({});
  });
});
