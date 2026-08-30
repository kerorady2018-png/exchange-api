import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getCurrenciesData } from '../services/currenciesCoreData';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RatesContext = createContext();

export const RatesProvider = ({ children }) => {
  const [rates, setRates] = useState({});
  const [banqueMisrRates, setBanqueMisrRates] = useState({});
  const [loadingRates, setLoadingRates] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  // دالة لجلب الوقت الحالي
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // محاولة تحميل الكاش فوراً عند بدء التشغيل لضمان استمرارية العرض
  useEffect(() => {
    const loadInitialCache = async () => {
      try {
        const cachedRates = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
        const cachedBm = await AsyncStorage.getItem(CACHE_KEYS.BM_RATES);
        if (cachedRates) setRates(JSON.parse(cachedRates));
        if (cachedBm) setBanqueMisrRates(JSON.parse(cachedBm));
      } catch (e) {
        console.warn('Failed to load initial cache', e);
      }
    };
    loadInitialCache();
  }, []);

  const fetchGlobalRates = useCallback(async (isManualRefresh = false) => {
    const NOW = Date.now();
    const THIRTY_MINUTES = CACHE_DURATIONS.RATES_CONTEXT;

    try {
      if (isManualRefresh) setLoadingRates(true);

      const lastFetchTime = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME);

      // استراتيجية ذكية: إذا كان التحديث يدوياً وضمن الـ 30 دقيقة، نستخدم الخداع البصري للحفاظ على الـ API
      if (isManualRefresh && lastFetchTime && (NOW - parseInt(lastFetchTime) < THIRTY_MINUTES)) {
        console.log('Smart Strategy: Performing optimistic update');

        // جلب البيانات من الكاش المحلي فقط لضمان استمرارية العرض
        const data = await getCurrenciesData(false);
        if (data) {
          if (data.rates) setRates(data.rates);
          if (data.banqueMisrRates) setBanqueMisrRates(data.banqueMisrRates);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
        setLastUpdated(getCurrentTime());
        setLoadingRates(false);
        return;
      }

      // الطلب الحقيقي (يحدث فقط كل 30 دقيقة)
      const data = await getCurrenciesData(isManualRefresh);
      
      if (data) {
        if (data.rates) setRates(data.rates);
        // تحديث banqueMisrRates فقط إذا كانت تحتوي على بيانات
        if (data.banqueMisrRates && Object.keys(data.banqueMisrRates).length > 0) {
          setBanqueMisrRates(data.banqueMisrRates);
        }
        setLastUpdated(getCurrentTime());
      }
    } catch (error) {
      console.error('Error in fetchGlobalRates:', error);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalRates(false);
  }, [fetchGlobalRates]);

  return (
    <RatesContext.Provider value={{
      rates,
      banqueMisrRates,
      loadingRates,
      lastUpdated,
      refreshRates: () => fetchGlobalRates(true)
    }}>
      {children}
    </RatesContext.Provider>
  );
};
