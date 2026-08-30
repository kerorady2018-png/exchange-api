import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrenciesFromApi } from './currenciesCore';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';

const INJECTED_BM_RATES = {
  "USD": { "buy": 50.23, "sell": 50.33 },
  "EUR": { "buy": 54.45, "sell": 54.70 },
  "GBP": { "buy": 64.80, "sell": 65.10 },
  "SAR": { "buy": 13.38, "sell": 13.42 },
  "AED": { "buy": 13.67, "sell": 13.71 },
  "KWD": { "buy": 163.50, "sell": 164.20 },
  "QAR": { "buy": 13.78, "sell": 13.82 },
  "BHD": { "buy": 133.20, "sell": 133.60 },
  "OMR": { "buy": 130.40, "sell": 130.80 },
  "JOD": { "buy": 70.80, "sell": 71.20 }
};

/**
 * دالة الحصول على بيانات العملات مع التحكم في قراءة الملف الثابت
 */
export async function getCurrenciesData(forceRefresh = false) {
  const nowTime = Date.now();
  const lastFetchTimeStr = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME);
  const lastFetchTime = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;

  // التحقق من الفترة الزمنية لقراءة الملف الثابت
  const lastStaticFileRequest = await AsyncStorage.getItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST);
  const timeSinceStaticRequest = lastStaticFileRequest ? nowTime - parseInt(lastStaticFileRequest) : Infinity;

  // أولاً: حاول استعادة الكاش المحلي
  const cachedRates = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
  const cachedBm = await AsyncStorage.getItem(CACHE_KEYS.BM_RATES);

  let currentBm = cachedBm ? JSON.parse(cachedBm) : INJECTED_BM_RATES;

  // إذا لم يكن هناك طلب إجباري ومرت أقل من 5 دقائق، استخدم الكاش للسرعة
  if (!forceRefresh && timeSinceStaticRequest < CACHE_DURATIONS.STATIC_FILE_READ_COOLDOWN) {
    if (cachedRates) {
      try {
        return {
          rates: JSON.parse(cachedRates),
          banqueMisrRates: (currentBm && Object.keys(currentBm).length > 0) ? currentBm : INJECTED_BM_RATES,
          _fromCache: true
        };
      } catch (e) { /* fallback */ }
    }
  }

  // محاولة جلب بيانات جديدة من السيرفر
  try {
    const freshData = await fetchCurrenciesFromApi();

    if (freshData && freshData.rates && Object.keys(freshData.rates).length > 0) {
      await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES, JSON.stringify(freshData.rates));
      await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES_TIME, nowTime.toString());
      await AsyncStorage.setItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST, nowTime.toString());

      // تأمين أسعار بنك مصر: إذا رجعت فارغة من السيرفر، لا تمسح الكاش
      if (freshData.banqueMisrRates && Object.keys(freshData.banqueMisrRates).length > 0) {
        await AsyncStorage.setItem(CACHE_KEYS.BM_RATES, JSON.stringify(freshData.banqueMisrRates));
        currentBm = freshData.banqueMisrRates;
      }

      return {
        ...freshData,
        banqueMisrRates: (currentBm && Object.keys(currentBm).length > 0) ? currentBm : INJECTED_BM_RATES,
        _fromCache: false,
        _lastUpdated: nowTime
      };
    }
    throw new Error('Invalid data from API');
  } catch (error) {
    console.warn('API Fetch failed or empty, using fallback cache and injected data');
    return {
      rates: cachedRates ? JSON.parse(cachedRates) : {},
      banqueMisrRates: (currentBm && Object.keys(currentBm).length > 0) ? currentBm : INJECTED_BM_RATES,
      _isFallback: true,
      _offlineMode: true
    };
  }
}

/**
 * 2. دالة مساعدة جديدة (للواجهات المستقبلية فقط بصيغة JSON منظم)
 */
export async function getStructuredCurrencyDatabase() {
  const data = await getCurrenciesData();
  
  const structuredDatabase = {
    lastUpdated: new Date().toISOString(),
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
