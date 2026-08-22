// src/utils/secureStorageService.js
import * as SecureStore from 'expo-secure-store';

const sanitizeKey = (key) => {
  if (!key || typeof key !== 'string') return 'safe_key';
  const clean = key.replace(/[^a-zA-Z0-9._-]/g, '_').trim();
  return clean.length > 0 ? clean : 'safe_key';
};

export const save = async (key, value) => {
  try {
    const cleanKey = sanitizeKey(key);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    await SecureStore.setItemAsync(cleanKey, stringValue);
    return true;
  } catch (e) {
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
  } catch (e) {
    return null;
  }
};

export const deleteKey = async (key) => {
  try {
    const cleanKey = sanitizeKey(key);
    await SecureStore.deleteItemAsync(cleanKey);
    return true;
  } catch (e) {
    return false;
  }
};

export const getValue = async (key) => load(key);
export const setValue = async (key, value) => save(key, value);
export const deleteValue = async (key) => deleteKey(key);

export const clearAllUserData = async () => {
  const keysToClear = [
    'user_name', 'user_phone', 'user_country', 'user_email',
    'secure_user_name', 'secure_user_phone', 'secure_user_country', 'secure_user_email',
    'USER_NAME', 'USER_PHONE', 'USER_COUNTRY', 'USER_EMAIL'
  ];
  
  for (const rawKey of keysToClear) {
    try {
      const cleanKey = sanitizeKey(rawKey);
      await SecureStore.deleteItemAsync(cleanKey);
    } catch (e) {
      // عزل الأخطاء لكل مفتاح بشكل منفصل
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