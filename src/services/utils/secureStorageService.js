// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

/**
 * دالة تنظيف وتطهير المفاتيح:
 * تقوم بتنظيف أي مفتاح يحتوي على @ أو مسافات أو رموز خاصة وتجعله صالحاً 100% لمكتبة Expo SecureStore
 */
const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'fallback_secure_key';
  const clean = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean || 'fallback_secure_key';
};

export const save = async (key, value) => {
  try {
    const cleanKey = sanitizeKey(key);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await SecureStore.setItemAsync(cleanKey, stringValue);
    return true;
  } catch (error) {
    return false;
  }
};

export const load = async (key) => {
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
    return null;
  }
};

export const deleteKey = async (key) => {
  try {
    const cleanKey = sanitizeKey(key);
    await SecureStore.deleteItemAsync(cleanKey);
    return true;
  } catch (error) {
    return false;
  }
};

export const getValue = async (key) => load(key);
export const setValue = async (key, value) => save(key, value);
export const deleteValue = async (key) => deleteKey(key);

export const clearAllUserData = async () => {
  const keys = [
    'user_name', 'user_phone', 'user_country', 'user_email',
    'secure_user_name', 'secure_user_phone', 'secure_user_country', 'secure_user_email',
    'USER_NAME', 'USER_PHONE', 'USER_COUNTRY', 'USER_EMAIL'
  ];
  for (const k of keys) {
    try {
      await SecureStore.deleteItemAsync(sanitizeKey(k));
    } catch (e) {
      // تجاهل أخطاء المفاتيح النظيفة
    }
  }
  return true;
};

const SecureStorageService = {
  save,
  load,
  delete: deleteKey,
  deleteKey,
  getValue,
  setValue,
  deleteValue,
  clearAllUserData,
};

export default SecureStorageService;