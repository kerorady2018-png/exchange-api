import { getCurrenciesData } from '../services/currenciesCoreData';
import { fetchCurrenciesFromApi } from '../services/currenciesCore';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../services/currenciesCore');
jest.mock('@react-native-async-storage/async-storage');

describe('CurrenciesCoreData', () => {
  const mockApiData = {
    rates: { EGP: 50.15, EUR: 0.92 },
    banqueMisrRates: { USD: { buy: 50.10, sell: 50.20 } }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return cached data if interval is not exceeded', async () => {
    const lastFetch = Date.now() - 1000; // Just 1 second ago
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === '@core_currencies_fetch_time') return Promise.resolve(lastFetch.toString());
      if (key === '@core_currencies_data') return Promise.resolve(JSON.stringify(mockApiData.rates));
      if (key === '@core_bm_rates_data') return Promise.resolve(JSON.stringify(mockApiData.banqueMisrRates));
      return Promise.resolve(null);
    });

    const result = await getCurrenciesData();

    expect(fetchCurrenciesFromApi).not.toHaveBeenCalled();
    expect(result.rates.EGP).toBe(50.15);
  });

  test('should fetch fresh data if no cache exists', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    fetchCurrenciesFromApi.mockResolvedValue(mockApiData);

    const result = await getCurrenciesData();

    expect(fetchCurrenciesFromApi).toHaveBeenCalled();
    expect(result.rates.EGP).toBe(50.15);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@core_currencies_data', expect.any(String));
  });
});
