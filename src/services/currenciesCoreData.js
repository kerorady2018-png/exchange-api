import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrenciesFromApi } from './currenciesCore';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';

/**
 * دالة الحصول على بيانات العملات مع التحكم في قراءة الملف الثابت
 * forceRefresh يتم تجاهله دائماً لمنع الطلبات المباشرة
 */
export async function getCurrenciesData(forceRefresh = false) {
  const nowTime = Date.now();
  const lastFetchTimeStr = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME);
  const lastFetchTime = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;

  // التحقق من الفترة الزمنية لقراءة الملف الثابت
  const lastStaticFileRequest = await AsyncStorage.getItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST);
  const timeSinceStaticRequest = lastStaticFileRequest ? nowTime - parseInt(lastStaticFileRequest) : Infinity;

  // إذا مرت أقل من 5 دقائق على آخر قراءة للملف الثابت، استخدم الكاش المحلي
  if (timeSinceStaticRequest < CACHE_DURATIONS.STATIC_FILE_READ_COOLDOWN) {
    const cachedRates = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
    const cachedBm = await AsyncStorage.getItem(CACHE_KEYS.BM_RATES);
    
    if (cachedRates && cachedBm) {
      try {
        return {
          rates: JSON.parse(cachedRates),
          banqueMisrRates: JSON.parse(cachedBm),
          _fromCache: true,
          _fromLocalCache: true
        };
      } catch (e) { /* fallback to fetch */ }
    }
  }

  // قراءة من الملف الثابت
  try {
    const freshData = await fetchCurrenciesFromApi();

    // تخزين البيانات فور وصولها
    await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES, JSON.stringify(freshData.rates));
    await AsyncStorage.setItem(CACHE_KEYS.BM_RATES, JSON.stringify(freshData.banqueMisrRates));
    await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES_TIME, nowTime.toString());
    await AsyncStorage.setItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST, nowTime.toString());

    return { ...freshData, _fromCache: false, _lastUpdated: nowTime };
  } catch (error) {
    // Fallback to cache silently
    const cachedRates = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
    const cachedBm = await AsyncStorage.getItem(CACHE_KEYS.BM_RATES);

    if (cachedRates) {
      try {
        return {
          rates: JSON.parse(cachedRates),
          banqueMisrRates: cachedBm ? JSON.parse(cachedBm) : {},
          _isFallback: true,
          _offlineMode: true
        };
      } catch (e) {
        return { rates: {}, banqueMisrRates: {}, _error: true };
      }
    }
    return { rates: {}, banqueMisrRates: {}, _error: true };
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
