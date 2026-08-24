const axios = require('axios');
const fs = require('fs');
const path = require('path');

// مسارات الملفات
const RATES_FILE = path.join(__dirname, '../public/data/rates.json');
const METADATA_FILE = path.join(__dirname, '../public/data/metadata.json');

// أسعار عملات احتياطية لضمان وجود جميع العملات حتى لو فشل الـ API الخارجي
const DEFAULT_GLOBAL_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.78, EGP: 48.5, SAR: 3.75, AED: 3.67, KWD: 0.31,
  QAR: 3.64, BHD: 0.38, OMR: 0.38, JOD: 0.71, CHF: 0.86, CAD: 1.36, AUD: 1.51, JPY: 154.5, DKK: 6.86, NOK: 10.6, SEK: 10.5, CNY: 7.24
};

// خريطة لربط رموز العملات بأسماء البنك المركزي
const cbeNameMapping = {
  'USD': 'دولار أمريكي',
  'EUR': 'يورو',
  'GBP': 'جنيه إسترليني',
  'CAD': 'دولار كندى',
  'DKK': 'كرون دانمركى',
  'NOK': 'كرون نرويجي',
  'SEK': 'كرون سويدى',
  'CHF': 'فرنك سويسری',
  'SAR': 'ريال سعودى',
  'AED': 'درهم اماراتى',
  'KWD': 'دينار كويتى',
  'QAR': 'ريال قطرى',
  'BHD': 'دينار البحرين',
  'OMR': 'ريال عمانى',
  'JOD': 'دينار اردنی',
  'AUD': 'دولار استرالی',
  'JPY': 'ين يابانی',
  'CNY': 'يوان صيني'
};

const banqueMisrNameMapping = {
  'USD': 'دولار أمريكي',
  'EUR': 'يورو',
  'GBP': 'جنيه إسترليني',
  'SAR': 'ريال سعودى',
  'AED': 'درهم اماراتى',
  'KWD': 'دينار كويتى',
  'QAR': 'ريال قطرى',
  'CHF': 'فرنك سويسري',
  'JPY': 'ين ياباني',
  'CAD': 'دولار كندي',
  'AUD': 'دولار أسترالي',
  'BHD': 'دينار بحريني',
  'OMR': 'ريال عماني',
  'JOD': 'دينار أردني',
  'DKK': 'كرونة دانمركية',
  'NOK': 'كرونة نرويجية',
  'SEK': 'كرونة سويدية',
  'CNY': 'يوان صيني'
};

const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .replace(/[يى]/g, 'ي')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه');
};

const findEntryDeep = (obj, targetCode, targetArabicName) => {
  if (!obj) return null;

  if (obj[targetCode]) return obj[targetCode];
  if (obj[targetCode.toLowerCase()]) return obj[targetCode.toLowerCase()];
  if (obj[targetCode.toUpperCase()]) return obj[targetCode.toUpperCase()];

  const normalizedTargetAr = normalizeArabic(targetArabicName);

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalizeArabic(key);
    
    if (normalizedTargetAr && (normalizedKey === normalizedTargetAr || normalizedKey.includes(normalizedTargetAr) || normalizedTargetAr.includes(normalizedKey))) {
      return value;
    }

    if (value && typeof value === 'object') {
      if (
        value.code === targetCode || 
        value.currency === targetCode || 
        value.symbol === targetCode ||
        normalizeArabic(value.name) === normalizedTargetAr
      ) {
        return value;
      }
    }
  }

  return null;
};

const fetchCurrenciesData = async () => {
  try {
    console.log('Fetching currencies data...');
    const [globalRes, cbeRes, banqueMisrRes] = await Promise.allSettled([
      axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 15000 }),
      axios.get('https://cbe-api.vercel.app/api/rates', { timeout: 15000 }),
      axios.get('https://exchange-api-sepia.vercel.app/api/banquemisr', { timeout: 15000 })
    ]);

    let rawGlobalRates = globalRes.status === 'fulfilled' && globalRes.value.data?.rates 
      ? globalRes.value.data.rates 
      : {};
    
    // الدمج مع العملات الافتراضية لضمان عدم نقص أي عملة
    const globalRates = { ...DEFAULT_GLOBAL_RATES, ...rawGlobalRates };

    const cbeData = cbeRes.status === 'fulfilled' ? cbeRes.value.data.rates || cbeRes.value.data || {} : {};
    
    const rawBm = banqueMisrRes.status === 'fulfilled' ? banqueMisrRes.value.data : null;
    let banqueMisrData = rawBm?.rates || rawBm?.data || rawBm || {};

    if (!banqueMisrData || Object.keys(banqueMisrData).length === 0) {
      banqueMisrData = cbeData;
    }

    const blendedRates = { ...globalRates };
    const allCurrencies = Object.keys(globalRates);

    const cbeUSD = findEntryDeep(cbeData, 'USD', 'دولار أمريكي');
    const bmUSD = findEntryDeep(banqueMisrData, 'USD', 'دولار أمريكي');
    let blendedEgpRate = Number(globalRates['EGP']) || 48.5;

    let usdPriceSources = [];
    if (globalRates['EGP']) usdPriceSources.push(Number(globalRates['EGP']));
    
    const usdBuy = cbeUSD?.buy || cbeUSD?.purchase;
    const usdSell = cbeUSD?.sell || cbeUSD?.sale;
    if (usdBuy && usdSell) usdPriceSources.push((Number(usdBuy) + Number(usdSell)) / 2);

    const bmUsdBuy = bmUSD?.buy || bmUSD?.purchase;
    const bmUsdSell = bmUSD?.sell || bmUSD?.sale;
    if (bmUsdBuy && bmUsdSell) usdPriceSources.push((Number(bmUsdBuy) + Number(bmUsdSell)) / 2);

    if (usdPriceSources.length > 0) {
      blendedEgpRate = usdPriceSources.reduce((sum, val) => sum + val, 0) / usdPriceSources.length;
      blendedRates['EGP'] = blendedEgpRate;
    }

    allCurrencies.forEach((code) => {
      if (code === 'USD' || code === 'EGP') return;

      const globalRateForCode = Number(globalRates[code]);
      const arabicName = cbeNameMapping[code];
      const cbeEntry = findEntryDeep(cbeData, code, arabicName);
      const bmEntry = findEntryDeep(banqueMisrData, code, banqueMisrNameMapping[code] || arabicName);

      if (blendedRates['EGP'] && globalRateForCode) {
        const globalEgpPrice = blendedRates['EGP'] / globalRateForCode;
        let priceSources = [globalEgpPrice];

        const cbeBuy = cbeEntry?.buy || cbeEntry?.purchase;
        const cbeSell = cbeEntry?.sell || cbeEntry?.sale;
        if (cbeBuy && cbeSell) {
          priceSources.push((Number(cbeBuy) + Number(cbeSell)) / 2);
        }

        const bmBuy = bmEntry?.buy || bmEntry?.purchase;
        const bmSell = bmEntry?.sell || bmEntry?.sale;
        if (bmBuy && bmSell) {
          priceSources.push((Number(bmBuy) + Number(bmSell)) / 2);
        }

        const targetEgpPrice = priceSources.reduce((sum, val) => sum + val, 0) / priceSources.length;
        blendedRates[code] = blendedEgpRate / targetEgpPrice;
      }
    });

    const formattedBmMap = {};
    for (const [code, arabicName] of Object.entries(banqueMisrNameMapping)) {
      let entry = findEntryDeep(banqueMisrData, code, arabicName) || findEntryDeep(cbeData, code, arabicName);
      
      if (entry) {
        let buyVal = entry.buy !== undefined ? entry.buy : (entry.purchase !== undefined ? entry.purchase : null);
        let sellVal = entry.sell !== undefined ? entry.sell : (entry.sale !== undefined ? entry.sale : null);

        const baseRate = blendedRates[code];
        if (baseRate) {
          if (buyVal === null || isNaN(Number(buyVal))) buyVal = baseRate * 0.995;
          if (sellVal === null || isNaN(Number(sellVal))) sellVal = baseRate * 1.005;

          formattedBmMap[code] = {
            buy: Number(Number(buyVal).toFixed(4)),
            sell: Number(Number(sellVal).toFixed(4))
          };
        }
      }
    }

    console.log('Currencies data fetched successfully');
    return {
      rates: blendedRates,
      banqueMisrRates: formattedBmMap
    };
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return { rates: DEFAULT_GLOBAL_RATES, banqueMisrRates: {} };
  }
};

const fetchMetalsData = async () => {
  try {
    console.log('Fetching metals data...');
    const [goldRes, silverRes] = await Promise.allSettled([
      axios.get('https://api.gold-api.com/price/XAU', { timeout: 15000 }),
      axios.get('https://api.gold-api.com/price/XAG', { timeout: 15000 })
    ]);

    const goldPrice = goldRes.status === 'fulfilled' && goldRes.value.data?.price ? Number(goldRes.value.data.price) : 2600;
    const silverPrice = silverRes.status === 'fulfilled' && silverRes.value.data?.price ? Number(silverRes.value.data.price) : 30;

    console.log('Metals data fetched successfully');
    return {
      goldData: { price: goldPrice, data: { price: goldPrice } },
      silverData: { price: silverPrice, data: { price: silverPrice } }
    };
  } catch (error) {
    console.error('Error fetching metals:', error);
    return {
      goldData: { price: 2600, data: { price: 2600 } },
      silverData: { price: 30, data: { price: 30 } }
    };
  }
};

const saveData = (data) => {
  try {
    fs.writeFileSync(RATES_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Data saved to rates.json');
    
    const metadata = {
      lastCurrenciesUpdate: new Date().toISOString(),
      lastMetalsUpdate: new Date().toISOString(),
      lastFullUpdate: new Date().toISOString(),
      status: 'success',
      version: '1.0.0'
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    console.log('Metadata updated');
    
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
};

const main = async () => {
  try {
    console.log('Starting data fetcher...');
    console.log('================================');
    
    const [currenciesData, metalsData] = await Promise.allSettled([
      fetchCurrenciesData(),
      fetchMetalsData()
    ]);

    const finalCurrencies = currenciesData.status === 'fulfilled' ? currenciesData.value : { rates: DEFAULT_GLOBAL_RATES, banqueMisrRates: {} };
    const finalMetals = metalsData.status === 'fulfilled' ? metalsData.value : { goldData: { price: 2600 }, silverData: { price: 30 } };

    let goldOunceUSD = 2600;
    let silverOunceUSD = 30;
    
    if (finalMetals.goldData && (finalMetals.goldData.price || finalMetals.goldData.data?.price)) {
      goldOunceUSD = Number(finalMetals.goldData.price || finalMetals.goldData.data.price);
    }
    if (finalMetals.silverData && (finalMetals.silverData.price || finalMetals.silverData.data?.price)) {
      silverOunceUSD = Number(finalMetals.silverData.price || finalMetals.silverData.data.price);
    }

    const gram24USD = goldOunceUSD / 31.1035;
    const gram21USD = gram24USD * (21 / 24);
    const gram18USD = gram24USD * (18 / 24);
    const silverGramUSD = silverOunceUSD / 31.1035;

    finalCurrencies.rates['XAU_24'] = gram24USD;
    finalCurrencies.rates['XAU_21'] = gram21USD;
    finalCurrencies.rates['XAU_18'] = gram18USD;
    finalCurrencies.rates['XAG_GRAM'] = silverGramUSD;

    // هيكلة بيانات المعادن بخصائص مكتملة يسهل قراءتها من التطبيق
    const structuredMetals = {
      goldData: {
        price_gram_24k: gram24USD,
        price_gram_21k: gram21USD,
        price_gram_18k: gram18USD,
        price_ounce: goldOunceUSD
      },
      silverData: {
        price_gram: silverGramUSD,
        price_ounce: silverOunceUSD
      }
    };

    const finalData = {
      currencies: finalCurrencies,
      metals: structuredMetals,
      calculatedRates: {
        XAU_24: gram24USD,
        XAU_21: gram21USD,
        XAU_18: gram18USD,
        XAG_GRAM: silverGramUSD
      },
      lastUpdated: new Date().toISOString(),
      status: 'success'
    };

    const saved = saveData(finalData);
    
    if (saved) {
      console.log('================================');
      console.log('✅ Data fetch completed successfully!');
      console.log(`Last updated: ${finalData.lastUpdated}`);
      console.log('================================');
    } else {
      console.log('❌ Failed to save data');
    }
    
  } catch (error) {
    console.error('================================');
    console.error('❌ Fatal error in data fetcher:', error);
    console.error('================================');
    
    try {
      const metadata = {
        lastCurrenciesUpdate: null,
        lastMetalsUpdate: null,
        lastFullUpdate: new Date().toISOString(),
        status: 'error',
        error: error.message,
        version: '1.0.0'
      };
      fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (metadataError) {
      console.error('Failed to save error metadata:', metadataError);
    }
    
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main, fetchCurrenciesData, fetchMetalsData };