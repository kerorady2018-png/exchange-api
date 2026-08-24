import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPriceAlert } from './notificationService';

// دالة لفحص الأسعار وإرسال التنبيهات
export async function checkAndTriggerAlerts(newRates, alertCurrencies, alertThreshold) {
  if (!newRates || !alertCurrencies || alertCurrencies.length === 0) return;

  try {
    // جلب الأسعار القديمة المخزنة سابقاً
    const storedOldRates = await AsyncStorage.getItem('previousRates');
    const oldRates = storedOldRates ? JSON.parse(storedOldRates) : {};

    const thresholdValue = parseFloat(alertThreshold) || 0.05;

    // فحص كل عملة مفعل لها التنبيه
    alertCurrencies.forEach(currency => {
      if (newRates[currency] && oldRates[currency]) {
        const oldPrice = oldRates[currency];
        const newPrice = newRates[currency];
        const diff = Math.abs(newPrice - oldPrice);

        // إذا تجاوز التغير القيمة المحددة
        if (diff >= thresholdValue) {
          sendPriceAlert(currency, diff);
        }
      }
    });

    // تحديث الأسعار المخزنة بالأسعار الجديدة للمقارنة في المرة القادمة
    await AsyncStorage.setItem('previousRates', JSON.stringify(newRates));
    
  } catch (error) {
    console.error('Error checking price alerts:', error);
  }
}
