import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import MetalsScreen from '../screens/MetalsScreen';
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';

jest.mock('expo-haptics');
jest.mock('../hooks/useTheme');
jest.mock('../services/FinalMetalData', () => ({
  getMetalsData: jest.fn(() => Promise.resolve({
    'XAU_21': { price: 6184.97, buyPrice: 6203.53 },
    'SHOP_USD': { price: 50.11 },
    'BANK_USD': { price: 49.94 },
    'PRICE_GAP': { price: 23.95 },
    'XAU_OUNCE': { priceUSD: 2350, price: 219111.40 }
  }))
}));

const mockTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#000000',
    cardBg: '#F5F5F5',
    border: '#E0E0E0',
    sectionHeader: '#666666'
  },
  isDarkMode: false
};

const Providers = ({ children }) => (
  <SettingsContext.Provider value={{ language: 'ar', isDarkMode: false }}>
    <BaseCurrencyContext.Provider value={{ baseCurrency: 'EGP' }}>
      {children}
    </BaseCurrencyContext.Provider>
  </SettingsContext.Provider>
);

describe('Metals UI Integration', () => {
  beforeEach(() => {
    useTheme.mockReturnValue(mockTheme);
  });

  test('renders core metal price indicators', async () => {
    const { getByText } = render(<MetalsScreen />, { wrapper: Providers });

    await waitFor(() => {
      // Check for Sagha Dollar
      expect(getByText('50.11')).toBeTruthy();
      // Check for Bank Dollar
      expect(getByText('49.94')).toBeTruthy();
      // Check for Main 21K Price
      expect(getByText('6,184')).toBeTruthy();
    });
  });

  test('renders global indicators correctly', async () => {
    const { getByText } = render(<MetalsScreen />, { wrapper: Providers });

    await waitFor(() => {
      expect(getByText('$2,350')).toBeTruthy();
      expect(getByText('219,111')).toBeTruthy();
    });
  });
});
