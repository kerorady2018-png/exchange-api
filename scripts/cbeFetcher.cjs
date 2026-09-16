const axios = require('axios');
const { parse } = require('parse5');

const CBE_PAGE_URL = 'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates/historical-data';
const CBE_API_URL = 'https://www.cbe.org.eg/api/statistics/GetHistoricalData';
const REQUEST_TIMEOUT_MS = 25000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

const CBE_NAME_TO_CODE = {
  'US Dollar': 'USD',
  'Euro': 'EUR',
  'Pound Sterling': 'GBP',
  'Canadian Dollar': 'CAD',
  'Danish Krone': 'DKK',
  'Norwegian Krone': 'NOK',
  'Swedish Krona': 'SEK',
  'Swiss Franc': 'CHF',
  'Japanese Yen 100': 'JPY',
  'Saudi Riyal': 'SAR',
  'Kuwaiti Dinar': 'KWD',
  'UAE Dirham': 'AED',
  'Australian Dollar': 'AUD',
  'Bahraini Dinar': 'BHD',
  'Omani Riyal': 'OMR',
  'Qatari Riyal': 'QAR',
  'Jordanian Dinar': 'JOD',
  'Chinese Yuan': 'CNY',
};

function attr(node, name) {
  return (node.attrs || []).find(item => item.name === name)?.value || '';
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

function text(node) {
  if (!node || ['script', 'style', 'noscript'].includes(node.tagName)) return '';
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes || []).map(text).join(' ');
}

function strip(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseCookies(setCookie) {
  if (!Array.isArray(setCookie)) return '';
  return setCookie.map(cookie => cookie.split(';')[0]).join('; ');
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parsePublishedDate(dateText) {
  const match = String(dateText || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function parseCBETable(html) {
  const document = parse(html);
  const table = nodes(document, node => node.tagName === 'table' && attr(node, 'class').includes('table-comp'))[0];
  if (!table) return null;

  const rates = {};
  let publishedDate = null;

  for (const row of nodes(table, node => node.tagName === 'tr')) {
    const cells = nodes(row, node => node.tagName === 'td' && attr(node, 'class').includes('table-cell'));
    if (cells.length < 4) continue;

    const dateText = strip(text(cells[0]));
    const currencyName = strip(text(cells[1]));
    const buy = positive(strip(text(cells[2])));
    const sell = positive(strip(text(cells[3])));

    if (!buy || !sell || sell < buy) continue;

    const code = CBE_NAME_TO_CODE[currencyName];
    if (!code) continue;

    const quote = { buy, sell, quoteType: 'official', sourceUpdatedAt: null };
    if (code === 'JPY') {
      quote.buy = buy / 100;
      quote.sell = sell / 100;
    }

    if (!publishedDate && dateText) publishedDate = dateText;
    rates[code] = quote;
  }

  return { rates, publishedDate };
}

async function fetchCBEForm() {
  const response = await axios.get(CBE_PAGE_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 3,
    maxContentLength: MAX_HTML_BYTES,
    maxBodyLength: MAX_HTML_BYTES,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (response.status !== 200 || /Request Rejected/i.test(response.data)) {
    throw new Error('CBE page unavailable');
  }

  const document = parse(response.data);
  const inputs = {};
  let options = [];

  for (const form of nodes(document, node => node.tagName === 'form' && attr(node, 'id') === 'historicalDataForm')) {
    for (const input of nodes(form, node => node.tagName === 'input' && attr(node, 'name'))) {
      inputs[attr(input, 'name')] = attr(input, 'value');
    }
    for (const select of nodes(form, node => node.tagName === 'select' && attr(node, 'name') === 'SelectedSelectOptions')) {
      options = nodes(select, node => node.tagName === 'option').map(option => attr(option, 'value'));
    }
  }

  if (!inputs['__RequestVerificationToken'] || !options.length) {
    throw new Error('CBE form not found');
  }

  const cookies = parseCookies(response.headers['set-cookie']);
  return { inputs, options, cookies };
}

async function postCBEData({ inputs, options, cookies, date }) {
  const parts = [
    `__RequestVerificationToken=${encodeURIComponent(inputs['__RequestVerificationToken'])}`,
    `uid=${encodeURIComponent(inputs['uid'])}`,
    `DataSourceId=${encodeURIComponent(inputs['DataSourceId'])}`,
    `FallbackUrl=${encodeURIComponent(inputs['FallbackUrl'])}`,
    `LanguageName=${encodeURIComponent(inputs['LanguageName'])}`,
    `FromDateRaw=${encodeURIComponent(date)}`,
    `ToDateRaw=${encodeURIComponent(date)}`,
  ];

  for (const option of options) {
    parts.push(`SelectedSelectOptions=${encodeURIComponent(option)}`);
    parts.push(`multiselect_multipleSelectID=${encodeURIComponent(option)}`);
  }

  parts.push('SubmitAction=1');

  const response = await axios.post(CBE_API_URL, parts.join('&'), {
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: MAX_HTML_BYTES,
    maxBodyLength: MAX_HTML_BYTES,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://www.cbe.org.eg',
      Referer: CBE_PAGE_URL,
      Cookie: cookies,
    },
  });

  if (response.status !== 200) throw new Error('CBE API HTTP failure');
  if (/There are no matching results/i.test(response.data)) return null;
  return response.data;
}

async function fetchCBERates({ now = Date.now() } = {}) {
  const checkedAt = new Date(now).toISOString();

  try {
    const form = await fetchCBEForm();
    const base = new Date(now);

    for (let offset = 0; offset < 7; offset++) {
      const d = new Date(base.getTime() - offset * 24 * 60 * 60 * 1000);
      const dateText = formatDate(d);
      const html = await postCBEData({ ...form, date: dateText });
      if (!html) continue;

      const parsed = parseCBETable(html);
      if (!parsed || !Object.keys(parsed.rates).length) continue;

      const sourceUpdatedAt = parsePublishedDate(parsed.publishedDate) || checkedAt;
      for (const quote of Object.values(parsed.rates)) {
        quote.sourceUpdatedAt = sourceUpdatedAt;
      }

      return {
        rates: parsed.rates,
        status: 'ok',
        sourceUpdatedAt,
        fetchedAt: checkedAt,
      };
    }

    return { rates: {}, status: 'unavailable', sourceUpdatedAt: null, fetchedAt: null };
  } catch (error) {
    return { rates: {}, status: 'unavailable', sourceUpdatedAt: null, fetchedAt: null, error: error.message };
  }
}

module.exports = { fetchCBERates, CBE_PAGE_URL, CBE_API_URL };
