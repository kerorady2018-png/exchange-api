import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPriceAlert, sendPortfolioAlert, sendDailySummary } from './notificationService';

const LAST_PRICE_ALERTS_KEY = '@last_price_alerts';
const LAST_PORTFOLIO_ALERT_KEY = '@last_portfolio_alert';
const DAILY_SUMMARY_DATE_KEY = '@daily_summary_sent_date';

/**
 * فحص التغيرات السعرية وإرسال التنبيهات
 */
export async function checkAndTriggerPriceAlerts(newRates, previousRates, settings) {
  if (!newRates || !settings || !settings.priceAlertsEnabled) return;

  try {
    const storedOldRates = previousRates || {};
    const thresholdValue = parseFloat(settings.priceThreshold) || 0.05;
    const selectedCurrencies = settings.selectedCurrencies || ['USD', 'EUR', 'GBP'];

    const now = Date.now();
    const stored = await AsyncStorage.getItem(LAST_PRICE_ALERTS_KEY);
    const lastAlerts = stored ? JSON.parse(stored) : {};

    for (const currency of selectedCurrencies) {
      if (!newRates[currency] || !storedOldRates[currency]) continue;

      const oldPrice = parseFloat(storedOldRates[currency]);
      const newPrice = parseFloat(newRates[currency]);

      if (isNaN(oldPrice) || isNaN(newPrice) || oldPrice === 0) continue;

      const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
      const absChange = Math.abs(changePercent);

      // فحص التغير بالنسبة المئوية
      if (absChange >= thresholdValue) {
        // تجنب الإشعارات المتكررة لنفس العملة (ساعة واحدة)
        const lastAlert = lastAlerts[currency] || 0;
        if (now - lastAlert < 60 * 60 * 1000) continue;

        await sendPriceAlert(currency, oldPrice, newPrice, changePercent);

        lastAlerts[currency] = now;
      }
    }

    await AsyncStorage.setItem(LAST_PRICE_ALERTS_KEY, JSON.stringify(lastAlerts));

    // تحديث الأسعار القديمة
    await AsyncStorage.setItem('previousRates', JSON.stringify(newRates));

  } catch (error) {
    console.error('Error checking price alerts:', error);
  }
}

/**
 * حساب أداء المحفظة البسيط
 */
function calculatePortfolioSummary(assets, rates, baseCurrency) {
  try {
    if (!assets || !Array.isArray(assets) || assets.length === 0) return null;

    let totalValue = 0;
    let totalInitial = 0;

    for (const asset of assets) {
      if (!asset || !asset.amount || !asset.currency) continue;

      const amount = parseFloat(asset.amount) || 0;
      const initialValue = parseFloat(asset.initialValue) || amount;
      const rate = rates && rates[asset.currency] ? parseFloat(rates[asset.currency]) : 1;

      const currentValue = amount * rate;
      totalValue += currentValue;
      totalInitial += initialValue * rate;
    }

    const netDiff = totalValue - totalInitial;
    const netPercent = totalInitial > 0 ? (netDiff / totalInitial) * 100 : 0;

    return {
      totalValue,
      netDiff,
      netPercent,
      totalGains: netDiff > 0 ? netDiff : 0,
      totalLosses: netDiff < 0 ? Math.abs(netDiff) : 0,
    };

  } catch (error) {
    console.error('Error calculating portfolio summary:', error);
    return null;
  }
}

/**
 * فحص أداء المحفظة وإرسال التنبيهات المناسبة
 */
export async function checkAndTriggerPortfolioAlerts(assets, rates, baseCurrency, settings) {
  if (!assets || !settings || !settings.portfolioAlertsEnabled || assets.length === 0) return;

  try {
    const now = Date.now();
    const stored = await AsyncStorage.getItem(LAST_PORTFOLIO_ALERT_KEY);
    const lastAlertTime = stored ? parseInt(stored, 10) : 0;

    // لا ترسل أكثر من إشعار واحد كل 4 ساعات للمحفظة
    if (now - lastAlertTime < 4 * 60 * 60 * 1000) return;

    const performance = calculatePortfolioSummary(assets, rates, baseCurrency);
    if (!performance) return;

    const { totalValue, netPercent } = performance;

    // جلب الهدف من AsyncStorage أو من الأصول
    let target = null;
    try {
      const targetStr = await AsyncStorage.getItem('@portfolio_target');
      if (targetStr) target = parseFloat(targetStr);
    } catch (e) {
      // تجاهل
    }

    let alertType = null;

    // تحقيق الهدف
    if (target && totalValue >= target) {
      alertType = 'goal_achieved';
    }
    // قرب من الهدف (90%)
    else if (target && totalValue >= target * 0.9) {
      alertType = 'goal_close';
    }
    // ربح كبير
    else if (netPercent >= 5) {
      alertType = 'big_gain';
    }
    // خسارة كبيرة
    else if (netPercent <= -5) {
      alertType = 'big_loss';
    }

    if (alertType) {
      await sendPortfolioAlert(alertType, totalValue, netPercent, baseCurrency);
      await AsyncStorage.setItem(LAST_PORTFOLIO_ALERT_KEY, now.toString());
    }

  } catch (error) {
    console.error('Error checking portfolio alerts:', error);
  }
}

/**
 * إنشاء ملخص يومي للمحفظة
 */
export async function checkAndSendDailySummary(assets, rates, baseCurrency, settings) {
  if (!settings || !settings.dailySummaryEnabled || !assets || assets.length === 0) return;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const stored = await AsyncStorage.getItem(DAILY_SUMMARY_DATE_KEY);
    if (stored === todayStr) return; // تم إرسال الملخص اليوم

    const performance = calculatePortfolioSummary(assets, rates, baseCurrency);
    if (!performance) return;

    const { totalValue, totalGains, totalLosses, netDiff } = performance;
    const netPercent = performance.netPercent || 0;

    await sendDailySummary(totalValue, totalGains, totalLosses, netPercent, baseCurrency);
    await AsyncStorage.setItem(DAILY_SUMMARY_DATE_KEY, todayStr);

  } catch (error) {
    console.error('Error sending daily summary:', error);
  }
}

export default {
  checkAndTriggerPriceAlerts,
  checkAndTriggerPortfolioAlerts,
  checkAndSendDailySummary,
};