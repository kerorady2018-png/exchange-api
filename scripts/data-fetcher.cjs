const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fetchBanqueMisrRates } = require('./banque-misr.cjs');
const { fetchCBERates } = require('./cbeFetcher.cjs');

// مسارات الملفات
const RATES_FILE = path.join(__dirname, '../public/data/rates.json');
const METADATA_FILE = path.join(__dirname, '../public/data/metadata.json');

// أسعار عملات احتياطية لضمان وجود جميع العملات حتى لو فشل الـ API الخارجي
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const positive = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) > 0;
const validTime = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now && now - Date.parse(value) <= MAX_AGE_MS;
const oldestTime = (times) => times.reduce((oldest, value) => !oldest || Date.parse(value) < Date.parse(oldest) ? value : oldest, null);
const average = (values) => {
  const sum = values.reduce((total, value) => total + value, 0);
  if (Number.isFinite(sum)) return sum / values.length;
  const maximum = Math.max(...values);
  return maximum * (values.reduce((total, value) => total + value / maximum, 0) / values.length);
};
const readSnapshot = () => {
  try {
    return JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));
  } catch (error) {
    return null;
  }
};
const validQuote = (entry) => {
  const buy = entry?.buy ?? entry?.purchase;
  const sell = entry?.sell ?? entry?.sale;
  return positive(buy) && positive(sell) && Number(sell) >= Number(buy) ? { ...entry, buy: Number(buy), sell: Number(sell) } : null;
};
const bankQuotes = (input, now, stale = false) => {
  const result = {};
  for (const [code, entry] of Object.entries(input || {})) {
    const quote = validQuote(entry);
    if (/^[A-Z]{3}$/.test(code) && ['official', '3omlla', 'banklive'].includes(quote?.source) &&
      validTime(quote.sourceUpdatedAt || quote.fetchedAt, now) && validTime(quote.fetchedAt, now)) {
      result[code] = { ...quote, stale: stale || quote.stale === true };
    }
  }
  return result;
};
const sourceTime = (data, now) => {
  if (data?.time_last_update_unix !== undefined) {
    const value = Number(data.time_last_update_unix) * 1000;
    return Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
  }
  return data?.sourceUpdatedAt ?? data?.lastUpdated ?? data?.updatedAt ?? new Date(now).toISOString();
};
const validCachedCurrencies = (section, now) => section && validTime(section.lastUpdated, now) &&
  section.rates && Number(section.rates.USD) === 1 && positive(section.rates.EGP) &&
  Object.values(section.rates).every(positive);

const fetchCurrenciesData = async ({ previousSnapshot = readSnapshot(), now = Date.now() } = {}) => {
  console.log('Fetching currencies data...');
  const checkedAt = new Date(now).toISOString();
  const previous = previousSnapshot?.currencies;
  const [globalRes, cbeRes, banqueMisrRes] = await Promise.allSettled([
    axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 15000 }),
    fetchCBERates({ now }),
    fetchBanqueMisrRates({ previousRates: previous?.banqueMisrRates || {}, now })
  ]);
  const globalData = globalRes.status === 'fulfilled' ? globalRes.value?.data : null;
  const globalTime = sourceTime(globalData, now);
  const rawGlobalRates = globalData?.rates;
  const globalAvailable = rawGlobalRates && !Array.isArray(rawGlobalRates) &&
    (!globalData.base_code || globalData.base_code === 'USD') && globalData.result !== 'error' &&
    globalData.stale !== true && !['stale', 'unavailable', 'error'].includes(globalData.status) &&
    Number(rawGlobalRates.USD) === 1 && positive(rawGlobalRates.EGP) && validTime(globalTime, now);

  // الدمج مع العملات الافتراضية لضمان عدم نقص أي عملة
  const globalRates = globalAvailable ? Object.fromEntries(Object.entries(rawGlobalRates)
    .filter(([code, value]) => /^[A-Z]{3}$/.test(code) && positive(value))
    .map(([code, value]) => [code, Number(value)])) : {};
  const cbeResponse = cbeRes.status === 'fulfilled' ? cbeRes.value : null;
  const cbeTime = cbeResponse?.sourceUpdatedAt;
  const cbeRates = {};
  if (cbeResponse && cbeResponse.status === 'ok' && validTime(cbeTime, now)) {
    for (const [code, entry] of Object.entries(cbeResponse.rates || {})) {
      const quote = validQuote(entry);
      if (quote && /^[A-Z]{3}$/.test(code)) {
        cbeRates[code] = { ...quote, sourceUpdatedAt: cbeTime };
      }
    }
  }
  const bankData = banqueMisrRes.status === 'fulfilled' ? banqueMisrRes.value : null;
  const banqueMisrRates = {
    ...bankQuotes(previous?.banqueMisrRates, now, true),
    ...bankQuotes(bankData?.rates, now, bankData?.status === 'stale' || bankData?.status === 'unavailable')
  };
  const freshBankRates = Object.fromEntries(Object.entries(banqueMisrRates).filter(([, entry]) => !entry.stale));
  const bankCount = Object.keys(banqueMisrRates).length;
  const freshBankCount = Object.keys(freshBankRates).length;
  const banqueMisrStatus = !bankCount ? 'unavailable' : !freshBankCount ? 'stale' :
    freshBankCount < bankCount || bankData?.status === 'partial' ? 'partial' : 'ok';
  const banqueMisrSources = bankData?.sources || {};
  const sources = {
    global: {
      status: globalAvailable ? 'ok' : 'unavailable',
      sourceUpdatedAt: globalData ? globalTime : previous?.sources?.global?.sourceUpdatedAt || null,
      fetchedAt: globalAvailable ? checkedAt : previous?.sources?.global?.fetchedAt || null,
      checkedAt
    },
    cbe: {
      status: Object.keys(cbeRates).length ? 'ok' : 'unavailable',
      sourceUpdatedAt: cbeResponse ? cbeTime : previous?.sources?.cbe?.sourceUpdatedAt || null,
      fetchedAt: Object.keys(cbeRates).length ? checkedAt : previous?.sources?.cbe?.fetchedAt || null,
      checkedAt
    },
    banqueMisr: { status: banqueMisrStatus, sources: banqueMisrSources }
  };
  const usdPrices = [];
  const usedTimes = [];
  if (globalAvailable) {
    usdPrices.push(globalRates.EGP);
    usedTimes.push(globalTime);
  }
  for (const quotes of [cbeRates, freshBankRates]) {
    if (quotes.USD) {
      usdPrices.push(average([quotes.USD.buy, quotes.USD.sell]));
      usedTimes.push(quotes.USD.sourceUpdatedAt || quotes.USD.fetchedAt);
    }
  }
  const details = { banqueMisrRates, banqueMisrStatus, banqueMisrSources, sources, checkedAt };
  if (!usdPrices.length) {
    if (!validCachedCurrencies(previous, now)) throw new Error('No usable currency sources or recent validated snapshot');
    return { ...previous, ...details, rates: { ...previous.rates }, lastUpdated: previous.lastUpdated, status: 'stale' };
  }
  const egp = average(usdPrices);
  const rates = { USD: 1, EGP: egp };
  const codes = new Set([...Object.keys(globalRates), ...Object.keys(cbeRates), ...Object.keys(freshBankRates)]);
  for (const code of codes) {
    if (code === 'USD' || code === 'EGP') continue;
    const prices = [];
    if (globalRates[code]) {
      const price = globalRates.EGP / globalRates[code];
      if (positive(price)) prices.push(price);
    }
    for (const quotes of [cbeRates, freshBankRates]) {
      if (quotes[code]) {
        prices.push(average([quotes[code].buy, quotes[code].sell]));
        usedTimes.push(quotes[code].sourceUpdatedAt || quotes[code].fetchedAt);
      }
    }
    if (prices.length && positive(egp / average(prices))) rates[code] = egp / average(prices);
  }
  console.log('Currencies data fetched successfully');
  return {
    rates, ...details, globalRates,
    lastUpdated: oldestTime(usedTimes),
    status: globalAvailable && sources.cbe.status === 'ok' && banqueMisrStatus === 'ok' ? 'ok' : 'partial'
  };
};

const cachedMetals = (snapshot, now) => {
  const metals = snapshot?.metals;
  if (!metals || !validTime(metals.lastUpdated, now)) return null;
  const gold = metals.goldData;
  const silver = metals.silverData;
  if (!gold && !silver) return null;
  if (gold && !['price_gram_24k', 'price_gram_21k', 'price_gram_18k', 'price_ounce'].every((key) => positive(gold[key]))) return null;
  if (silver && !['price_gram', 'price_ounce'].every((key) => positive(silver[key]))) return null;
  return { ...metals, status: 'stale' };
};

const fetchMetalsData = async ({ previousSnapshot = readSnapshot(), now = Date.now() } = {}) => {
  console.log('Fetching metals data...');
  const checkedAt = new Date(now).toISOString();
  const [goldRes, silverRes] = await Promise.allSettled([
    axios.get('https://api.gold-api.com/price/XAU', { timeout: 15000 }),
    axios.get('https://api.gold-api.com/price/XAG', { timeout: 15000 })
  ]);
  const prices = {};
  const times = [];
  const sources = {};
  for (const [name, response] of [['gold', goldRes], ['silver', silverRes]]) {
    const data = response.status === 'fulfilled' ? response.value?.data : null;
    const timestamp = sourceTime(data, now);
    const available = data && positive(data.price) && positive(Number(data.price) / 31.1035 * 0.75) &&
      validTime(timestamp, now) && data.stale !== true && !['stale', 'unavailable', 'error'].includes(data.status);
    sources[name] = { status: available ? 'ok' : 'unavailable', sourceUpdatedAt: data ? timestamp : null, fetchedAt: checkedAt };
    if (available) {
      prices[name] = Number(data.price);
      times.push(timestamp);
    }
  }
  const cached = cachedMetals(previousSnapshot, now);
  if (!Object.keys(prices).length) {
    if (cached) return cached;
    throw new Error('No usable metal sources or recent validated snapshot');
  }

  // هيكلة بيانات المعادن بخصائص مكتملة يسهل قراءتها من التطبيق
  const structuredMetals = { lastUpdated: oldestTime(times), status: prices.gold && prices.silver ? 'ok' : 'partial', sources };
  if (prices.gold) {
    const gram24USD = prices.gold / 31.1035;
    structuredMetals.goldData = {
      price_gram_24k: gram24USD,
      price_gram_21k: gram24USD * (21 / 24),
      price_gram_18k: gram24USD * (18 / 24),
      price_ounce: prices.gold,
      price: prices.gold,
      data: { price: prices.gold }
    };
  }
  if (prices.silver) {
    structuredMetals.silverData = { price_gram: prices.silver / 31.1035, price_ounce: prices.silver, price: prices.silver, data: { price: prices.silver } };
  }
  for (const [name, key] of [['gold', 'goldData'], ['silver', 'silverData']]) {
    if (!structuredMetals[key] && cached?.[key]) {
      structuredMetals[key] = { ...cached[key], stale: true };
      sources[name] = { ...sources[name], sourceUpdatedAt: cached.lastUpdated, fetchedAt: cached.sources?.[name]?.fetchedAt || null };
      times.push(cached.lastUpdated);
    }
  }
  structuredMetals.lastUpdated = oldestTime(times);
  console.log('Metals data fetched successfully');
  return structuredMetals;
};

const saveData = (data) => {
  try {
    fs.writeFileSync(RATES_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Data saved to rates.json');
    const metadata = {
      lastCurrenciesUpdate: data.currencies.lastUpdated,
      lastMetalsUpdate: data.metals?.lastUpdated || null,
      lastFullUpdate: data.lastUpdated,
      checkedAt: data.checkedAt,
      status: data.status,
      version: '1.0.0'
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    console.log('Metadata updated');
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
};

const main = async ({ previousSnapshot = readSnapshot(), now = Date.now() } = {}) => {
  try {
    console.log('Starting data fetcher...');
    console.log('================================');
    const [currenciesData, metalsData] = await Promise.allSettled([
      fetchCurrenciesData({ previousSnapshot, now }),
      fetchMetalsData({ previousSnapshot, now })
    ]);
    if (currenciesData.status !== 'fulfilled') throw currenciesData.reason;
    const finalCurrencies = currenciesData.value;
    const finalMetals = metalsData.status === 'fulfilled' ? metalsData.value : null;
    const calculatedRates = {};
    if (finalMetals?.goldData) {
      calculatedRates.XAU_24 = finalMetals.goldData.price_gram_24k;
      calculatedRates.XAU_21 = finalMetals.goldData.price_gram_21k;
      calculatedRates.XAU_18 = finalMetals.goldData.price_gram_18k;
    }
    if (finalMetals?.silverData) calculatedRates.XAG_GRAM = finalMetals.silverData.price_gram;
    if (finalCurrencies.status !== 'stale' && finalMetals?.status === 'ok') {
      Object.assign(finalCurrencies.rates, calculatedRates);
    }
    const status = finalCurrencies.status === 'stale' ? 'stale' :
      finalCurrencies.status === 'ok' && finalMetals?.status === 'ok' ? 'success' : 'partial';
    const finalData = {
      currencies: finalCurrencies,
      ...(finalMetals ? { metals: finalMetals } : {}),
      calculatedRates,
      lastUpdated: oldestTime([finalCurrencies.lastUpdated, ...(finalMetals ? [finalMetals.lastUpdated] : [])]),
      checkedAt: new Date(now).toISOString(),
      status
    };
    saveData(finalData);
    console.log('================================');
    console.log(`Last updated: ${finalData.lastUpdated}`);
    console.log('================================');
    return finalData;
  } catch (error) {
    console.error('================================');
    console.error('Error in data fetcher:', error);
    console.error('================================');
    throw error;
  }
};

if (require.main === module) {
  main().catch(() => { process.exitCode = 1; });
}

module.exports = { main, fetchCurrenciesData, fetchMetalsData };
