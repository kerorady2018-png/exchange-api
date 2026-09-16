import { fetchStaticSnapshot, validRates, validBankRates } from '../api/apiConfig';

/**
 * جلب البيانات الخام من endpoint الملف الثابت api/static-data فقط
 */
export async function fetchRawMetalsApiData() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const { payload, ...metadata } = await fetchStaticSnapshot({
      timeout: 10000 // 10 ثوانٍ للسماح بشبكات الجوال البطيئة
    });

    if (payload) {
      const metals = payload.metals || payload.data?.metals || {};
      const calculatedRates = validRates(payload.calculatedRates || payload.currencies?.rates);
      const currencyRates = validRates(payload.currencies?.rates || payload.rates);

      // بناء بيانات الذهب من الهياكل المختلفة الممكنة
      let goldData = metals.goldData || metals.gold || payload.goldData;

      // منطق ملء البيانات إذا كانت ناقصة (Auto-recovery) من calculatedRates
      if (!goldData && (calculatedRates.XAU_24 || calculatedRates.XAU_21)) {
        goldData = {
          price_gram_24k: calculatedRates.XAU_24,
          price_gram_21k: calculatedRates.XAU_21,
          price_gram_18k: calculatedRates.XAU_18,
          price_ounce: calculatedRates.XAU_24 ? calculatedRates.XAU_24 * 31.1035 : null
        };
      }

      let silverData = metals.silverData || metals.silver || payload.silverData;
      if (!silverData && calculatedRates.XAG_GRAM) {
        silverData = {
          price_gram: calculatedRates.XAG_GRAM,
          price_ounce: calculatedRates.XAG_GRAM * 31.1035
        };
      }

      const sourceTime = metals.lastUpdated === undefined ? metadata._lastUpdated : Date.parse(metals.lastUpdated);
      return {
        ...metadata,
        _lastUpdated: Number.isFinite(sourceTime) ? sourceTime : null,
        _isFallback: !!metadata._isFallback || ['stale', 'partial', 'unavailable'].includes(metals.status) || payload.currencies?.status === 'stale',
        goldData: goldData || null,
        silverData: silverData || null,
        cbeData: {},
        globalRates: currencyRates || {},
        currenciesData: { rates: currencyRates, banqueMisrRates: validBankRates(payload.currencies?.banqueMisrRates || payload.banqueMisrRates) }
      };
    }

    // في حالة عدم وجود البيانات، نرجع كائن فارغ
    return {
      goldData: null,
      silverData: null,
      cbeData: {},
      globalRates: {},
      currenciesData: { rates: {}, banqueMisrRates: {} }
    };
  } catch (error) {
    console.error('Failed to fetch static data:', error);
    throw error;
  }
}