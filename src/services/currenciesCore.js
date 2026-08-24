import axios from 'axios';
import { apiClient } from '../api/apiConfig';
import { withRetry } from '../utils/networkUtils';

export async function fetchCurrenciesFromApi() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const response = await withRetry(() => apiClient.get('/api/static-data', {
      timeout: 15000,
      headers: { 'Cache-Control': 'public, max-age=60' } // 60 ثانية
    }));

    if (response.data && response.data.currencies) {
      const { currencies } = response.data;
      
      return {
        rates: currencies.rates || {},
        banqueMisrRates: currencies.banqueMisrRates || {}
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
