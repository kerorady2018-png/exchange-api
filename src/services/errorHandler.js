import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * خدمة معالجة الأخطاء المحسّنة
 * تستخدم لتسجيل الأخطاء وعرض رسائل واضحة للمستخدم
 */
class ErrorHandler {
  static errorLog = [];
  static MAX_LOG_SIZE = 50;

  /**
   * تسجيل الخطأ
   * @param {Error} error - كائن الخطأ
   * @param {string} context - سياق الخطأ
   * @param {object} additionalInfo - معلومات إضافية
   */
  static async logError(error, context = 'Unknown', additionalInfo = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      additionalInfo,
    };

    this.errorLog.unshift(errorEntry);
    
    // الاحتفاظ بآخر 50 خطأ فقط
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(0, this.MAX_LOG_SIZE);
    }

    // حفظ الأخطاء محلياً
    try {
      await AsyncStorage.setItem('@error_log', JSON.stringify(this.errorLog));
    } catch (e) {
      console.error('Failed to save error log:', e);
    }

    console.error(`[${context}]`, error);
  }

  /**
   * تحميل سجل الأخطاء
   */
  static async loadErrorLog() {
    try {
      const log = await AsyncStorage.getItem('@error_log');
      if (log) {
        this.errorLog = JSON.parse(log);
      }
    } catch (error) {
      console.error('Failed to load error log:', error);
    }
  }

  /**
   * مسح سجل الأخطاء
   */
  static async clearErrorLog() {
    this.errorLog = [];
    try {
      await AsyncStorage.removeItem('@error_log');
    } catch (error) {
      console.error('Failed to clear error log:', error);
    }
  }

  /**
   * عرض رسالة خطأ للمستخدم
   * @param {string} title - عنوان الرسالة
   * @param {string} message - نص الرسالة
   * @param {object} options - خيارات إضافية
   */
  static showError(title, message, options = {}) {
    const { 
      onRetry = null, 
      onCancel = null,
      showRetry = false 
    } = options;

    const buttons = [
      {
        text: 'OK',
        style: 'default',
      },
    ];

    if (showRetry && onRetry) {
      buttons.unshift({
        text: 'Retry',
        onPress: onRetry,
      });
    }

    if (onCancel) {
      buttons.push({
        text: 'Cancel',
        onPress: onCancel,
        style: 'cancel',
      });
    }

    Alert.alert(title, message, buttons);
  }

  /**
   * معالجة أخطاء الشبكة
   * @param {Error} error - خطأ الشبكة
   * @param {function} onRetry - دالة إعادة المحاولة
   */
  static handleNetworkError(error, onRetry = null) {
    const { t } = useTranslation();
    
    const title = t('errors.network_title') || 'Network Error';
    const message = t('errors.network_message') || 'Please check your internet connection and try again.';

    this.showError(title, message, {
      onRetry,
      showRetry: !!onRetry,
    });
  }

  /**
   * معالجة أخطاء البيانات
   * @param {Error} error - خطأ البيانات
   * @param {function} onRetry - دالة إعادة المحاولة
   */
  static handleDataError(error, onRetry = null) {
    const { t } = useTranslation();
    
    const title = t('errors.data_title') || 'Data Error';
    const message = t('errors.data_message') || 'Failed to load data. Please try again.';

    this.showError(title, message, {
      onRetry,
      showRetry: !!onRetry,
    });
  }

  /**
   * معالجة أخطاء عامة
   * @param {Error} error - خطأ عام
   * @param {string} context - سياق الخطأ
   */
  static handleGenericError(error, context = 'Unknown') {
    this.logError(error, context);
    
    const title = 'Error';
    const message = 'Something went wrong. Please try again later.';

    this.showError(title, message);
  }

  /**
   * التفاف دالة بمعالجة أخطاء
   * @param {function} fn - الدالة المراد تفصيها
   * @param {string} context - سياق الخطأ
   * @returns {function} - الدالة المفصلة
   */
  static wrap(fn, context = 'Unknown') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError(error, context);
        this.handleGenericError(error, context);
        throw error;
      }
    };
  }

  /**
   * الحصول على سجل الأخطاء
   * @returns {Array} - سجل الأخطاء
   */
  static getErrorLog() {
    return this.errorLog;
  }
}

// تحميل سجل الأخطاء عند بدء التطبيق
ErrorHandler.loadErrorLog();

export default ErrorHandler;
