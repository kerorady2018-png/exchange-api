import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_KEYS } from '../constants/cacheKeys';

/**
 * دالة ذكية لتتبع تاريخ قيمة المحفظة بشكل صامت ودقيق مرتبط بالأصول
 */
export const trackPortfolioValue = async (currentTotalValue, assets = [], currencyRates = {}, metalRates = {}, baseCurrency = 'USD') => {
  try {
    const today = new Date().toISOString().split('T')[0]; // صيغة YYYY-MM-DD
    const lastTrackDate = await AsyncStorage.getItem(CACHE_KEYS.LAST_TRACK_DATE);

    // إذا تم التسجيل اليوم بالفعل، لا تفعل شيئاً (نقطة واحدة لكل يوم)
    if (lastTrackDate === today) return;

    // 1. تتبع القيمة الإجمالية للمحفظة
    const historyData = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_HISTORY);
    let history = historyData ? JSON.parse(historyData) : [];

    // حساب القيمة الحقيقية بناءً على الأصول الحالية
    const realCurrentValue = calculateRealPortfolioValue(assets, currencyRates, metalRates, baseCurrency);

    const newPoint = {
      date: today,
      value: parseFloat(realCurrentValue) || 0,
      timestamp: Date.now(),
      assetsCount: assets.length // تتبع عدد الأصول أيضاً
    };

    // الاحتفاظ بآخر 365 نقطة (سنة كاملة)
    history = [newPoint, ...history].slice(0, 365);
    await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_HISTORY, JSON.stringify(history));

    // 2. تتبع كل أصل بشكل منفصل لرسم بياني دقيق
    for (const asset of assets) {
      await trackIndividualAsset(asset, currencyRates, metalRates, baseCurrency, today);
    }

    await AsyncStorage.setItem(CACHE_KEYS.LAST_TRACK_DATE, today);
    console.log('[HistoryTracker] Portfolio and assets tracked for:', today);
  } catch (error) {
    console.error('[HistoryTracker] Failed to track value:', error);
  }
};

/**
 * حساب القيمة الحقيقية للمحفظة بناءً على الأصول والأسعار الحالية
 */
function calculateRealPortfolioValue(assets, currencyRates, metalRates, baseCurrency) {
  return assets.reduce((total, asset) => {
    const rate = getRateForAsset(asset.currency, currencyRates, metalRates, baseCurrency);
    return total + (asset.amount * rate);
  }, 0);
}

/**
 * الحصول على سعر الأصل بناءً على نوعه
 */
function getRateForAsset(assetKey, currRates, metRates, targetBaseCurr) {
  if (!assetKey) return 0;
  const upperAssetKey = assetKey.toUpperCase();
  const upperTargetBase = targetBaseCurr ? targetBaseCurr.toUpperCase() : 'USD';

  if (upperAssetKey === upperTargetBase) return 1;

  const isMetalAsset = upperAssetKey.startsWith('XAU') || upperAssetKey.startsWith('XAG');

  if (isMetalAsset) {
    let priceInAppBase = 0;
    const base24 = metRates['XAU_24'] || 0;
    const baseSilver = metRates['XAG_GRAM'] || 0;

    if (upperAssetKey.startsWith('XAU_INGOT_')) {
      const weight = Number(upperAssetKey.replace('XAU_INGOT_', '').replace('_', '.'));
      priceInAppBase = base24 * weight;
    } else {
      switch (upperAssetKey) {
        case 'XAU_24': priceInAppBase = base24; break;
        case 'XAU_22': priceInAppBase = base24 * (22 / 24); break;
        case 'XAU_21': priceInAppBase = base24 * (21 / 24); break;
        case 'XAU_18': priceInAppBase = base24 * (18 / 24); break;
        case 'XAU_14': priceInAppBase = base24 * (14 / 24); break;
        case 'XAU_COIN': priceInAppBase = base24 * (21 / 24) * 8; break;
        case 'XAG_GRAM': case 'XAG_999': priceInAppBase = baseSilver; break;
        default: priceInAppBase = Number(metRates[upperAssetKey]) || 0;
      }
    }

    if (upperTargetBase === baseCurrency.toUpperCase()) {
      return priceInAppBase;
    } else {
      const rateToTarget = (currRates[upperTargetBase] || 1) / (currRates[baseCurrency.toUpperCase()] || 1);
      return priceInAppBase * rateToTarget;
    }
  } else {
    const targetRate = currRates[upperTargetBase] || 1;
    const assetRate = currRates[upperAssetKey] || 0;
    if (!assetRate) return 0;
    return targetRate / assetRate;
  }
}

/**
 * تتبع أصل فردي بشكل منفصل
 */
async function trackIndividualAsset(asset, currencyRates, metalRates, baseCurrency, today) {
  try {
    const assetKey = `${CACHE_KEYS.ASSET_HISTORY_PREFIX}${asset.id}`;
    const assetHistoryData = await AsyncStorage.getItem(assetKey);
    let assetHistory = assetHistoryData ? JSON.parse(assetHistoryData) : [];

    // حساب القيمة الحقيقية للأصل في هذا اليوم
    const currentValue = getRateForAsset(asset.currency, currencyRates, metalRates, baseCurrency) * asset.amount;

    const newAssetPoint = {
      date: today,
      value: parseFloat(currentValue) || 0,
      timestamp: Date.now(),
      amount: asset.amount,
      currency: asset.currency
    };

    // الاحتفاظ بتاريخ الأصل (365 نقطة)
    assetHistory = [newAssetPoint, ...assetHistory].slice(0, 365);
    await AsyncStorage.setItem(assetKey, JSON.stringify(assetHistory));
  } catch (error) {
    console.error('[HistoryTracker] Failed to track individual asset:', error);
  }
}

/**
 * جلب بيانات التاريخ للمحفظة مع فترات زمنية دقيقة
 */
export const getPortfolioHistory = async (timeframe = '1M') => {
  try {
    const historyData = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_HISTORY);
    let history = historyData ? JSON.parse(historyData) : [];

    if (history.length === 0) {
      return [];
    }

    // ترتيب من الأقدم إلى الأحدث
    history = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

    // تصفية حسب الفترة الزمنية المطلوبة
    const filteredHistory = filterHistoryByTimeframe(history, timeframe);

    // إعادة صياغة البيانات للرسم البياني
    return filteredHistory.map(point => ({
      value: point.value,
      date: point.date,
      label: formatChartLabel(point.date, timeframe)
    }));
  } catch (error) {
    console.error('[HistoryTracker] Failed to get history:', error);
    return [];
  }
};

/**
 * تصفية البيانات حسب الفترة الزمنية
 */
function filterHistoryByTimeframe(history, timeframe) {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case '1W':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1M':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3M':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6M':
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '9M':
      startDate = new Date(now.getTime() - 270 * 24 * 60 * 60 * 1000);
      break;
    case '1Y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'ALL':
      // إرجاع كل البيانات من الأقدم
      return history;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return history.filter(point => new Date(point.date) >= startDate);
}

/**
 * تنسيق التسميات للرسم البياني حسب الفترة
 */
function formatChartLabel(dateString, timeframe) {
  const date = new Date(dateString);

  switch (timeframe) {
    case '1W':
      // عرض اليوم من الأسبوع (السبت، الأحد، etc.)
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    case '1M':
      // عرض رقم اليوم (1، 2، 3، etc.)
      return date.getDate().toString();
    case '3M':
    case '6M':
    case '9M':
      // عرض الشهر والسنة (يناير 2026)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    case '1Y':
      // عرض الشهر فقط (يناير، فبراير، etc.)
      return date.toLocaleDateString('en-US', { month: 'short' });
    case 'ALL':
      // لا تسميات في حالة "الكل"
      return '';
    default:
      return date.getDate().toString();
  }
}

/**
 * التحقق من كفاية البيانات التاريخية لفترة زمنية معينة
 */
export const isHistoryDataSufficient = (historyLength, timeframe) => {
  const requiredDays = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '9M': 270,
    '1Y': 365,
    'ALL': 0 // لا يحتاج حد أدنى في حالة "الكل"
  };

  const required = requiredDays[timeframe] || 30;
  
  // في حالة "الكل"، أي بيانات كافية
  if (timeframe === 'ALL') return { sufficient: true, message: '' };
  
  // التحقق من كفاية البيانات
  if (historyLength >= required) {
    return { sufficient: true, message: '' };
  }
  
  // حساب النقص
  const missingDays = required - historyLength;
  const missingPeriod = getMissingPeriodMessage(missingDays, timeframe);
  
  return {
    sufficient: false,
    message: `بيانات غير كافية: ${missingPeriod}. يرجى الانتظار لمدة ${missingPeriod} أخرى لعرض الرسم البياني الدقيق.`
  };
};

/**
 * تحويل عدد الأيام الناقصة إلى رسالة واضحة
 */
function getMissingPeriodMessage(missingDays, timeframe) {
  if (missingDays <= 7) return `${missingDays} أيام`;
  if (missingDays <= 30) return `${Math.ceil(missingDays / 7)} أسابيع`;
  if (missingDays <= 90) return `${Math.ceil(missingDays / 30)} شهر`;
  if (missingDays <= 365) return `${Math.ceil(missingDays / 30)} شهور`;
  return `${Math.ceil(missingDays / 365)} سنة`;
}

/**
 * جلب بيانات تاريخية لأصل معين
 */
export const getAssetHistory = async (assetId, timeframe = '1M') => {
  try {
    const assetKey = `${CACHE_KEYS.ASSET_HISTORY_PREFIX}${assetId}`;
    const assetHistoryData = await AsyncStorage.getItem(assetKey);
    let assetHistory = assetHistoryData ? JSON.parse(assetHistoryData) : [];

    if (assetHistory.length === 0) {
      return [];
    }

    // ترتيب من الأقدم إلى الأحدث
    assetHistory = [...assetHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

    // تصفية حسب الفترة الزمنية
    const filteredHistory = filterHistoryByTimeframe(assetHistory, timeframe);

    return filteredHistory.map(point => ({
      value: point.value,
      date: point.date,
      label: formatChartLabel(point.date, timeframe)
    }));
  } catch (error) {
    console.error('[HistoryTracker] Failed to get asset history:', error);
    return [];
  }
};
