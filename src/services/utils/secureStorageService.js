// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

/**
 * دالة لتطهير المفاتيح تماماً وحذف أي رمز غير مسموح به في SecureStore
 */
const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'fallback_key';
  const clean = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.length > 0 ? clean : 'fallback_key';
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

  for (const rawKey of keys) {
    try {
      const cleanKey = sanitizeKey(rawKey);
      await SecureStore.deleteItemAsync(cleanKey);
    } catch (e) {
      // تتجاهل أي خطأ فردي لضمان عدم توقف العملية
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