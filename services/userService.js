// src/services/userService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_STORAGE_KEY = '@user_portfolio_data';
const API_BASE_URL = 'https://exchange-api-sepia.vercel.app';

export const saveDataToAtlas = async (userData) => {
  try {
    // 1. الحفظ المحلي المباشر لضمان تجربة حية وفعالة
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userData));
    console.log('✅ Portfolio saved locally');

    // 2. مزامنة الخلفية
    try {
      const response = await fetch(`${API_BASE_URL}/api/save-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          portfolio: userData.portfolio,
          totalValue: userData.totalValue
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.user || userData;
      }
    } catch (cloudError) {
      console.warn('⚠️ Cloud Sync Notice (Saved locally):', cloudError.message);
    }

    return userData;
  } catch (error) {
    console.error('❌ Error saving portfolio data:', error.message);
    throw error;
  }
};

export const restoreDataFromAtlas = async (identifier) => {
  try {
    const isEmail = identifier.includes('@');
    const requestBody = isEmail 
      ? { email: identifier.trim().toLowerCase() } 
      : { phone: identifier.trim() };

    const response = await fetch(`${API_BASE_URL}/api/get-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.user) return result.user;
    }

    const localData = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) return JSON.parse(localData);

    throw new Error('User not found');
  } catch (error) {
    const localData = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) return JSON.parse(localData);
    throw error;
  }
};