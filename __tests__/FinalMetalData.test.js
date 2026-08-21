import { getMetalsData } from '../services/FinalMetalData';
import { fetchRawMetalsApiData } from '../services/metalsCore';
import { getCurrenciesData } from '../services/currenciesCoreData';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../services/metalsCore');
jest.mock('../services/currenciesCoreData');
jest.mock('@react-native-async-storage/async-storage');

describe('FinalMetalData Mathematical Engine', () => {
  const mockApiData = {
    goldData: { data: { price: 2350 } }, // USD per Ounce
    silverData: { data: { price: 30 } },
    globalRates: { EGP: 50 } // Official Bank Rate
  };

  const mockCurrencies = {
    rates: { EGP: 50, USD: 1 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should calculate Sagha Dollar with 1.0034 multiplier', async () => {
    fetchRawMetalsApiData.mockResolvedValue(mockApiData);
    getCurrenciesData.mockResolvedValue(mockCurrencies);

    const result = await getMetalsData('EGP');

    // Bank: 50, Multiplier: 1.0034 -> 50.17
    expect(result['SHOP_USD'].price).toBeCloseTo(50.17, 2);
    expect(result['BANK_USD'].price).toBe(50);
  });

  test('should calculate 21K gold price correctly based on Sagha Dollar', async () => {
    fetchRawMetalsApiData.mockResolvedValue(mockApiData);
    getCurrenciesData.mockResolvedValue(mockCurrencies);

    const result = await getMetalsData('EGP');

    // (2350 / 31.1034768) * 50.17 (Sagha USD) * (21/24)
    const saghaUSD = 50 * 1.0034;
    const expected24K = (2350 / 31.1034768) * saghaUSD;
    const expected21K = expected24K * (21 / 24);

    expect(result['XAU_21'].price).toBeCloseTo(expected21K, 1);
  });

  test('should calculate Price Gap correctly', async () => {
    fetchRawMetalsApiData.mockResolvedValue(mockApiData);
    getCurrenciesData.mockResolvedValue(mockCurrencies);

    const result = await getMetalsData('EGP');

    // Gap = (Local 24K) - (Global 24K at Bank Rate)
    const saghaUSD = 50 * 1.0034;
    const local24K = (2350 / 31.1034768) * saghaUSD;
    const global24K = (2350 / 31.1034768) * 50;
    const expectedGap = local24K - global24K;

    expect(result['PRICE_GAP'].price).toBeCloseTo(expectedGap, 1);
  });
});
