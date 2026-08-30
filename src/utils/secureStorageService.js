import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * خدمة التخزين الآمن الموحدة (Secure Storage Service)
 * توفر طبقة حماية إضافية للبيانات الحساسة (الاسم، الهاتف، الإيميل)
 * باستخدام تشفير KeyStore/Keychain الخاص بالجهاز.
 * 
 * توحيد المفاتيح لتطابق مع CACHE_KEYS في cacheKeys.js
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
   * استرجاع قيمة محفوظة (تطابق مع load)
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
   * استرجاع قيمة محفوظة (اسم بديل لـ getValue)
   */
  load: async (key) => {
    try {
      const result = await SecureStore.getItemAsync(key);
      if (result) {
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error loading from SecureStore [${key}]:`, error);
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
    const keys = ['secure_user_name', 'secure_user_phone', 'secure_user_email', 'secure_user_country'];
    for (const key of keys) {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export default SecureStorageService;
