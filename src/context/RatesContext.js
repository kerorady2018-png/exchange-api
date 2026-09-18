import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getCurrenciesData } from '../services/currenciesCoreData';
import { validBankRates } from '../api/apiConfig';
import { checkAndTriggerPriceAlerts } from '../services/priceAlertChecker';
import { CACHE_KEYS, CACHE_DURATIONS } from '../constants/cacheKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RatesContext = createContext();

const hasRates = value => value && !Array.isArray(value) &&
  Number.isFinite(value.USD) && value.USD > 0 &&
  Object.entries(value).some(([key, rate]) => key !== 'USD' && Number.isFinite(rate) && rate > 0);

export const RatesProvider = ({ children }) => {
  const [rates, setRates] = useState({});
  const [banqueMisrRates, setBanqueMisrRates] = useState({});
  const [banqueMisrIsFallback, setBanqueMisrIsFallback] = useState(true);
  const [loadingRates, setLoadingRates] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const ratesRef = useRef({});
  const requestRef = useRef(null);
  const mountedRef = useRef(true);

  // دالة لجلب الوقت الحالي مع دعم التاريخ التلقائي للأيام السابقة
  const getCurrentTime = timestamp => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return timeStr;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month} ${timeStr}`;
    }
  };

  // محاولة تحميل الكاش فوراً عند بدء التشغيل لضمان استمرارية العرض
  useEffect(() => {
    const loadInitialCache = async () => {
      try {
        const cachedRates = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
        const cachedBm = await AsyncStorage.getItem(CACHE_KEYS.BM_RATES);
        const parsed = cachedRates ? JSON.parse(cachedRates) : null;
        if (mountedRef.current && !hasRates(ratesRef.current) && hasRates(parsed)) {
          ratesRef.current = parsed;
          setRates(parsed);
          if (cachedBm) setBanqueMisrRates(validBankRates(JSON.parse(cachedBm)));
        }
      } catch (e) {
        console.warn('Failed to load initial cache', e);
      }
    };
    loadInitialCache();
  }, []);

  const fetchGlobalRates = useCallback((isManualRefresh = false) => {
    if (requestRef.current) return requestRef.current;
    const request = (async () => {
      const NOW = Date.now();
      const THIRTY_MINUTES = CACHE_DURATIONS.RATES_CONTEXT;

      try {
        if (mountedRef.current) {
          setLoadingRates(true);
          setError(null);
        }

        const lastFetchTime = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME).catch(() => null);

        // استراتيجية ذكية: إذا كان التحديث يدوياً وضمن الـ 30 دقيقة، نستخدم الخداع البصري للحفاظ على الـ API
        if (isManualRefresh && lastFetchTime && (NOW - parseInt(lastFetchTime) < THIRTY_MINUTES)) {
          // جلب البيانات من الكاش المحلي فقط لضمان استمرارية العرض
          isManualRefresh = false;
        }

        // الطلب الحقيقي (يحدث فقط كل 30 دقيقة)
        const data = await getCurrenciesData(isManualRefresh);

        if (!mountedRef.current) return;
        if (hasRates(data?.rates)) {
          const previousRates = ratesRef.current;
          ratesRef.current = data.rates;
          setRates(data.rates);
          if (!data._isFallback) setDataVersion(value => value + 1);
          // فحص تنبيهات الأسعار بعد تحديث الأسعار
          if (hasRates(previousRates) && !data._isFallback && !data._fromCache) {
            (async () => {
              try {
                const settingsStr = await AsyncStorage.getItem('@notification_settings');
                const settings = settingsStr ? JSON.parse(settingsStr) : null;
                if (settings?.enabled) {
                  await checkAndTriggerPriceAlerts(data.rates, previousRates, settings);
                }
              } catch (alertError) {
                console.warn('Price alert check failed:', alertError);
              }
            })();
          }
          // تحديث banqueMisrRates فقط إذا كانت تحتوي على بيانات
          if (data.banqueMisrRates) {
            setBanqueMisrRates(data.banqueMisrRates);
            setBanqueMisrIsFallback(!!data._bmIsFallback || !!data._offlineMode);
          }
          const updated = data._lastUpdated;
          if (updated && Number.isFinite(new Date(updated).getTime())) {
            setLastUpdated(getCurrentTime(updated));
          }
          if (data._isFallback) setError('unavailable');
        } else {
          setError('unavailable');
        }
      } catch (error) {
        console.error('Error in fetchGlobalRates:', error);
        if (mountedRef.current) setError('unavailable');
      } finally {
        if (mountedRef.current) setLoadingRates(false);
      }
    })();
    requestRef.current = request;
    request.finally(() => { requestRef.current = null; });
    return request;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchGlobalRates(false);
    let previousOnline;
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && previousOnline === false) fetchGlobalRates(false);
      previousOnline = online;
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') fetchGlobalRates(false);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
      subscription.remove();
    };
  }, [fetchGlobalRates]);

  return (
    <RatesContext.Provider value={{
      rates,
      banqueMisrRates,
      banqueMisrIsFallback,
      loadingRates,
      lastUpdated,
      error,
      dataVersion,
      refreshRates: fetchGlobalRates
    }}>
      {children}
    </RatesContext.Provider>
  );
};
