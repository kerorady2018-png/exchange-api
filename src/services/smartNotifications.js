import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * خدمة الإشعارات الذكية
 * تستخدم لإرسال إشعارات ذكية بناءً على أحداث التطبيق
 */
class SmartNotifications {
  static initialized = false;

  /**
   * تهيئة خدمة الإشعارات
   */
  static async initialize() {
    if (this.initialized) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    this.initialized = true;
  }

  /**
   * إرسال إشعار عند تحقيق الهدف المالي
   * @param {number} currentTotal - القيمة الحالية
   * @param {number} target - الهدف المالي
   * @param {string} currency - العملة
   */
  static async sendGoalAchievedNotification(currentTotal, target, currency) {
    if (!this.initialized) await this.initialize();

    const lastGoalAlert = await AsyncStorage.getItem('@last_goal_alert');
    const now = Date.now();

    // تجنب الإشعارات المتكررة (ساعة واحدة)
    if (lastGoalAlert && now - parseInt(lastGoalAlert) < 3600000) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Goal Achieved!',
        body: `Congratulations! You've reached your target of ${target} ${currency}`,
        data: { type: 'goal_achieved' },
      },
      trigger: null,
    });

    await AsyncStorage.setItem('@last_goal_alert', now.toString());
  }

  /**
   * إرسال إشعار عند تغير كبير في الأسعار
   * @param {string} currency - العملة
   * @param {number} oldPrice - السعر القديم
   * @param {number} newPrice - السعر الجديد
   * @param {number} threshold - عتبة التغيير (نسبة مئوية)
   */
  static async sendPriceChangeNotification(currency, oldPrice, newPrice, threshold = 5) {
    if (!this.initialized) await this.initialize();

    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    const absChange = Math.abs(change);

    if (absChange < threshold) return;

    const direction = change > 0 ? 'increased' : 'decreased';
    const emoji = change > 0 ? '📈' : '📉';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${currency} Price ${direction}`,
        body: `${currency} has ${direction} by ${absChange.toFixed(2)}%`,
        data: { type: 'price_change', currency, change },
      },
      trigger: null,
    });
  }

  /**
   * إرسال تذكير بمراجعة المحفظة
   */
  static async sendPortfolioReminder() {
    if (!this.initialized) await this.initialize();

    const lastReminder = await AsyncStorage.getItem('@last_portfolio_reminder');
    const now = Date.now();

    // تذكير أسبوعي
    if (lastReminder && now - parseInt(lastReminder) < 604800000) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Portfolio Review',
        body: 'Time to review your portfolio and track your progress!',
        data: { type: 'portfolio_reminder' },
      },
      trigger: null,
    });

    await AsyncStorage.setItem('@last_portfolio_reminder', now.toString());
  }

  /**
   * إرسال ملخص يومي
   * @param {object} summary - ملخص المحفظة
   */
  static async sendDailySummary(summary) {
    if (!this.initialized) await this.initialize();

    const { totalValue, gains, losses } = summary;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📈 Daily Portfolio Summary',
        body: `Total: ${totalValue} | Gains: ${gains} | Losses: ${losses}`,
        data: { type: 'daily_summary', summary },
      },
      trigger: null,
    });
  }

  /**
   * إرسال إشعار عند انتهاء فترة التحديث
   * @param {string} dataType - نوع البيانات
   */
  static async sendUpdateReminder(dataType) {
    if (!this.initialized) await this.initialize();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔄 Data Update Available',
        body: `${dataType} data is ready to be updated`,
        data: { type: 'update_reminder', dataType },
      },
      trigger: null,
    });
  }

  /**
   * إرسال إشعار مخصص
   * @param {string} title - العنوان
   * @param {string} body - النص
   * @param {object} data - بيانات إضافية
   */
  static async sendCustomNotification(title, body, data = {}) {
    if (!this.initialized) await this.initialize();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null,
    });
  }

  /**
   * جدولة إشعار مجدول
   * @param {object} content - محتوى الإشعار
   * @param {object} trigger - شرط الإرسال
   */
  static async scheduleNotification(content, trigger) {
    if (!this.initialized) await this.initialize();

    return await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
  }

  /**
   * إلغاء جميع الإشعارات المجدولة
   */
  static async cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * الحصول على جميع الإشعارات المجدولة
   */
  static async getAllScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }
}

export default SmartNotifications;
