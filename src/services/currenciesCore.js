import axios from 'axios';
import { apiClient } from '../api/apiConfig';
import { withRetry } from '../utils/networkUtils';

export async function fetchCurrenciesFromApi() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const response = await withRetry(() => apiClient.get('/api/static-data', {
      timeout: 8000, // تقليل من 15 ثانية إلى 8 ثواني للسرعة
      headers: { 'Cache-Control': 'public, max-age=60' } // 60 ثانية
    }));

    const payload = response.data?.data || response.data;

    if (payload && (payload.currencies || payload.rates)) {
      const currencies = payload.currencies || {};
      const rates = { ...(currencies.rates || payload.rates || {}) };

      // دمج أسعار المعادن المحسوبة إن وجدت
      if (payload.calculatedRates) {
        Object.assign(rates, payload.calculatedRates);
      }

      // التأكد من وجود عملة USD
      if (!rates['USD']) {
        rates['USD'] = 1;
      }
      
      return {
        rates: rates,
        banqueMisrRates: currencies.banqueMisrRates || payload.banqueMisrRates || {}
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