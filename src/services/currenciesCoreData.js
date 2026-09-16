import { readCachedValue, writeCachedValue, validRates, validBankRates } from '../api/apiConfig';
import { fetchCurrenciesFromApi } from './currenciesCore';
import { CACHE_KEYS } from '../constants/cacheKeys';

let lastCurrenciesData = null;

/**
 * دالة الحصول على بيانات العملات مع التحكم في قراءة الملف الثابت
 */
export async function getCurrenciesData(forceRefresh = false) {
  const lastFetchTime = await readCachedValue(CACHE_KEYS.CURRENCIES_TIME);

  // التحقق من الفترة الزمنية لقراءة الملف الثابت
  // أولاً: حاول استعادة الكاش المحلي
  const [cachedRates, cachedBm] = await Promise.all([
    readCachedValue(CACHE_KEYS.CURRENCIES),
    readCachedValue(CACHE_KEYS.BM_RATES),
  ]);
  let currentBm = validBankRates(lastCurrenciesData?.banqueMisrRates || cachedBm);

  // التحقق من صلاحية الكاش (يجب ألا يكون فارغاً)
  let validCachedRates = {};
  try {
    validCachedRates = validRates(lastCurrenciesData?.rates || cachedRates);
  } catch (e) { /* ignore */ }

  // استخدم الكاش فقط إذا كان صالحاً وضمن فترة التهدئة
  // محاولة جلب بيانات جديدة من السيرفر
  try {
    const freshData = await fetchCurrenciesFromApi(forceRefresh);
    const rates = validRates(freshData?.rates);
    if (Object.keys(rates).length > 0) {
      const freshBm = validBankRates(freshData.banqueMisrRates);

      // تأمين أسعار بنك مصر: إذا رجعت فارغة من السيرفر، لا تمسح الكاش
      const verifiedCachedBm = Object.fromEntries(Object.entries(currentBm)
        .filter(([, quote]) => quote.fetchedAt && ['official', '3omlla', 'banklive'].includes(quote.source))
        .map(([code, quote]) => [code, { ...quote, stale: true }]));
      if (freshData._bankSnapshotAuthoritative) {
        currentBm = { ...verifiedCachedBm, ...freshBm };
      } else if (Object.keys(freshBm).length > 0) {
        currentBm = freshBm;
      }
      const usingCachedBm = !Object.keys(freshBm).length && Object.keys(currentBm).length > 0;
      if (freshData._bankSnapshotAuthoritative || Object.keys(freshBm).length > 0) {
        await writeCachedValue(CACHE_KEYS.BM_RATES, currentBm);
      }
      const result = {
        ...freshData,
        rates,
        banqueMisrRates: currentBm,
        ...(usingCachedBm ? { _bmIsFallback: true } : {}),
      };
      lastCurrenciesData = result;
      if (!freshData._isFallback) {
        await Promise.all([
          writeCachedValue(CACHE_KEYS.CURRENCIES, rates),
          writeCachedValue(CACHE_KEYS.CURRENCIES_TIME, freshData._lastUpdated ?? null),
        ]);
      }
      return result;
    }
    throw new Error('Invalid data from API');
  } catch (error) {
    console.warn('API Fetch failed or empty, using validated fallback cache');
    return {
      ...lastCurrenciesData,
      rates: validCachedRates,
      banqueMisrRates: currentBm,
      _lastUpdated: lastCurrenciesData?._lastUpdated ?? (Number.isFinite(lastFetchTime) ? lastFetchTime : null),
      _fromCache: Object.keys(validCachedRates).length > 0,
      _isFallback: true,
      _offlineMode: true,
    };
  }
}

/**
 * 2. دالة مساعدة جديدة (للواجهات المستقبلية فقط بصيغة JSON منظم)
 */
export async function getStructuredCurrencyDatabase() {
  const data = await getCurrenciesData();
  
  const structuredDatabase = {
    lastUpdated: data._lastUpdated ? new Date(data._lastUpdated).toISOString() : null,
    _isFallback: !!data._isFallback,
    baseCurrency: "USD",
    currencies: {}
  };

  for (const [code, globalRate] of Object.entries(data.rates)) {
    const bmData = data.banqueMisrRates[code] || {};
    structuredDatabase.currencies[code] = {
      globalRate: globalRate,
      banqueMisr: {
        buy: bmData.buy || null,
        sell: bmData.sell || null
      }
    };
  }

  return structuredDatabase;
}
