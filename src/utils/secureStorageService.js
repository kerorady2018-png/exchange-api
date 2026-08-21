import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * خدمة التخزين الآمن الموحدة (Secure Storage Service)
 * توفر طبقة حماية إضافية للبيانات الحساسة (الاسم، الهاتف، الإيميل)
 * باستخدام تشفير KeyStore/Keychain الخاص بالجهاز.
 */
const SecureStorageService = {
  /**
   * حفظ قيمة بشكل آمن
   */
  save: async (key, value) => {
    try {
      if (value === null || value === undefined) {
        await SecureStore.deleteItemAsync(key);
        return;
      }
      // تحويل القيمة لنص لأن SecureStore يقبل النصوص فقط
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await SecureStore.setItemAsync(key, stringValue);
    } catch (error) {
      console.error(`Error saving to SecureStore [${key}]:`, error);
    }
  },

  /**
   * استرجاع قيمة محفوظة
   */
  getValue: async (key) => {
    try {
      const result = await SecureStore.getItemAsync(key);
      if (result) {
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching from SecureStore [${key}]:`, error);
      return null;
    }
  },

  /**
   * استرجاع كائن (Object) محفوظ
   */
  getObject: async (key) => {
    try {
      const result = await SecureStore.getItemAsync(key);
      if (result) {
        return JSON.parse(result);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching object from SecureStore [${key}]:`, error);
      return null;
    }
  },

  /**
   * حذف مفتاح معين
   */
  remove: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error deleting from SecureStore [${key}]:`, error);
    }
  },

  /**
   * مسح كافة البيانات الحساسة (عند تسجيل الخروج مثلاً)
   */
  clearAllUserData: async () => {
    const keys = ['@user_name', '@user_phone', '@user_email', '@user_country'];
    for (const key of keys) {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export default SecureStorageService;
