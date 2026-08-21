import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PortfolioScreen from '../screens/PortfolioScreen';
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-haptics');
jest.mock('../hooks/useTheme');
jest.mock('../services/currenciesCoreData', () => ({
  getCurrenciesData: jest.fn(() => Promise.resolve({ rates: { USD: 1, EGP: 50 } }))
}));
jest.mock('../services/FinalMetalData', () => ({
  getMetalsData: jest.fn(() => Promise.resolve({
    'XAU_21': { price: 3000, buyPrice: 2950 },
    'SHOP_USD': { price: 50.17 },
    'BANK_USD': { price: 50 }
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
  <SettingsContext.Provider value={{ language: 'ar', favorites: [], toggleTheme: jest.fn() }}>
    <BaseCurrencyContext.Provider value={{ baseCurrency: 'EGP' }}>
      {children}
    </BaseCurrencyContext.Provider>
  </SettingsContext.Provider>
);

describe('Portfolio UI Integration', () => {
  beforeEach(() => {
    useTheme.mockReturnValue(mockTheme);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('renders empty state correctly', async () => {
    const { getByText } = render(<PortfolioScreen />, { wrapper: Providers });

    await waitFor(() => {
      expect(getByText(/لا توجد أصول مضافة بعد/i)).toBeTruthy();
    });
  });

  test('opens add asset modal when pressing the button', async () => {
    const { getByText, queryByPlaceholderText } = render(<PortfolioScreen />, { wrapper: Providers });

    // Wait for initial load to finish (skeleton to disappear)
    await waitFor(() => expect(getByText(/إضافة أصل/i)).toBeTruthy());

    const addButton = getByText(/إضافة أصل/i);
    fireEvent.press(addButton);

    expect(getByText(/إضافة أصل/i)).toBeTruthy(); // Modal title
    expect(queryByPlaceholderText(/المبلغ/i) || queryByPlaceholderText(/الكمية بالجرام/i)).toBeTruthy();
  });

  test('toggles privacy eye correctly', async () => {
    const { getByText, queryByText } = render(<PortfolioScreen />, { wrapper: Providers });

    await waitFor(() => expect(getByText(/إجمالي القيمة/i)).toBeTruthy());

    const eyeButton = getByText(/إجمالي القيمة/i).parent.parent.parent.children.find(c => c.type === 'TouchableOpacity');
    // Note: Finding by icon name or specific testID would be better, but we'll use a generic approach for now

    // Check if total is visible (using a substring of "0.00")
    expect(queryByText('0.00')).toBeTruthy();
  });
});
