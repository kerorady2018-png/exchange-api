// الخلفيات الثابتة للمصنعية
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
 * حساب و معالجة أسعار المعادن والأعيرة ودولار الصاغة بدقة كاملة
 * @param {Object} rawApiData - البيانات الخام القادمة من metalsCoreData.js
 * @param {Object} currenciesData - بيانات وأسعار العملات القادمة من currenciesCoreData.js
 * @param {String} baseCurrency - العملة الأساسية للتطبيق (مثل EGP أو USD)
 * @param {Number|null} customGoldRate - سعر ذهب مخصص إن وجد
 */
export function calculateMetalsData(rawApiData, currenciesData = {}, baseCurrency = 'USD', customGoldRate = null) {
  const { goldData, silverData, cbeData, globalRates: apiGlobalRates } = rawApiData || {};

  const goldOunceUSD = Number(goldData?.data?.price) || 0;
  const silverOunceUSD = Number(silverData?.data?.price) || 0;
  
  // دمج أسعار العملات العالمية المتاحة من المصدرين
  const globalRates = {
    ...(currenciesData?.rates || {}),
    ...(apiGlobalRates || {})
  };

  // 1. حساب سعر الصرف الرسمي البحت (خاص بالأونصات العالمية)
  let officialUsdToBaseRate = 1;
  if (baseCurrency !== 'USD') {
    if (globalRates[baseCurrency] && globalRates['USD']) {
      officialUsdToBaseRate = globalRates[baseCurrency] / globalRates['USD'];
    } else {
      officialUsdToBaseRate = globalRates[baseCurrency] || 1;
    }
  }

  const goldOunceLocal = goldOunceUSD * officialUsdToBaseRate;
  const silverOunceLocal = silverOunceUSD * officialUsdToBaseRate;

  // 2. حساب سعر الصرف المحلي الخاص بسوق الصاغة والأعيرة والسبائك
  let usdToBasePathRate = officialUsdToBaseRate;
  if (baseCurrency !== 'USD') {
    if (baseCurrency === 'EGP') {
      if (customGoldRate) {
        usdToBasePathRate = customGoldRate;
      } else {
        const cbeUSD = findCbeEntry(cbeData, 'دولار أمريكي') || findCbeEntry(currenciesData?.cbeData, 'دولار أمريكي');
        let baseEgp = globalRates['EGP'] || 51.27;

        if (cbeUSD && cbeUSD.buy && cbeUSD.sell && globalRates['EGP']) {
          baseEgp = (globalRates['EGP'] + cbeUSD.buy + cbeUSD.sell) / 3;
        }

        const goldMarketMultiplier = 1.0143; 
        usdToBasePathRate = baseEgp * goldMarketMultiplier;
      }
    } else {
      usdToBasePathRate = officialUsdToBaseRate;
    }
  }

  const goldOunceLocalForGrams = goldOunceUSD * usdToBasePathRate;
  const gram24 = goldOunceLocalForGrams > 0 ? goldOunceLocalForGrams / 31.1035 : 0;
  const gram21 = gram24 > 0 ? gram24 * (21 / 24) : 0;
  const gram18 = gram24 > 0 ? gram24 * (18 / 24) : 0;
  const silverGram = silverOunceLocal > 0 ? silverOunceLocal / 31.1035 : 0;

  // حساب سعر Shop Dollar (دولار الصاغة الفعلي) بدقة
  const shopDollarPrice = (gram21 > 0 && goldOunceUSD > 0) ? gram21 / ((goldOunceUSD / 31.1035) * (21 / 24)) : (usdToBasePathRate || 0);

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
    SHOP_USD: {
      name: 'دولار الصاغة',
      price: shopDollarPrice,
      unit: 'USD',
      icon: '💵'
    }
  };
}
