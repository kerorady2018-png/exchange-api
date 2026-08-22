// src/services/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import SecureStorageService from '../utils/secureStorageService';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';

const API_BASE_URL = 'https://exchange-api-sepia.vercel.app/api';
const SYNC_SECRET = 'core-sync-v1-secret';

let syncTimer = null;
const DEBOUNCE_DELAY = CACHE_DURATIONS?.DEBOUNCE_DELAY || 3000;
const MANUAL_SYNC_WINDOW = CACHE_DURATIONS?.SYNC_MANUAL || 24 * 60 * 60 * 1000;
const AUTO_SYNC_WINDOW = CACHE_DURATIONS?.SYNC_AUTO || 48 * 60 * 60 * 1000;

let isSyncingQueue = false;

const AuthService = {
  processSyncQueue: async () => {
    if (isSyncingQueue) return;
    try {
      const pendingSync = await AsyncStorage.getItem(CACHE_KEYS.PENDING_CLOUD_SYNC);
      if (pendingSync === 'true') {
        isSyncingQueue = true;
        const name = await SecureStorageService.load(CACHE_KEYS.USER_NAME);
        const phone = await SecureStorageService.load(CACHE_KEYS.USER_PHONE);
        const email = await SecureStorageService.load(CACHE_KEYS.USER_EMAIL);
        const country = await SecureStorageService.load(CACHE_KEYS.USER_COUNTRY);
        const portfolio = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_ASSETS);
        const total = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_TOTAL_VALUE);
        const target = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_TARGET);

        if (name && (phone || email)) {
          await AuthService._performCloudSync({
            name,
            portfolio: portfolio ? JSON.parse(portfolio) : [],
            totalValue: total || 0,
            target
          }, `${country || '+20'}${phone || ''}`, email);
        }
      }
    } catch (e) {
      // صامت بدون إزعاج
    } finally {
      isSyncingQueue = false;
    }
  },

  canSyncManually: async () => {
    try {
      const lastManualSync = await AsyncStorage.getItem(CACHE_KEYS.LAST_MANUAL_SYNC);
      if (!lastManualSync) return { allowed: true };
      const timePassed = Date.now() - parseInt(lastManualSync, 10);
      if (timePassed < MANUAL_SYNC_WINDOW) {
        const remainingHours = Math.ceil((MANUAL_SYNC_WINDOW - timePassed) / (60 * 60 * 1000));
        return { allowed: false, remainingHours };
      }
      return { allowed: true };
    } catch (e) {
      return { allowed: true };
    }
  },

  shouldAutoSync: async () => {
    try {
      const firstAssetTime = await AsyncStorage.getItem(CACHE_KEYS.FIRST_ASSET_TIME);
      const lastAutoSync = await AsyncStorage.getItem(CACHE_KEYS.LAST_AUTO_SYNC);
      const needsSync = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC);
      if (!firstAssetTime || needsSync !== 'true') return false;
      const now = Date.now();
      const lastSync = lastAutoSync ? parseInt(lastAutoSync, 10) : parseInt(firstAssetTime, 10);
      return (now - lastSync >= AUTO_SYNC_WINDOW);
    } catch (e) {
      return false;
    }
  },

  formatPhone: (phone) => {
    if (!phone) return '';
    let p = phone.trim().replace(/\s+/g, '');
    if (p.startsWith('0')) p = p.substring(1);
    return p;
  },

  validateUserData: (name, phone, email) => {
    const errors = {};
    if (!name || name.trim().length < 2) errors.name = true;
    if (!phone?.trim() && !email?.trim()) {
      errors.phone = true;
      errors.email = true;
    }
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = true;
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  saveUser: async (userData, isManual = false) => {
    const { name, phone, email, countryCode, portfolio, totalValue, target } = userData;
    const cleanPhone = AuthService.formatPhone(phone);
    const cleanEmail = email?.trim().toLowerCase() || null;
    const fullPhone = cleanPhone ? `${countryCode}${cleanPhone}` : '';

    try {
      await SecureStorageService.save(CACHE_KEYS.USER_NAME, name.trim());
      if (cleanPhone) await SecureStorageService.save(CACHE_KEYS.USER_PHONE, cleanPhone);
      await SecureStorageService.save(CACHE_KEYS.USER_COUNTRY, countryCode || '+20');
      if (cleanEmail) await SecureStorageService.save(CACHE_KEYS.USER_EMAIL, cleanEmail);

      await AsyncStorage.setItem(CACHE_KEYS.IS_DATA_SAVED, 'true');

      if (isManual) {
        const check = await AuthService.canSyncManually();
        if (!check.allowed) {
          return { success: false, rate_limited: true, remainingHours: check.remainingHours };
        }
        const result = await AuthService._performCloudSync(userData, fullPhone, cleanEmail);
        if (result.success) {
          await AsyncStorage.setItem(CACHE_KEYS.LAST_MANUAL_SYNC, Date.now().toString());
          await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'false');
          await AsyncStorage.setItem(CACHE_KEYS.PENDING_CLOUD_SYNC, 'false');
        }
        return { success: true };
      }

      return { success: true };
    } catch (error) {
      return { success: true, offline: true };
    }
  },

  _performCloudSync: async (userData, fullPhone, cleanEmail) => {
    try {
      const payload = {
        name: userData.name.trim(),
        phone: fullPhone,
        email: cleanEmail,
        portfolio: userData.portfolio || [],
        totalValue: Number(userData.totalValue) || 0,
        target: userData.target || null,
        clientTimestamp: Date.now()
      };

      const signature = CryptoJS.HmacSHA256(JSON.stringify(payload), SYNC_SECRET).toString();

      // مهلة محددة بـ 4 ثوانٍ فقط، بدون محاولات تكرار مزعجة
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE_URL}/save-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signature}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return { success: true, user: data.user };
      }
      return { success: true, offline: true };
    } catch (error) {
      return { success: true, offline: true };
    }
  },

  getUser: async (phone, email, countryCode) => {
    const cleanPhone = AuthService.formatPhone(phone);
    const cleanEmail = email?.trim().toLowerCase() || '';
    const fullPhone = cleanPhone ? `${countryCode}${cleanPhone}` : '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE_URL}/get-user?phone=${encodeURIComponent(fullPhone)}&email=${encodeURIComponent(cleanEmail)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.user) return { success: true, user: data.user };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  applyRestoredData: async (userData, currentCountryCode) => {
    try {
      if (!userData) return false;
      let purePhone = userData.phone || '';
      if (purePhone.startsWith(currentCountryCode)) {
        purePhone = purePhone.replace(currentCountryCode, '');
      }

      await SecureStorageService.save(CACHE_KEYS.USER_NAME, userData.name);
      await SecureStorageService.save(CACHE_KEYS.USER_PHONE, purePhone);
      await SecureStorageService.save(CACHE_KEYS.USER_COUNTRY, currentCountryCode);
      if (userData.email) await SecureStorageService.save(CACHE_KEYS.USER_EMAIL, userData.email.toLowerCase());

      if (userData.portfolio) {
        await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_ASSETS, JSON.stringify(userData.portfolio));
      }
      if (userData.totalValue) {
        await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_TOTAL_VALUE, String(userData.totalValue));
      }
      if (userData.target) {
        await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_TARGET, String(userData.target));
      }

      await AsyncStorage.setItem(CACHE_KEYS.IS_DATA_SAVED, 'true');
      return true;
    } catch (error) {
      return false;
    }
  }
};

export default AuthService;