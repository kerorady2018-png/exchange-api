// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

// دالة تطهير المفاتيح: تحول أي مفتاح يحتوي على @ أو مسافات إلى مفتاح صالح مقبول لدى Expo
const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'valid_default_key';
  const cleaned = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || 'valid_fallback_key';
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
    'secure_user_name', 'secure_user_phone', 'secure_user_country', 'secure_user_email'
  ];
  for (const k of keys) {
    try {
      await SecureStore.deleteItemAsync(sanitizeKey(k));
    } catch (e) {
      // تجاهل أي خطأ فردي
    }
  }
  return true;
};

// كائن للتوافق مع جميع طرق الاستيراد (Default + Named Exports)
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