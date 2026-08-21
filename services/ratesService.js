import axios from 'axios';
import { apiClient, STATIC_DATA_URL, CACHE_KEYS, CACHE_DURATION } from '../api/apiConfig';

export const getRates = async () => {
  try {
    // استخدام الـ API الثابت المحسّن
    const response = await apiClient.get('/static-data.json', {
      timeout: 15000,
      headers: { 'Cache-Control': 'public, max-age=60' } // 60 ثانية
    });
    
    if (response.data && response.data.success && response.data.data) {
      const { currencies, calculatedRates } = response.data.data;
      
      // دمج البيانات المحسوبة مع البيانات الأساسية
      const fetchedRates = { ...currencies.rates };
      
      // إضافة أسعار الذهب والفضة المحسوبة
      if (calculatedRates) {
        Object.keys(calculatedRates).forEach(key => {
          fetchedRates[key] = calculatedRates[key];
        });
      }

      // التأكد من وجود عملة الأساس USD
      if (!fetchedRates['USD']) {
        fetchedRates['USD'] = 1;
      }

      return fetchedRates;
    }

    // Fallback إلى الـ API القديم
    return await getRatesLegacy();
  } catch (error) {
    // Silent fallback to legacy API
    return await getRatesLegacy();
  }
};

// الدالة القديمة كـ fallback
async function getRatesLegacy() {
  try {
    const response = await apiClient.get('/api/rates');
    
    // دعم كلا الشكلين لاستجابة الـ API (سواء كانت البيانات مباشرة أو داخل مفتاح rates)
    const rawData = response.data;
    let fetchedRates = {};
    if (rawData) {
      if (rawData.rates && typeof rawData.rates === 'object') {
        fetchedRates = { ...rawData.rates };
      } else if (typeof rawData === 'object') {
        fetchedRates = { ...rawData };
      }
    }

    let goldOunceUSD = 2600;
    let silverOunceUSD = 30;
    try {
      const [goldRes, silverRes] = await Promise.all([
        axios.get('https://api.gold-api.com/price/XAU', { timeout: 15000 }).catch(() => null),
        axios.get('https://api.gold-api.com/price/XAG', { timeout: 15000 }).catch(() => null)
      ]);
      if (goldRes && goldRes.data && goldRes.data.price) {
        goldOunceUSD = Number(goldRes.data.price);
      }
      if (silverRes && silverRes.data && silverRes.data.price) {
        silverOunceUSD = Number(silverRes.data.price);
      }
    } catch (e) {}

    const gram24USD = goldOunceUSD / 31.1035;
    const gram21USD = gram24USD * (21 / 24);
    const gram18USD = gram24USD * (18 / 24);
    const silverGramUSD = silverOunceUSD / 31.1035;

    fetchedRates['XAU_24'] = gram24USD;
    fetchedRates['XAU_21'] = gram21USD;
    fetchedRates['XAU_18'] = gram18USD;
    fetchedRates['XAG_GRAM'] = silverGramUSD;

    // التأكد من وجود عملة الأساس USD
    if (!fetchedRates['USD']) {
      fetchedRates['USD'] = 1;
    }

    return fetchedRates;
  } catch (error) {
    console.error('Error fetching rates service:', error);
    throw error;
  }
}
