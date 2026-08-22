// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

// دالة لتطوير وتطهير المفاتيح تلقائياً لمنع أي كراش في Expo SecureStore
const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'default_secure_key';
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const SecureStorageService = {
  // 1️⃣ الدوال الأساسية المعتمدة في authService
  save: async (key, value) => {
    try {
      const cleanKey = sanitizeKey(key);
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await SecureStore.setItemAsync(cleanKey, stringValue);
      return true;
    } catch (error) {
      console.warn('SecureStore Save Warning:', error.message);
      return false;
    }
  },

  load: async (key) => {
    try {
      const cleanKey = sanitizeKey(key);
      const result = await SecureStore.getItemAsync(cleanKey);
      if (!result) return null;
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    } catch (error) {
      console.warn('SecureStore Load Warning:', error.message);
      return null;
    }
  },

  delete: async (key) => {
    try {
      const cleanKey = sanitizeKey(key);
      await SecureStore.deleteItemAsync(cleanKey);
      return true;
    } catch (error) {
      console.warn('SecureStore Delete Warning:', error.message);
      return false;
    }
  },

  // 2️⃣ دوال التوافق الخاصة بشاشة SettingsScreen لضمان عدم حدوث أي استثناءات
  getValue: async (key) => {
    return await SecureStorageService.load(key);
  },

  setValue: async (key, value) => {
    return await SecureStorageService.save(key, value);
  },

  deleteValue: async (key) => {
    return await SecureStorageService.delete(key);
  },

  // دالة مسح البيانات الآمنة بدون مفاتيح غير صالحة
  clearAllUserData: async () => {
    const userKeys = [
      'user_name', 'user_phone', 'user_country', 'user_email',
      'secure_user_name', 'secure_user_phone', 'secure_user_country', 'secure_user_email',
      'USER_NAME', 'USER_PHONE', 'USER_COUNTRY', 'USER_EMAIL'
    ];
    for (const k of userKeys) {
      try {
        await SecureStore.deleteItemAsync(sanitizeKey(k));
      } catch (e) {
        // تجاهل أخطاء الـ Key النظيفة
      }
    }
    return true;
  }
};

export default SecureStorageService;