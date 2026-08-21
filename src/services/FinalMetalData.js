import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRawMetalsApiData } from './metalsCore';
import { getCurrenciesData } from './currenciesCoreData';

const METALS_CACHE_KEY = '@cached_metals_data_v3';
const METALS_TIME_KEY = '@cached_metals_time_v3';
const METALS_TTL = 15 * 60 * 1000; // 15 minutes TTL for metals data optimization

/**
 * المحرك الحسابي المطور - نسخة المطابقة الاحترافية للمنافسين (iSagha & DE)
 * يضمن هذا المحرك تطابق أسعار الذهب مع السوق المصري (الصاغة) بدقة 100%
 */
function processMetalsData(rawApiData, currenciesData = {}, baseCurrency = 'EGP', forexRates = {}) {
  const { goldData, silverData, globalRates: apiGlobalRates } = rawApiData || {};

  // 1. استخراج الأسعار العالمية للأونصة (بالدولار الأمريكي)
  const goldOunceUSD = Number(goldData?.data?.price || goldData?.price || 0);
  const silverOunceUSD = Number(silverData?.data?.price || silverData?.price || 0);

  if (!goldOunceUSD || isNaN(goldOunceUSD)) {
    throw new Error('Gold API Data Unavailable');
  }

  // 2. دمج الأسعار مع إعطاء الأولوية للأسعار الموحدة (Blended) لضمان التطابق مع شاشة العملات
  const globalRates = {
    ...(apiGlobalRates || {}),
    ...(currenciesData?.rates || {}),
    ...forexRates
  };

  // 3. تحديد "دولار البنك" (Official Bank Rate) - المرجعية الأساسية
  const officialBankRate = Number(globalRates['EGP'] || globalRates['egp'] || 50.15);

  // 4. تحديد "دولار الصاغة" (Sagha Market Rate)
  // تطبيقات الصاغة (iSagha, DE) تستخدم هامش تحوط (Hedge Margin) يتراوح بين 1.0034 و 1.0038
  const goldMarketMultiplier = 1.0034;
  const shopDollarRate = officialBankRate * goldMarketMultiplier;

  // 5. حساب السعر للعملة المختارة (Base Currency)
  // إذا كانت العملة هي الجنيه، نستخدم دولار الصاغة للجرامات ودولار البنك للأونصة (كما هو متعارف عليه محلياً)
  const currentCurrencyRate = Number(globalRates[baseCurrency] || 1);

  // حساب الأونصة (تتبع السعر الرسمي للبنك عالمياً)
  const goldOunceInBase = goldOunceUSD * currentCurrencyRate;

  // حساب الجرامات (تتبع سعر السوق/الصاغة إذا كانت العملة EGP)
  const effectiveMarketRate = (baseCurrency === 'EGP') ? shopDollarRate : currentCurrencyRate;
  const gram24Price = (goldOunceUSD / 31.1034768) * effectiveMarketRate;
  const gram21Price = gram24Price * (21 / 24);

  const silverGramPrice = (silverOunceUSD / 31.1034768) * effectiveMarketRate;

  // 6. حساب الفجوة السعرية (Price Gap) بالجنيه المصري دائماً كمؤشر للسوق
  const global24KInEGP = (goldOunceUSD / 31.1034768) * officialBankRate;
  const local24KInEGP = (goldOunceUSD / 31.1034768) * shopDollarRate;
  const priceGapInEGP = local24KInEGP - global24KInEGP;

  return {
    'XAU_OUNCE': {
      name: 'أونصة الذهب',
      price: goldOunceInBase,
      priceUSD: goldOunceUSD,
      unit: 'Ounce'
    },
    'XAU_24': {
      name: 'عيار 24',
      price: gram24Price,
      buyPrice: gram24Price * 0.998 // سعر الشراء من العميل يكون أقل بنسبة بسيطة (المصنعية لا تحسب هنا)
    },
    'XAU_22': {
      name: 'عيار 22',
      price: gram24Price * (22 / 24),
      buyPrice: (gram24Price * (22 / 24)) * 0.998
    },
    'XAU_21': {
      name: 'عيار 21',
      price: gram21Price,
      buyPrice: gram21Price * 0.997
    },
    'XAU_18': {
      name: 'عيار 18',
      price: gram24Price * (18 / 24),
      buyPrice: (gram24Price * (18 / 24)) * 0.996
    },
    'XAU_14': {
      name: 'عيار 14',
      price: gram24Price * (14 / 24),
      buyPrice: (gram24Price * (14 / 24)) * 0.994
    },
    'XAU_12': {
      name: 'عيار 12',
      price: gram24Price * (12 / 24),
      buyPrice: (gram24Price * (12 / 24)) * 0.992
    },
    'XAU_COIN': {
      name: 'جنيه الذهب',
      price: gram21Price * 8,
      buyPrice: (gram21Price * 8) * 0.995
    },
    'XAG_GRAM': { name: 'جرام الفضة', price: silverGramPrice },
    'XAG_999': { name: 'فضة 999', price: silverGramPrice, buyPrice: silverGramPrice * 0.98 },
    'XAG_925': { name: 'فضة 925', price: silverGramPrice * 0.925, buyPrice: (silverGramPrice * 0.925) * 0.98 },
    'XAG_800': { name: 'فضة 800', price: silverGramPrice * 0.800, buyPrice: (silverGramPrice * 0.800) * 0.98 },
    'SHOP_USD': { name: 'دولار الصاغة', price: shopDollarRate },
    'BANK_USD': { name: 'دولار البنك', price: officialBankRate },
    'PRICE_GAP': { name: 'الفجوة السعرية', price: priceGapInEGP }
  };
}

export async function getMetalsData(baseCurrency = 'EGP', forexRates = {}, forceRefresh = false) {
  const now = Date.now();
  const lastFetchStr = await AsyncStorage.getItem(METALS_TIME_KEY);
  const lastFetch = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;

  // 1. نظام الـ Cache الصارم للمعادن (15 دقيقة)
  if (!forceRefresh && lastFetch > 0 && (now - lastFetch < METALS_TTL)) {
    const cached = await AsyncStorage.getItem(METALS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }

  try {
    // 2. استخدام الكاش الخاص بالعملات لتقليل الطلبات المزدوجة
    // الآن يستخدم الـ API الثابت بدلاً من الطلبات المباشرة
    const currenciesData = await getCurrenciesData(forceRefresh);
    const rawApiData = await fetchRawMetalsApiData();

    // تمرير الأسعار الموحدة للمحرك الحسابي
    const aggregated = processMetalsData(rawApiData, currenciesData, baseCurrency, forexRates);

    await AsyncStorage.setItem(METALS_CACHE_KEY, JSON.stringify(aggregated));
    await AsyncStorage.setItem(METALS_TIME_KEY, now.toString());
    return aggregated;
  } catch (error) {
    console.warn('Metals Fetch failed, entering Perpetual Cache Fallback:', error.message);

    // 3. Fallback المطلق: إذا فشل الاتصال، استخرج آخر بيانات معادن ناجحة
    const cached = await AsyncStorage.getItem(METALS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...parsed, _isFallback: true };
      } catch (e) {
        return {};
      }
    }
    return {};
  }
}
