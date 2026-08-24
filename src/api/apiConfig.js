import axios from 'axios';

export const BASE_URL = 'https://exchange-api-sepia.vercel.app';
export const STATIC_DATA_URL = `${BASE_URL}/api/static-data`;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

export const CACHE_KEYS = {
  RATES: 'last_rates_data_cache',
  METALS: 'last_metals_data_cache',
  TIMESTAMP: 'last_rates_fetch_timestamp',
};

export const CACHE_DURATION = 30 * 60 * 1000; // 30 Minutes
