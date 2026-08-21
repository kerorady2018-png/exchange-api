import AuthService from '../services/authService';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureStorageService from '../services/secureStorageService';

jest.mock('axios');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../services/secureStorageService');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('formatPhone should remove leading zeros and whitespace', () => {
    expect(AuthService.formatPhone(' 01281794762 ')).toBe('1281794762');
    expect(AuthService.formatPhone('12345')).toBe('12345');
    expect(AuthService.formatPhone('')).toBe('');
  });

  test('validateUserData should return invalid for short names', () => {
    const result = AuthService.validateUserData('A', '123', 'test@test.com');
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe(true);
  });

  test('validateUserData should return invalid if both phone and email are missing', () => {
    const result = AuthService.validateUserData('Valid Name', '', '');
    expect(result.isValid).toBe(false);
    expect(result.errors.phone).toBe(true);
  });

  test('saveUser should store data locally and sync with cloud', async () => {
    const userData = {
      name: 'Test User',
      phone: '123456789',
      email: 'test@example.com',
      countryCode: '+20',
      portfolio: [],
      target: null
    };

    axios.post.mockResolvedValue({ data: { id: '123' } });

    const result = await AuthService.saveUser(userData);

    expect(SecureStorageService.save).toHaveBeenCalledWith('secure_user_name', 'Test User');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@is_data_saved', 'true');
    expect(axios.post).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('saveUser should return success even if cloud sync fails', async () => {
    const userData = { name: 'Test User', phone: '123' };
    axios.post.mockRejectedValue(new Error('Network Error'));

    const result = await AuthService.saveUser(userData);

    expect(result.success).toBe(true);
    expect(result.isLocalOnly).toBe(true);
  });
});
