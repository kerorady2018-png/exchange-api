import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';
const LAST_NOTIFICATIONS_KEY = '@last_notification_times';

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  priceAlertsEnabled: true,
  portfolioAlertsEnabled: true,
  dailySummaryEnabled: true,
  priceThreshold: 0.05,
  selectedCurrencies: ['USD', 'EUR', 'GBP', 'SAR', 'AED'],
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  minIntervalMinutes: 30,
};

const CHANNEL_ID = 'currx-alerts';

let notificationSettings = null;
let initialized = false;

/**
 * تهيئة خدمة الإشعارات
 */
export async function initializeNotifications() {
  if (initialized) return;

  await loadNotificationSettings();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تنبيهات أسعار العملات والمحفظة',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#387c9f',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await requestNotificationPermissions();
  initialized = true;
}

/**
 * طلب صلاحية الإشعارات
 */
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.log('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * التحقق من الصلاحيات
 */
export async function checkNotificationPermissions() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    return false;
  }
}

/**
 * تحميل إعدادات الإشعارات
 */
export async function loadNotificationSettings() {
  try {
    if (notificationSettings) return notificationSettings;

    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    notificationSettings = stored
      ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) }
      : { ...DEFAULT_NOTIFICATION_SETTINGS };

    return notificationSettings;
  } catch (error) {
    console.log('Error loading notification settings:', error);
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

/**
 * حفظ إعدادات الإشعارات
 */
export async function saveNotificationSettings(settings) {
  try {
    notificationSettings = { ...notificationSettings, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notificationSettings));
    return notificationSettings;
  } catch (error) {
    console.log('Error saving notification settings:', error);
    return null;
  }
}

/**
 * التحقق من ساعات الهدوء
 */
function isInQuietHours(settings) {
  if (!settings.quietHoursEnabled) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const { quietHoursStart, quietHoursEnd } = settings;

  if (quietHoursStart <= quietHoursEnd) {
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  } else {
    // للفترة التي تعبر منتصف الليل (مثل 22 إلى 8)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  }
}

/**
 * التحقق من عدم التكرار
 */
async function canSendNotification(notificationType, minIntervalMinutes = 30) {
  try {
    const stored = await AsyncStorage.getItem(LAST_NOTIFICATIONS_KEY);
    const lastTimes = stored ? JSON.parse(stored) : {};
    const now = Date.now();
    const lastTime = lastTimes[notificationType] || 0;
    const intervalMs = minIntervalMinutes * 60 * 1000;

    if (now - lastTime < intervalMs) {
      console.log(`Notification ${notificationType} rate limited`);
      return false;
    }

    lastTimes[notificationType] = now;
    await AsyncStorage.setItem(LAST_NOTIFICATIONS_KEY, JSON.stringify(lastTimes));
    return true;
  } catch (error) {
    console.log('Error checking notification rate limit:', error);
    return true;
  }
}

/**
 * إرسال إشعار فوري
 */
export async function sendNotification(title, body, data = {}, options = {}) {
  try {
    const settings = await loadNotificationSettings();

    if (!settings.enabled) return { success: false, reason: 'disabled' };
    if (isInQuietHours(settings)) return { success: false, reason: 'quiet_hours' };

    const notificationType = options.type || 'general';
    if (options.rateLimit !== false) {
      const canSend = await canSendNotification(notificationType, settings.minIntervalMinutes);
      if (!canSend) return { success: false, reason: 'rate_limited' };
    }

    if (!initialized) await initializeNotifications();
    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) {
      console.log('Notifications permission not granted');
      return { success: false, reason: 'no_permission' };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        badge: 1,
      },
      trigger: null,
    });

    console.log('✅ Notification sent:', title, body);
    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * إرسال تنبيه تغير سعر
 */
export async function sendPriceAlert(currency, oldPrice, newPrice, changePercent) {
  try {
    const settings = await loadNotificationSettings();
    if (!settings.enabled || !settings.priceAlertsEnabled) return;

    if (!settings.selectedCurrencies.includes(currency)) return;

    const absChange = Math.abs(changePercent);
    if (absChange < settings.priceThreshold) return;

    const direction = changePercent > 0 ? 'ارتفع' : 'انخفض';
    const emoji = changePercent > 0 ? '📈' : '📉';
    const sign = changePercent > 0 ? '+' : '';

    const title = `${emoji} تنبيه سعر ${currency}`;
    const body = `${currency} ${direction} بنسبة ${sign}${changePercent.toFixed(2)}%`;

    await sendNotification(title, body, { type: 'price_alert', currency, changePercent }, { type: 'price_alert' });
  } catch (error) {
    console.log('Error sending price alert:', error);
  }
}

/**
 * إرسال تنبيه محفظة
 */
export async function sendPortfolioAlert(alertType, totalValue, changePercent, currency = 'EGP') {
  try {
    const settings = await loadNotificationSettings();
    if (!settings.enabled || !settings.portfolioAlertsEnabled) return;

    let title, body;
    const sign = changePercent > 0 ? '+' : '';
    const formattedValue = Number(totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    switch (alertType) {
      case 'goal_achieved':
        title = '🎉 هدفك المالي تحقق!';
        body = `مبروك! قيمة محفظتك وصلت إلى ${formattedValue} ${currency}`;
        break;
      case 'goal_close':
        title = '🎯 أنت قريب من هدفك';
        body = `محفظتك الآن ${formattedValue} ${currency}، أنت على بعد خطوات قليلة من الهدف`;
        break;
      case 'big_gain':
        title = '📈 ربح كبير في محفظتك';
        body = `محفظتك ارتفعت بنسبة ${sign}${changePercent.toFixed(2)}%`;
        break;
      case 'big_loss':
        title = '📉 انخفاض ملحوظ في محفظتك';
        body = `محفظتك انخفضت بنسبة ${changePercent.toFixed(2)}%`;
        break;
      case 'daily_summary':
        title = '📊 ملخص المحفظة اليومي';
        body = `قيمة المحفظة: ${formattedValue} ${currency} (${sign}${changePercent.toFixed(2)}%)`;
        break;
      default:
        return;
    }

    await sendNotification(
      title,
      body,
      { type: 'portfolio_alert', alertType, totalValue, changePercent },
      { type: `portfolio_${alertType}` }
    );
  } catch (error) {
    console.log('Error sending portfolio alert:', error);
  }
}

/**
 * إرسال ملخص يومي
 */
export async function sendDailySummary(totalValue, gains, losses, netChange, currency = 'EGP') {
  try {
    const settings = await loadNotificationSettings();
    if (!settings.enabled || !settings.dailySummaryEnabled) return;

    const formattedValue = Number(totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = netChange >= 0 ? '+' : '';

    const title = '📈 ملخص يومي للمحفظة';
    const body = `إجمالي: ${formattedValue} ${currency} | صافي: ${sign}${netChange.toFixed(2)} ${currency}`;

    await sendNotification(
      title,
      body,
      { type: 'daily_summary', totalValue, gains, losses, netChange },
      { type: 'daily_summary' }
    );
  } catch (error) {
    console.log('Error sending daily summary:', error);
  }
}

/**
 * جدولة ملخص يومي
 */
export async function scheduleDailySummary(hour = 9, minute = 0) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 وقت مراجعة المحفظة',
        body: 'تفقد ملخص محفظتك اليومي',
        data: { type: 'daily_summary_reminder' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    console.log(`Daily summary scheduled for ${hour}:${minute}`);
  } catch (error) {
    console.log('Error scheduling daily summary:', error);
  }
}

/**
 * إلغاء جميع الإشعارات المجدولة
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(LAST_NOTIFICATIONS_KEY, JSON.stringify({}));
    console.log('All notifications cancelled');
  } catch (error) {
    console.log('Error cancelling notifications:', error);
  }
}

/**
 * الحصول على الإعدادات الافتراضية
 */
export function getDefaultNotificationSettings() {
  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

export default {
  initializeNotifications,
  requestNotificationPermissions,
  checkNotificationPermissions,
  loadNotificationSettings,
  saveNotificationSettings,
  sendNotification,
  sendPriceAlert,
  sendPortfolioAlert,
  sendDailySummary,
  scheduleDailySummary,
  cancelAllNotifications,
  getDefaultNotificationSettings,
};