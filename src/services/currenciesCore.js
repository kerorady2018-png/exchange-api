import { fetchStaticSnapshot, validRates, validBankRates } from '../api/apiConfig';

export async function fetchCurrenciesFromApi() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const { payload, ...metadata } = await fetchStaticSnapshot({
      timeout: 10000 // 10 ثوانٍ للسماح بشبكات الجوال البطيئة
    });

    if (payload && (payload.currencies || payload.rates)) {
      const currencies = payload.currencies || {};
      const rates = validRates(currencies.rates || payload.rates);
      if (!Object.keys(rates).length) throw new Error('Invalid currency rates');

      // دمج أسعار المعادن المحسوبة إن وجدت
      if (payload.calculatedRates) {
        Object.assign(rates, validRates(payload.calculatedRates));
      }

      // التأكد من وجود عملة USD
      if (!rates['USD']) {
        rates['USD'] = 1;
      }
      
      const banqueMisrRates = validBankRates(currencies.banqueMisrRates || payload.banqueMisrRates);
      const sourceTime = currencies.lastUpdated === undefined ? metadata._lastUpdated : Date.parse(currencies.lastUpdated);
      return {
        ...metadata,
        _lastUpdated: Number.isFinite(sourceTime) ? sourceTime : null,
        _isFallback: !!metadata._isFallback || currencies.status === 'stale' || currencies.status === 'unavailable',
        _bankSnapshotAuthoritative: typeof currencies.banqueMisrStatus === 'string',
        _bmIsFallback: !!metadata._isFallback || currencies.banqueMisrStatus === 'stale',
        rates,
        banqueMisrRates
      };
    }

    // في حالة عدم وجود البيانات، نرجع كائن فارغ
    return {
      rates: {},
      banqueMisrRates: {}
    };
  } catch (error) {
    console.error('Failed to fetch static data:', error);
    throw error;
  }
}