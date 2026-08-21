import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import SecureStorageService from '../utils/secureStorageService';
import { withRetry } from '../utils/networkUtils';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';

const API_BASE_URL = 'https://exchange-api.vercel.app/api';
const SYNC_SECRET = 'core-sync-v1-secret'; // Simplified for Phase 1

// Variables to manage throttling and debouncing
let syncTimer = null;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5 * 60 * 1000;
const DEBOUNCE_DELAY = CACHE_DURATIONS.DEBOUNCE_DELAY;

// Professional Rate Limiting Constants
const MANUAL_SYNC_WINDOW = CACHE_DURATIONS.SYNC_MANUAL; // 24 hours between manual syncs
const AUTO_SYNC_WINDOW = CACHE_DURATIONS.SYNC_AUTO;   // 48 hours cycle for auto-sync

// Queue for offline sync retry
let isSyncingQueue = false;

const AuthService = {
  /**
   * دالة المزامنة الخلفية الذكية عند استعادة الإنترنت
   */
  processSyncQueue: async () => {
    if (isSyncingQueue) return;
    try {
      const pendingSync = await AsyncStorage.getItem(CACHE_KEYS.PENDING_CLOUD_SYNC);
      if (pendingSync === 'true') {
        console.log('Detected pending sync, attempting background recovery...');
        isSyncingQueue = true;

        // جلب آخر بيانات محلية مخزنة
        const name = await SecureStorageService.load(CACHE_KEYS.USER_NAME);
        const phone = await SecureStorageService.load(CACHE_KEYS.USER_PHONE);
        const email = await SecureStorageService.load(CACHE_KEYS.USER_EMAIL);
        const country = await SecureStorageService.load(CACHE_KEYS.USER_COUNTRY);
        const portfolio = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_ASSETS);
        const total = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_TOTAL_VALUE);
        const target = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_TARGET);

        if (name && (phone || email)) {
          const result = await AuthService._performCloudSync({
            name,
            portfolio: portfolio ? JSON.parse(portfolio) : [],
            totalValue: total || 0,
            target
          }, `${country || '+20'}${phone || ''}`, email);

          if (result.success) {
            await AsyncStorage.setItem(CACHE_KEYS.PENDING_CLOUD_SYNC, 'false');
            await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'false');
          }
        }
      }
    } catch (e) {
      console.warn('Queue Sync Failed:', e.message);
    } finally {
      isSyncingQueue = false;
    }
  },

  /**
   * دالة للتحقق من السماح بالمزامنة اليدوية (مرة كل 12 ساعة)
   */
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

  /**
   * دالة للتحقق من استحقاق المزامنة التلقائية (كل 24 ساعة من أول نشاط + وجود تغييرات)
   */
  shouldAutoSync: async () => {
    try {
      const firstAssetTime = await AsyncStorage.getItem(CACHE_KEYS.FIRST_ASSET_TIME);
      const lastAutoSync = await AsyncStorage.getItem(CACHE_KEYS.LAST_AUTO_SYNC);
      const needsSync = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC);

      if (!firstAssetTime) return false; // لم يبدأ النشاط بعد
      // المزامنة التلقائية تتم فقط إذا كان هناك تغيير هيكلي حقيقي (إضافة، حذف، تعديل)
      if (needsSync !== 'true') return false;

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
    if (!name || name.trim().length < 2) {
      errors.name = true;
    }
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
      // 1. الحفظ المحلي الفوري
      await SecureStorageService.save(CACHE_KEYS.USER_NAME, name.trim());
      if (cleanPhone) await SecureStorageService.save(CACHE_KEYS.USER_PHONE, cleanPhone);
      await SecureStorageService.save(CACHE_KEYS.USER_COUNTRY, countryCode || '+20');
      if (cleanEmail) await SecureStorageService.save(CACHE_KEYS.USER_EMAIL, cleanEmail);

      await AsyncStorage.setItem(CACHE_KEYS.IS_DATA_SAVED, 'true');

      // Marking as pending in case cloud sync fails (Offline-First)
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_CLOUD_SYNC, 'true');

      const now = Date.now();

      if (isManual) {
        // فحص القفل الزمني للمزامنة اليدوية (24 ساعة)
        const check = await AuthService.canSyncManually();
        if (!check.allowed) {
          return { success: false, rate_limited: true, remainingHours: check.remainingHours };
        }

        const result = await AuthService._performCloudSync(userData, fullPhone, cleanEmail);
        if (result.success) {
          lastSyncTime = now;
          await AsyncStorage.setItem(CACHE_KEYS.LAST_MANUAL_SYNC, lastSyncTime.toString());
          // تصفير علامة الحاجة للمزامنة بعد النجاح
          await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'false');
          await AsyncStorage.setItem(CACHE_KEYS.PENDING_CLOUD_SYNC, 'false'); // Success!
        }
        return result;
      }

      // المزامنة التلقائية (تحترم الـ 48 ساعة)
      const autoSyncReady = await AuthService.shouldAutoSync();
      if (!autoSyncReady) {
        return { success: true, throttled: true };
      }

      if (syncTimer) clearTimeout(syncTimer);

      return new Promise((resolve) => {
        syncTimer = setTimeout(async () => {
          const result = await AuthService._performCloudSync(userData, fullPhone, cleanEmail);
          if (result.success) {
            lastSyncTime = Date.now();
            await AsyncStorage.setItem(CACHE_KEYS.LAST_AUTO_SYNC, lastSyncTime.toString());
            // تصفير علامة الحاجة للمزامنة بعد النجاح التلقائي
            await AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'false');
            await AsyncStorage.setItem(CACHE_KEYS.PENDING_CLOUD_SYNC, 'false'); // Success!
          }
          resolve(result);
        }, DEBOUNCE_DELAY);
      });

    } catch (error) {
      console.warn('Sync Failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  _performCloudSync: async (userData, fullPhone, cleanEmail) => {
    try {
      console.log('Firing Secure API Sync to Cloud...');

      const payload = {
        name: userData.name.trim(),
        phone: fullPhone,
        email: cleanEmail,
        portfolio: userData.portfolio || [],
        totalValue: Number(userData.totalValue) || 0,
        target: userData.target || null,
        clientTimestamp: Date.now()
      };

      // Generate a simple secure signature (JWT-style)
      const signature = CryptoJS.HmacSHA256(JSON.stringify(payload), SYNC_SECRET).toString();

      const response = await withRetry(() => axios.post(`${API_BASE_URL}/save-user`, payload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signature}`
        }
      }));

      if (response.data && response.data.success) {
        return { success: true, user: response.data.user };
      }
      return { success: false, error: 'Sync response unsuccessful' };
    } catch (error) {
      console.warn('Cloud Sync Failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  getUser: async (phone, email, countryCode) => {
    const cleanPhone = AuthService.formatPhone(phone);
    const cleanEmail = email?.trim().toLowerCase() || '';
    const fullPhone = cleanPhone ? `${countryCode}${cleanPhone}` : '';

    try {
      const response = await withRetry(() => axios.get(`${API_BASE_URL}/get-user`, {
        params: { phone: fullPhone, email: cleanEmail },
        timeout: 15000
      }));

      if (response.data && response.data.user) {
        return { success: true, user: response.data.user };
      }
      return { success: false };
    } catch (error) {
      console.error('Fetch User Error:', error.message);
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
      console.error('Apply Data Error:', error);
      return false;
    }
  }
};

export default AuthService;
