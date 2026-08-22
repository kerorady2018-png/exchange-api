import axios from 'axios';
import { apiClient } from '../api/apiConfig';
import { withRetry } from '../utils/networkUtils';

/**
 * جلب البيانات الخام من الملف الثابت static-data.json فقط
 */
export async function fetchRawMetalsApiData() {
  try {
    // قراءة من الملف الثابت static-data.json فقط
    const response = await withRetry(() => apiClient.get('/static-data.json', {
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
