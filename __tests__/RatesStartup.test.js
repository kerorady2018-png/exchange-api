import React, { useContext } from 'react';
import { Text, AppState } from 'react-native';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { RatesProvider, RatesContext } from '../src/context/RatesContext';
import { getCurrenciesData } from '../src/services/currenciesCoreData';
import { checkAndTriggerPriceAlerts } from '../src/services/priceAlertChecker';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));
jest.mock('../src/services/currenciesCoreData', () => ({ getCurrenciesData: jest.fn() }));
jest.mock('../src/services/priceAlertChecker', () => ({ checkAndTriggerPriceAlerts: jest.fn() }));

let current;
const Probe = () => {
  current = useContext(RatesContext);
  return <Text>{current.rates.EGP || 'empty'}</Text>;
};
const mount = async () => {
  const result = render(<RatesProvider><Probe /></RatesProvider>);
  await act(async () => {});
  return result;
};
const snapshot = () => ({ rates: { USD: 1, EGP: 50 }, banqueMisrRates: {}, _lastUpdated: Date.now() });

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  getCurrenciesData.mockReset();
  checkAndTriggerPriceAlerts.mockReset();
});

test('fresh install fetches once, not again after setting a new rates object', async () => {
  getCurrenciesData.mockResolvedValueOnce(snapshot()).mockImplementation(() => new Promise(() => {}));
  const view = await mount();
  expect(view.getByText('50')).toBeTruthy();
  expect(getCurrenciesData).toHaveBeenCalledTimes(1);
  view.unmount();
});

test('empty fallback stops loading and reports an error without an automatic fetch loop', async () => {
  getCurrenciesData.mockResolvedValueOnce({ rates: {}, _isFallback: true }).mockImplementation(() => new Promise(() => {}));
  const view = await mount();
  expect(current.loadingRates).toBe(false);
  expect(current.error).toBeTruthy();
  expect(current.lastUpdated).toBe('');
  expect(getCurrenciesData).toHaveBeenCalledTimes(1);
  view.unmount();
});

test('manual requests share a pending startup operation', async () => {
  let resolve;
  getCurrenciesData.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = await mount();
  await act(async () => {
    current.refreshRates();
    current.refreshRates();
  });
  expect(getCurrenciesData).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(snapshot()); });
  expect(current.loadingRates).toBe(false);
  view.unmount();
});

test('reconnect recovers after startup failure without closing the app', async () => {
  getCurrenciesData.mockResolvedValueOnce({ rates: {}, _isFallback: true }).mockResolvedValue(snapshot());
  const view = await mount();
  const networkChanged = NetInfo.addEventListener.mock.calls[0][0];
  await act(async () => { networkChanged({ isConnected: false, isInternetReachable: false }); });
  await act(async () => { networkChanged({ isConnected: true, isInternetReachable: true }); });
  expect(current.rates.EGP).toBe(50);
  expect(current.error).toBe(null);
  expect(getCurrenciesData).toHaveBeenCalledTimes(2);
  view.unmount();
});

test('storage failure does not block a successful network result', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  AsyncStorage.getItem.mockRejectedValue(new Error('storage unavailable'));
  getCurrenciesData.mockResolvedValue(snapshot());
  const view = await mount();
  expect(current.rates.EGP).toBe(50);
  expect(current.error).toBeNull();
  view.unmount();
  warning.mockRestore();
});

test('a slow notification checker does not block completion of price loading', async () => {
  AsyncStorage.getItem.mockImplementation(async key => key === '@notification_settings' ? '{"enabled":true}' : null);
  getCurrenciesData.mockResolvedValue(snapshot());
  checkAndTriggerPriceAlerts.mockImplementation(() => new Promise(() => {}));
  const view = await mount();
  await act(async () => { await current.refreshRates(); });
  expect(checkAndTriggerPriceAlerts).toHaveBeenCalledTimes(1);
  expect(current.loadingRates).toBe(false);
  view.unmount();
});

test('failed refresh preserves displayed data and its update timestamp', async () => {
  getCurrenciesData.mockResolvedValueOnce(snapshot()).mockResolvedValue({ rates: {}, _isFallback: true });
  const view = await mount();
  const updated = current.lastUpdated;
  await act(async () => { await current.refreshRates(); });
  expect(current.rates.EGP).toBe(50);
  expect(current.lastUpdated).toBe(updated);
  expect(current.error).toBeTruthy();
  view.unmount();
});
