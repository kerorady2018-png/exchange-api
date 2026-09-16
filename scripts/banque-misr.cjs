const axios = require('axios');
const { parse } = require('parse5');
const { URL } = require('node:url');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const CURRENCY_NAMES = {
  USD: /\b(?:us|u\.?s\.?|american) dollar\b|دولار امريكي/,
  EUR: /\beuro\b|يورو/,
  GBP: /\b(?:pound sterling|sterling pound|british pound)\b|جنيه استرليني/,
  CHF: /\bswiss franc\b|فرنك سويسري/,
  JPY: /\b(?:japan(?:ese)? yen)\b|ين ياباني/,
  CAD: /\bcanadian dollar\b|دولار كندي/,
  AUD: /\baustralian dollar\b|دولار استرالي/,
  DKK: /\bdanish kron[ea]\b|كرون(?:ه)? دانمركي/,
  NOK: /\b(?:norwegian|norway) kron[ea]\b|كرون(?:ه)? نرويجي/,
  SEK: /\bswedish kron[ea]\b|كرون(?:ه)? سويدي/,
  SAR: /\bsaudi riyal\b|ريال سعودي/,
  AED: /\b(?:uae|u\.a\.e\.?|emirati|united arab emirates) dirham\b|درهم اماراتي/,
  KWD: /\bkuwaiti? dinar\b|دينار كويتي/,
  QAR: /\bqatar(?:i)? riyal\b|ريال قطري/,
  BHD: /\bbahrain(?:i)? dinar\b|دينار بحريني/,
  OMR: /\boman(?:i)? ri[ay]l\b|\boman(?:i)? riyal\b|ريال عماني/,
  JOD: /\bjordan(?:ian)? dinar\b|دينار اردني/,
  CNY: /\b(?:(?:chinese|china) )?yuan(?: renminbi)?\b|يوان صيني/,
  INR: /\bindian rupee\b|روبيه هندي/,
};
const CODES = Object.keys(CURRENCY_NAMES);
const SOURCE_URLS = Object.freeze({
  official: 'https://www.banquemisr.com/Home/CAPITAL%20MARKETS/Exchange%20Rates%20and%20Currencies',
  '3omlla': 'https://3omlla.com/en/banks/banque-misr',
  banklive: 'https://banklive.net/en/currency-exchange-rates-in-banque-misr',
});

function normalize(value) {
  return String(value || '').replace(/[أإآ]/g, 'ا').replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه').replace(/[\u064b-\u065f\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function text(node) {
  if (!node || ['script', 'style', 'noscript'].includes(node.tagName)) return '';
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes || []).map(text).join(' ');
}

function nodes(root, predicate) {
  const result = [];
  function visit(node) {
    if (predicate(node)) result.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(root);
  return result;
}

function attr(node, name) {
  return (node.attrs || []).find(item => item.name === name)?.value || '';
}

function nearest(node, tag) {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.tagName === tag) return parent;
  }
  return null;
}

function currencyCode(value) {
  const upper = value.toUpperCase();
  const code = CODES.find(candidate => new RegExp(`\\b${candidate}(?:EGP)?\\b`).test(upper));
  return code || CODES.find(candidate => CURRENCY_NAMES[candidate].test(normalize(value))) || null;
}

function price(value) {
  const cleaned = String(value).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/٫/g, '.').replace(/٬/g, ',').trim();
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  const result = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(result) && result > 0 ? result : null;
}

function validPair(buy, sell) {
  return typeof buy === 'number' && typeof sell === 'number'
    && Number.isFinite(buy) && Number.isFinite(sell) && buy > 0 && sell >= buy;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tableTimestamp(table) {
  const times = nodes(table, node => node.tagName === 'time'
    && nearest(node, 'table') === table && nearest(node, 'caption')
    && /\blast updated?\b|اخر تحديث/.test(normalize(text(nearest(node, 'caption')))))
    .map(node => attr(node, 'datetime')).filter(value => timestamp(value) !== null);
  return times.length === 1 ? new Date(timestamp(times[0])).toISOString() : null;
}

function tableRows(table) {
  return nodes(table, node => node.tagName === 'tr' && nearest(node, 'table') === table)
    .map(row => nodes(row, node => ['td', 'th'].includes(node.tagName)
      && nearest(node, 'tr') === row && nearest(node, 'table') === table));
}

function headerLayout(rows) {
  const grid = [];
  let count = 0;
  for (const row of rows) {
    if (row.some(cell => currencyCode(text(cell)))) break;
    if (!row.length) continue;
    grid[count] ||= [];
    let column = 0;
    for (const cell of row) {
      while (grid[count][column] !== undefined) column++;
      const colspan = Math.min(10, Math.max(1, Number(attr(cell, 'colspan')) || 1));
      const rowspan = Math.min(5, Math.max(1, Number(attr(cell, 'rowspan')) || 1));
      for (let r = count; r < count + rowspan; r++) {
        grid[r] ||= [];
        for (let c = column; c < column + colspan; c++) grid[r][c] = normalize(text(cell));
      }
      column += colspan;
    }
    count++;
    if (count >= 5) break;
  }
  const width = Math.max(0, ...grid.map(row => row.length));
  return Array.from({ length: width }, (_, column) => [...new Set(grid.map(row => row[column]).filter(Boolean))].join(' '));
}

function hasClass(node, value) {
  return attr(node, 'class').split(/\s+/).includes(value);
}

function cellPrice(cell, source) {
  if (!cell) return null;
  if (source === 'official') return price(text(cell));
  const className = source === '3omlla' ? 'rate-number' : 'bankRate';
  const matches = nodes(cell, node => hasClass(node, className) && nearest(node, 'td') === cell);
  return matches.length === 1 ? price(text(matches[0])) : null;
}

function isBankliveCurrency(cell, code) {
  const links = nodes(cell, node => node.tagName === 'a');
  if (links.length !== 1) return false;
  try {
    const url = new URL(attr(links[0], 'href'), SOURCE_URLS.banklive);
    return url.origin === 'https://banklive.net' && !url.username && !url.password
      && url.pathname.replace(/\/$/, '') === `/en/currency/banque-misr/${code.toLowerCase()}-to-egp`;
  } catch {
    return false;
  }
}

function parseRateTables(html, source) {
  const official = source === 'official';
  if (typeof html !== 'string' || !html.trim() || Buffer.byteLength(html) > MAX_HTML_BYTES) throw new Error('Invalid source HTML');
  const document = parse(html);
  const headings = nodes(document, node => ['title', 'h1'].includes(node.tagName));
  if (!headings.some(node => /\bbanque\s*misr\b|بنك مصر/i.test(normalize(text(node))))) throw new Error('Not a Banque Misr page');
  const rates = {};
  const duplicates = new Set();
  for (const table of nodes(document, node => node.tagName === 'table')) {
    if (source === '3omlla' && !hasClass(table, 'w-full')) continue;
    if (source === 'banklive' && !hasClass(table, 'banklive-tablse')) continue;
    const rows = tableRows(table);
    const headers = headerLayout(rows);
    if (source === '3omlla' && !headers.some(value => /\bspread\b/.test(value))) continue;
    const currency = headers.findIndex(value => /\bcurrenc(?:y|ies)\b|العمله/.test(value));
    if (currency < 0 || headers.some(value => /\bbanks?\b|البنك/.test(value))) continue;
    const buyPattern = /\bbuy(?:ing)?\b|شراء/;
    const sellPattern = /\bsell(?:ing)?\b|بيع/;
    const cashPattern = /\b(?:notes?|cash)\b|نقد/;
    const transferPattern = /\btransfers?\b|تحويل/;
    const cashBuy = headers.findIndex(value => buyPattern.test(value) && (!official || cashPattern.test(value)));
    const cashSell = headers.findIndex(value => sellPattern.test(value) && (!official || cashPattern.test(value)));
    const transferBuy = official ? headers.findIndex(value => buyPattern.test(value) && transferPattern.test(value)) : -1;
    const transferSell = official ? headers.findIndex(value => sellPattern.test(value) && transferPattern.test(value)) : -1;
    if ((cashBuy < 0 || cashSell < 0) && (transferBuy < 0 || transferSell < 0)) continue;
    const sourceUpdatedAt = tableTimestamp(table);
    for (const row of rows) {
      if (row.some(cell => Number(attr(cell, 'colspan')) > 1 || Number(attr(cell, 'rowspan')) > 1)) continue;
      const label = row[currency] ? text(row[currency]) : '';
      const code = currencyCode(label);
      if (!code || duplicates.has(code)) continue;
      if (source === 'banklive' && !isBankliveCurrency(row[currency], code)) continue;
      const value = index => index >= 0 ? cellPrice(row[index], source) : null;
      let buy = value(cashBuy);
      let sell = value(cashSell);
      let quoteType = official ? 'cash' : 'unknown';
      if (official && (buy === null || sell === null)) {
        buy = value(transferBuy);
        sell = value(transferSell);
        quoteType = 'transfer';
      }
      if (!validPair(buy, sell)) continue;
      if (official && code === 'JPY' && /\b100\b/.test(label)) {
        buy /= 100;
        sell /= 100;
      }
      const quote = { buy, sell, quoteType, sourceUpdatedAt };
      if (rates[code] && (rates[code].buy !== buy || rates[code].sell !== sell)) {
        delete rates[code];
        duplicates.add(code);
      } else {
        rates[code] = quote;
      }
    }
  }
  if (!Object.keys(rates).length) throw new Error('No valid Banque Misr currency table');
  return rates;
}

function parseOfficialRates(html) {
  return parseRateTables(html, 'official');
}

function parse3omllaRates(html) {
  return parseRateTables(html, '3omlla');
}

function parseBankliveRates(html) {
  return parseRateTables(html, 'banklive');
}

const PARSERS = { official: parseOfficialRates, '3omlla': parse3omllaRates, banklive: parseBankliveRates };

function referenceTime(quote) {
  return timestamp(quote.sourceUpdatedAt) ?? timestamp(quote.fetchedAt);
}

function withinAge(quote, now) {
  const time = referenceTime(quote);
  return time !== null && time <= now && now - time <= MAX_AGE_MS;
}

async function fetchSource(source, url, now) {
  const fetchedAt = new Date(now).toISOString();
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      ...(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } : {}),
      maxContentLength: MAX_HTML_BYTES,
      maxBodyLength: MAX_HTML_BYTES,
      maxRedirects: 3,
      responseType: 'text',
      headers: { Accept: 'text/html', 'User-Agent': 'BanqueMisrRates/1.0' },
    });
    if (response.status !== 200) throw new Error('Source HTTP failure');
    const parsed = PARSERS[source](response.data);
    const rates = {};
    for (const [code, quote] of Object.entries(parsed)) {
      const candidate = { ...quote, source, fetchedAt, stale: false };
      if (withinAge(candidate, now)) rates[code] = candidate;
    }
    if (!Object.keys(rates).length) throw new Error('No current source quotes');
    return { status: 'ok', rates, fetchedAt, error: null };
  } catch (error) {
    const timedOut = ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(error.code) || error.name === 'TimeoutError';
    return { status: 'unavailable', rates: {}, fetchedAt: null, error: timedOut ? 'timeout' : 'fetch_or_parse_failed' };
  }
}

async function fetchBanqueMisrRates({ previousRates = {}, now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw new TypeError('now must be a finite epoch timestamp');
  const fetchedAt = new Date(now).toISOString();
  const sources = {};

  const officialResult = await fetchSource('official', SOURCE_URLS.official, now);
  sources.official = { status: officialResult.status, fetchedAt: officialResult.fetchedAt, currencies: Object.keys(officialResult.rates), error: officialResult.error };

  const rates = { ...officialResult.rates };
  let missing = CODES.filter(code => !rates[code]);
  const needFallback = officialResult.status !== 'ok' || missing.length > 0;

  const fallbackOrder = ['banklive', '3omlla'];
  let fallbackResults = [];
  if (needFallback) {
    fallbackResults = await Promise.all(fallbackOrder.map(source => fetchSource(source, SOURCE_URLS[source], now)));
    for (let i = 0; i < fallbackOrder.length; i++) {
      const source = fallbackOrder[i];
      const result = fallbackResults[i];
      sources[source] = { status: result.status, fetchedAt: result.fetchedAt, currencies: Object.keys(result.rates), error: result.error };
    }
    for (const source of fallbackOrder) {
      const result = fallbackResults.find(r => r.source === source) || fallbackResults[fallbackOrder.indexOf(source)];
      if (result.status !== 'ok') continue;
      for (const code of missing) {
        if (result.rates[code] && !rates[code]) {
          rates[code] = result.rates[code];
        }
      }
      missing = CODES.filter(code => !rates[code]);
      if (!missing.length) break;
    }
  } else {
    for (const source of fallbackOrder) {
      sources[source] = { status: 'skipped', fetchedAt: null, currencies: [], error: null };
    }
  }

  for (const code of CODES) {
    if (rates[code]) continue;
    const previous = previousRates && previousRates[code];
    if (previous && validPair(previous.buy, previous.sell) && Object.hasOwn(SOURCE_URLS, previous.source)
      && timestamp(previous.fetchedAt) !== null && withinAge(previous, now)) {
      rates[code] = {
        buy: previous.buy,
        sell: previous.sell,
        source: previous.source,
        fetchedAt: previous.fetchedAt,
        sourceUpdatedAt: timestamp(previous.sourceUpdatedAt) !== null ? previous.sourceUpdatedAt : null,
        quoteType: ['cash', 'transfer', 'unknown'].includes(previous.quoteType) ? previous.quoteType : 'unknown',
        stale: true,
      };
    }
  }

  missing = CODES.filter(code => !rates[code]);
  const quotes = Object.values(rates);
  const healthySources = Object.values(sources).filter(source => source.status === 'ok').length;
  const allFresh = quotes.every(quote => !quote.stale);
  const anyFresh = quotes.some(quote => !quote.stale);

  const status = !quotes.length ? 'unavailable'
    : !anyFresh ? 'stale'
    : (sources.official.status === 'ok' && allFresh && !missing.length) ? 'ok'
    : 'partial';

  return { rates, sources, status };
}

module.exports = {
  fetchBanqueMisrRates,
  parseOfficialRates,
  parse3omllaRates,
  parseBankliveRates,
  SOURCE_URLS,
  CODES,
  CURRENCY_NAMES,
  MAX_AGE_MS,
  REQUEST_TIMEOUT_MS,
  MAX_HTML_BYTES,
};
