import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import App from '../src/App';
import MetalsScreen from '../src/screens/MetalsScreen';
import RatesScreen from '../src/screens/RatesScreen';
import { RatesContext } from '../src/context/RatesContext';
import { getMetalsData } from '../src/services/FinalMetalData';
import { initializeNotifications } from '../src/services/notificationService';

jest.mock('../src/i18n', () => ({}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options?.defaultValue || key, i18n: { language: 'ar' } }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => 'true'), setItem: jest.fn(async () => {}) }));
jest.mock('../src/context/BaseCurrencyContext', () => {
  const React = require('react');
  return { BaseCurrencyContext: React.createContext({ baseCurrency: 'EGP' }), BaseCurrencyProvider: ({ children }) => children };
});
jest.mock('../src/context/SettingsContext', () => {
  const React = require('react');
  return { SettingsContext: React.createContext({ language: 'ar', isDarkMode: false, favorites: [], currencyAlerts: {} }), SettingsProvider: ({ children }) => children };
});
jest.mock('../src/context/RatesContext', () => {
  const React = require('react');
  return { RatesContext: React.createContext({}), RatesProvider: ({ children }) => children };
});
jest.mock('../src/services/authService', () => ({ processSyncQueue: jest.fn() }));
jest.mock('../src/utils/networkService', () => ({ addListener: jest.fn(), removeListener: jest.fn() }));
jest.mock('../src/services/notificationService', () => ({ initializeNotifications: jest.fn(() => new Promise(() => {})) }));
jest.mock('../src/services/FinalMetalData', () => ({ getMetalsData: jest.fn() }));
jest.mock('../src/services/currenciesCoreData', () => ({ getCurrenciesData: jest.fn() }));
jest.mock('../src/screens/OnboardingScreen', () => () => null);
jest.mock('../src/navigation/AppNavigator', () => {
  const { Text } = require('react-native');
  return () => <Text>application-ready</Text>;
});
jest.mock('../src/hooks/useTheme', () => ({ useTheme: () => ({ colors: { background: '#fff', text: '#000', border: '#eee' }, isDarkMode: false }) }));
jest.mock('../src/components/layout/NeoBackground', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../src/components/layout/ConnectionIndicator', () => () => null);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

beforeEach(() => { jest.clearAllMocks(); });

test('startup does not wait for notification initialization before showing navigation', async () => {
  const view = render(<App />);
  await act(async () => {});
  expect(initializeNotifications).toHaveBeenCalledTimes(1);
  expect(view.getByText('application-ready')).toBeTruthy();
});

test('missing metal data displays retry instead of zero prices', async () => {
  getMetalsData.mockResolvedValue({ _isFallback: true });
  const view = render(<MetalsScreen />);
  await act(async () => {});
  expect(view.getByText('تعذر تحميل أسعار المعادن. تحقق من الإنترنت ثم أعد المحاولة.')).toBeTruthy();
  expect(view.queryByText('0.00')).toBeNull();
  await act(async () => { fireEvent.press(view.getByText('إعادة المحاولة')); });
  expect(getMetalsData).toHaveBeenCalledTimes(2);
});

test('bank quotes remain in the currency card with EGP and cached status', async () => {
  jest.useFakeTimers();
  const view = render(<RatesContext.Provider value={{ rates: { USD: 1, EGP: 50 }, banqueMisrRates: { USD: { buy: 49.1, sell: 49.2, stale: true, quoteType: 'transfer' } }, loadingRates: false, lastUpdated: '', refreshRates: jest.fn() }}><RatesScreen /></RatesContext.Provider>);
  await act(async () => {});
  expect(view.getAllByText('0.00%')).toHaveLength(2);
  expect(view.getByText('49.10')).toBeTruthy();
  expect(view.getByText('49.20')).toBeTruthy();
  expect(view.getByText('بنك مصر · EGP')).toBeTruthy();
  expect(view.getByText('بيانات محفوظة')).toBeTruthy();
  expect(view.getByText('تحويلات')).toBeTruthy();
  await act(async () => { jest.runOnlyPendingTimers(); });
  view.unmount();
  jest.useRealTimers();
});

test('empty rates display an actionable message rather than a blank list', async () => {
  const refreshRates = jest.fn(async () => {});
  const view = render(<RatesContext.Provider value={{ rates: {}, banqueMisrRates: {}, loadingRates: false, lastUpdated: '', error: 'unavailable', refreshRates }}><RatesScreen /></RatesContext.Provider>);
  await act(async () => {});
  expect(view.getByText('تعذر تحميل الأسعار. تحقق من الإنترنت ثم أعد المحاولة.')).toBeTruthy();
  await act(async () => { fireEvent.press(view.getByText('إعادة المحاولة')); });
  expect(refreshRates).toHaveBeenCalledTimes(1);
});
