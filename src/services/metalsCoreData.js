import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRawMetalsApiData } from './metalsCore';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';

const BACKGROUND_MASNEIYYA = {
  'XAU_24': 58,
  'XAU_21': 50,
  'XAU_18': 42
};

// توحيد الحروف العربية لتجنب مشاكل تطابق الأسماء
const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .replace(/[يى]/g, 'ي')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه');
};

// البحث المرن عن بيانات العملة في البنك المركزي
const findCbeEntry = (cbeData, targetArabicName) => {
  if (!cbeData || !targetArabicName) return null;
  const normalizedTarget = normalizeArabic(targetArabicName);
  for (const key of Object.keys(cbeData)) {
    if (normalizeArabic(key) === normalizedTarget) {
      return cbeData[key];
    }
  }
  return null;
};

/**
 * معالجة وحساب أسعار المعادن والأعيرة بناءً على البيانات الخام
 * تم تحديثها لتدعم هيكل البيانات الجديد من الملف الثابت
 */
function processMetalsData(rawApiData, baseCurrency = 'USD', forexRates = {}, customGoldRate = null) {
  const { goldData, silverData, cbeData, globalRates: apiGlobalRates } = rawApiData;

  // دعم هيكل البيانات الجديد من الملف الثابت
  const goldOunceUSD = Number(goldData?.price_ounce || goldData?.data?.price) || 0;
  const silverOunceUSD = Number(silverData?.price_ounce || silverData?.data?.price) || 0;
  const globalRates = Object.keys(apiGlobalRates).length > 0 ? apiGlobalRates : forexRates;

  // 1. حساب سعر الصرف الرسمي البحت (خاص بالأونصات العالمية)
  let officialUsdToBaseRate = 1;
  if (baseCurrency !== 'USD') {
    if (globalRates[baseCurrency] && globalRates['USD']) {
      officialUsdToBaseRate = globalRates[baseCurrency] / globalRates['USD'];
    } else {
      officialUsdToBaseRate = globalRates[baseCurrency] || forexRates[baseCurrency] || 1;
    }
  }

  const goldOunceLocal = goldOunceUSD * officialUsdToBaseRate;
  const silverOunceLocal = silverOunceUSD * officialUsdToBaseRate;

  // دعم البيانات المباشرة من الملف الثابت (price_gram_24k, price_gram_21k, price_gram_18k)
  const gram24 = Number(goldData?.price_gram_24k) || 0;
  const gram21 = Number(goldData?.price_gram_21k) || 0;
  const gram18 = Number(goldData?.price_gram_18k) || 0;
  const silverGram = Number(silverData?.price_gram) || 0;

  // إذا لم توجد البيانات المباشرة، احسبها من الأونصة
  if (!gram24 && goldOunceLocal > 0) {
    const calculatedGram24 = goldOunceLocal / 31.1035;
    return {
      XAU_OUNCE: { 
        name: 'أونصة الذهب', 
        price: goldOunceLocal, 
        priceUSD: goldOunceUSD, 
        unit: 'Ounce', 
        icon: '🏆' 
      },
      XAU_24: { 
        name: 'عيار 24', 
        price: calculatedGram24, 
        buyPrice: calculatedGram24 + BACKGROUND_MASNEIYYA['XAU_24'], 
        unit: 'Gram', 
        icon: '🪙' 
      },
      XAU_21: { 
        name: 'عيار 21', 
        price: calculatedGram24 * (21 / 24), 
        buyPrice: calculatedGram24 * (21 / 24) + BACKGROUND_MASNEIYYA['XAU_21'], 
        unit: 'Gram', 
        icon: '🪙' 
      },
      XAU_18: { 
        name: 'عيار 18', 
        price: calculatedGram24 * (18 / 24), 
        buyPrice: calculatedGram24 * (18 / 24) + BACKGROUND_MASNEIYYA['XAU_18'], 
        unit: 'Gram', 
        icon: '🪙' 
      },
      XAG_OUNCE: { 
        name: 'أونصة الفضة', 
        price: silverOunceLocal, 
        priceUSD: silverOunceUSD, 
        unit: 'Ounce', 
        icon: '🥈' 
      },
      XAG_GRAM: { 
        name: 'جرام الفضة', 
        price: silverOunceLocal > 0 ? silverOunceLocal / 31.1035 : 0, 
        unit: 'Gram', 
        icon: '⚪' 
      },
    };
  }

  // استخدام البيانات المباشرة من الملف الثابت
  return {
    XAU_OUNCE: { 
      name: 'أونصة الذهب', 
      price: goldOunceLocal, 
      priceUSD: goldOunceUSD, 
      unit: 'Ounce', 
      icon: '🏆' 
    },
    XAU_24: { 
      name: 'عيار 24', 
      price: gram24, 
      buyPrice: gram24 + BACKGROUND_MASNEIYYA['XAU_24'], 
      unit: 'Gram', 
      icon: '🪙' 
    },
    XAU_21: { 
      name: 'عيار 21', 
      price: gram21, 
      buyPrice: gram21 + BACKGROUND_MASNEIYYA['XAU_21'], 
      unit: 'Gram', 
      icon: '🪙' 
    },
    XAU_18: { 
      name: 'عيار 18', 
      price: gram18, 
      buyPrice: gram18 + BACKGROUND_MASNEIYYA['XAU_18'], 
      unit: 'Gram', 
      icon: '🪙' 
    },
    XAG_OUNCE: { 
      name: 'أونصة الفضة', 
      price: silverOunceLocal, 
      priceUSD: silverOunceUSD, 
      unit: 'Ounce', 
      icon: '🥈' 
    },
    XAG_GRAM: { 
      name: 'جرام الفضة', 
      price: silverGram, 
      unit: 'Gram', 
      icon: '⚪' 
    },
  };
}

/**
 * الوظيفة الرئيسية المسؤولة عن الكاش، استدعاء ملف الجلب، المعالجة، والتخزين
 * مدة الكاش: 30 دقيقة (موحدة مع العملات)
 * forceRefresh يتم تجاهله دائماً لمنع الطلبات المباشرة
 * تم تحسينها للسرعة: استخدام الكاش المحلي أولاً دائماً
 */
export async function getMetalsData(baseCurrency = 'USD', forexRates = {}, forceRefresh = false, customGoldRate = null) {
  const nowTime = Date.now();
  const lastFetchTimeStr = await AsyncStorage.getItem(CACHE_KEYS.METALS_TIME);
  const lastFetchTime = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;

  // التحقق من الفترة الزمنية لقراءة الملف الثابت
  const lastStaticFileRequest = await AsyncStorage.getItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST);
  const timeSinceStaticRequest = lastStaticFileRequest ? nowTime - parseInt(lastStaticFileRequest) : Infinity;

  // إذا مرت أقل من 5 دقائق على آخر قراءة للملف الثابت، استخدم الكاش المحلي فوراً
  if (timeSinceStaticRequest < CACHE_DURATIONS.STATIC_FILE_READ_COOLDOWN) {
    const cachedData = await AsyncStorage.getItem(CACHE_KEYS.METALS);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return { ...parsed, _fromCache: true, _fromLocalCache: true, _lastUpdated: lastFetchTime };
    }
  }

  // أولاً: حاول استخدام الكاش المحلي للسرعة حتى قبل محاولة الشبكة
  const cachedData = await AsyncStorage.getItem(CACHE_KEYS.METALS);
  
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      
      // قراءة من الملف الثابت في الخلفية لتحديث الكاش
      fetchRawMetalsApiData().then(rawApiData => {
        const aggregatedMetals = processMetalsData(rawApiData, baseCurrency, forexRates, customGoldRate);
        AsyncStorage.setItem(CACHE_KEYS.METALS, JSON.stringify(aggregatedMetals));
        AsyncStorage.setItem(CACHE_KEYS.METALS_TIME, Date.now().toString());
        AsyncStorage.setItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST, Date.now().toString());
      }).catch(() => {}); // تجاهل الأخطاء في الخلفية
      
      return { ...parsed, _fromCache: true, _fromLocalCache: true, _lastUpdated: lastFetchTime };
    } catch (e) { /* proceed to fetch */ }
  }

  try {
    // 1. جلب البيانات الخام حصرياً من metalsCore.js
    const rawApiData = await fetchRawMetalsApiData();

    // 2. معالجة وحساب البيانات محلياً
    const aggregatedMetals = processMetalsData(rawApiData, baseCurrency, forexRates, customGoldRate);

    // 3. تخزين النتائج المعالجة في الذاكرة المحلية
    await AsyncStorage.setItem(CACHE_KEYS.METALS, JSON.stringify(aggregatedMetals));
    await AsyncStorage.setItem(CACHE_KEYS.METALS_TIME, nowTime.toString());
    await AsyncStorage.setItem(CACHE_KEYS.LAST_STATIC_FILE_REQUEST, nowTime.toString());

    return { ...aggregatedMetals, _fromCache: false, _lastUpdated: nowTime };
  } catch (error) {
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return { ...parsed, _fromCache: true, _isFallback: true };
      } catch (e) {
        throw error;
      }
    }
    throw error;
  }
}
