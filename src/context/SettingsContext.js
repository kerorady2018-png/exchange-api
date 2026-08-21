import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import i18n from '../i18n';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [favorites, setFavorites] = useState([]);
  
  const [currencyAlerts, setCurrencyAlerts] = useState({});
  const [metalAlerts, setMetalAlerts] = useState({});
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // فرض الاتجاه من اليسار لليمين (LTR) عالمياً عند بدء التشغيل
    const forceLTR = () => {
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }
    };
    forceLTR();

    const loadSettings = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('isDarkMode');
        const storedLang = await AsyncStorage.getItem('language');
        const storedFavorites = await AsyncStorage.getItem('favorites');
        const storedCurrencyAlerts = await AsyncStorage.getItem('currencyAlerts');
        const storedMetalAlerts = await AsyncStorage.getItem('metalAlerts');
        
        if (storedTheme !== null) {
          setIsDarkMode(JSON.parse(storedTheme));
        }

        if (storedLang) {
          setLanguage(storedLang);
          i18n.changeLanguage(storedLang);
        }
        
        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }

        if (storedCurrencyAlerts) {
          setCurrencyAlerts(JSON.parse(storedCurrencyAlerts));
        }

        if (storedMetalAlerts) {
          setMetalAlerts(JSON.parse(storedMetalAlerts));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const changeLanguage = async (lang) => {
    try {
      setLanguage(lang);
      await AsyncStorage.setItem('language', lang);
      i18n.changeLanguage(lang);

      // التأكد من بقاء التطبيق في وضع LTR حتى عند تغيير اللغة للعربية
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const toggleFavorite = async (currency) => {
    try {
      const newFavorites = favorites.includes(currency) 
        ? favorites.filter(c => c !== currency) 
        : [...favorites, currency];
        
      setFavorites(newFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const updateFavorites = async (newFavorites) => {
    try {
      setFavorites(newFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const updateCurrencyAlert = async (currency, value) => {
    try {
      setCurrencyAlerts(prev => {
        const updated = { ...prev, [currency]: value };
        AsyncStorage.setItem('currencyAlerts', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error saving currency alert:', error);
    }
  };

  const removeCurrencyAlert = async (currency) => {
    try {
      setCurrencyAlerts(prev => {
        const updated = { ...prev };
        delete updated[currency];
        AsyncStorage.setItem('currencyAlerts', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error removing currency alert:', error);
    }
  };

  const updateMetalAlert = async (metalKey, target, step) => {
    try {
      setMetalAlerts(prev => {
        const updated = { 
          ...prev, 
          [metalKey]: { target, step } 
        };
        AsyncStorage.setItem('metalAlerts', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error saving metal alert:', error);
    }
  };

  const removeMetalAlert = async (metalKey) => {
    try {
      setMetalAlerts(prev => {
        const updated = { ...prev };
        delete updated[metalKey];
        AsyncStorage.setItem('metalAlerts', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error removing metal alert:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      isDarkMode, 
      toggleTheme, 
      language, 
      changeLanguage, 
      favorites, 
      toggleFavorite,
      updateFavorites,
      currencyAlerts,
      updateCurrencyAlert,
      removeCurrencyAlert,
      metalAlerts,
      updateMetalAlert,
      removeMetalAlert,
      isLoading
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
