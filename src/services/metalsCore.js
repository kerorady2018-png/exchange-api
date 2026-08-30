import axios from 'axios';
import { apiClient } from '../api/apiConfig';
import { withRetry } from '../utils/networkUtils';

/**
 * جلب البيانات الخام من endpoint الملف الثابت api/static-data فقط
 */
export async function fetchRawMetalsApiData() {
  try {
    // قراءة من endpoint الملف الثابت api/static-data فقط
    const response = await withRetry(() => apiClient.get('/api/static-data', {
      timeout: 8000, // تقليل من 15 ثانية إلى 8 ثواني للسرعة
      headers: { 'Cache-Control': 'public, max-age=60' }
    }));

    const payload = response.data?.data || response.data;

    if (payload) {
      const metals = payload.metals || payload.data?.metals || {};
      const calculatedRates = payload.calculatedRates || payload.currencies?.rates || payload.data?.currencies?.rates || {};

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

      if (goldData || silverData) {
        return {
          goldData: goldData || null,
          silverData: silverData || null,
          cbeData: {},
          globalRates: {}
        };
      }
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