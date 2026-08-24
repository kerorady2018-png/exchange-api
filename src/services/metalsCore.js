import axios from 'axios';
import { apiClient, STATIC_DATA_URL } from '../api/apiConfig';
import { withRetry } from '../utils/networkUtils';

/**
 * جلب البيانات الخام من endpoint الملف الثابت api/static-data فقط
 */
export async function fetchRawMetalsApiData() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const response = await withRetry(() => apiClient.get('/api/static-data', {
      timeout: 15000,
      headers: { 'Cache-Control': 'public, max-age=60' }
    }));

    if (response.data && response.data.metals) {
      const { metals } = response.data;
      return {
        goldData: metals.goldData || null,
        silverData: metals.silverData || null,
        cbeData: {},
        globalRates: {}
      };
    }

    // في حالة عدم وجود البيانات، نرجع كائن فارغ
    return {
      goldData: null,
      silverData: null,
      cbeData: {},
      globalRates: {}
    };
  } catch (error) {
    console.error('Failed to fetch static data:', error);
    throw error;
  }
}
