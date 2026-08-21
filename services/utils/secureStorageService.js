// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

// دالة تنظيف المفاتيح لمنع أخطاء SecureStore عند وجود رموز مثل @
const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'default_secure_key';
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const SecureStorageService = {
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
  }
};

export default SecureStorageService;