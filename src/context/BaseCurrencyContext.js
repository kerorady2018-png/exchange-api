import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BaseCurrencyContext = createContext();

export const BaseCurrencyProvider = ({ children }) => {
  const [baseCurrency, setBaseCurrencyState] = useState('EGP');

  useEffect(() => {
    const loadBase = async () => {
      try {
        const storedBase = await AsyncStorage.getItem('@base_currency') ||
                           await AsyncStorage.getItem('baseCurrency') ||
                           await AsyncStorage.getItem('base_currency');
        if (storedBase) {
          setBaseCurrencyState(storedBase);
        }
      } catch (error) {
        console.error('Error loading base currency:', error);
      }
    };
    loadBase();
  }, []);

  const setBaseCurrency = async (currency) => {
    try {
      setBaseCurrencyState(currency);
      await AsyncStorage.setItem('@base_currency', currency);
      await AsyncStorage.setItem('baseCurrency', currency);
      await AsyncStorage.setItem('base_currency', currency);
    } catch (error) {
      console.error('Error saving base currency:', error);
    }
  };

  return (
    <BaseCurrencyContext.Provider value={{ baseCurrency, setBaseCurrency, changeBaseCurrency: setBaseCurrency }}>
      {children}
    </BaseCurrencyContext.Provider>
  );
};
