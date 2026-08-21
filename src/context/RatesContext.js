import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getCurrenciesData } from '../services/currenciesCoreData';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RatesContext = createContext();

export const RatesProvider = ({ children }) => {
  const [rates, setRates] = useState({});
  const [loadingRates, setLoadingRates] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  // دالة لجلب الوقت الحالي
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const fetchGlobalRates = useCallback(async (isManualRefresh = false) => {
    const NOW = Date.now();
    const THIRTY_MINUTES = CACHE_DURATIONS.RATES_CONTEXT; // 30 دقيقة من cacheKeys

    // 1. التحقق من التخزين المحلي لتنفيذ "الخداع البصري"
    try {
      const lastFetchTime = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME);

      // إذا كان التحديث يدوياً (سوايب أو زر) ومر أقل من 30 دقيقة
      if (isManualRefresh && lastFetchTime && (NOW - parseInt(lastFetchTime) < THIRTY_MINUTES)) {
        console.log('Smart Strategy: Performing optimistic update (Visual only)');

        setLoadingRates(true);
        // تأخير بسيط لمحاكاة سرعة الاستجابة (UX)
        await new Promise(resolve => setTimeout(resolve, 800));

        setLastUpdated(getCurrentTime());
        setLoadingRates(false);
        return; // الخروج دون طلب API
      }
    } catch (e) {
      console.warn('Storage not available:', e.message);
    }

    // 2. الطلب الحقيقي للبيانات (يحدث فقط عند أول دخول أو بعد مرور 30 دقيقة)
    try {
      if (isManualRefresh) setLoadingRates(true);

      // دائماً false، لا forceRefresh لمنع الطلبات المباشرة
      const data = await getCurrenciesData(false);
      
      if (data && data.rates) {
        setRates(data.rates);
        setLastUpdated(getCurrentTime());
      }
    } catch (error) {
      console.error('Error fetching global rates:', error);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalRates(false); // أول جلب عند فتح التطبيق
  }, [fetchGlobalRates]);

  return (
    <RatesContext.Provider value={{
      rates,
      loadingRates,
      lastUpdated,
      refreshRates: () => fetchGlobalRates(true) // استدعاء التحديث اليدوي
    }}>
      {children}
    </RatesContext.Provider>
  );
};
