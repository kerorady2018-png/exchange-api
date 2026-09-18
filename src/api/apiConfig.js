import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withRetry } from '../utils/networkUtils';

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

export const CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes

const SNAPSHOT_KEY = '@static_data_snapshot_v1';
let snapshot = null;
let snapshotRequest = null;
let storageLoaded = false;

export const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const isPositivePrice = value => (typeof value === 'number' || typeof value === 'string') &&
  Number.isFinite(Number(value)) && Number(value) > 0;

export function validRates(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, rate]) => isPositivePrice(rate))
    .map(([code, rate]) => [code, Number(rate)]));
}

export function validBankRates(value) {
  if (!isRecord(value)) return {};
  const now = Date.now();
  return Object.fromEntries(Object.entries(value).filter(([code, quote]) => {
    if (!/^[A-Z]{3}$/.test(code) || !isRecord(quote) || !isPositivePrice(quote.buy) ||
        !isPositivePrice(quote.sell) || Number(quote.sell) < Number(quote.buy)) return false;
    return [quote.sourceUpdatedAt, quote.fetchedAt].filter(time => time != null).every(time => {
      const age = now - Date.parse(time);
      return Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= 7 * 24 * 60 * 60 * 1000;
    });
  }).map(([code, quote]) => [code, quote.fetchedAt && now - Date.parse(quote.fetchedAt) > 60 * 60 * 1000
    ? { ...quote, stale: true } : quote]));
}

export async function readCachedValue(key) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

export async function writeCachedValue(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Unable to persist price cache:', error.message);
  }
}

function validPayload(payload) {
  if (!isRecord(payload) || payload.success === false || payload.status === 'error') return false;
  const rates = validRates(payload.currencies?.rates || payload.rates);
  const calculated = validRates(payload.calculatedRates);
  const metals = payload.metals || {};
  const gold = metals.goldData || metals.gold || payload.goldData;
  const silver = metals.silverData || metals.silver || payload.silverData;
  return Object.keys(rates).some(code => code !== 'USD' && /^[A-Z]{3}$/.test(code)) ||
    ['XAU_24', 'XAU_21', 'XAG_GRAM'].some(key => isPositivePrice(calculated[key])) ||
    [gold?.price_ounce, gold?.data?.price, gold?.price, gold?.price_gram_24k,
      silver?.price_ounce, silver?.data?.price, silver?.price, silver?.price_gram].some(isPositivePrice);
}

function sourceTimestamp(payload) {
  const value = payload.lastUpdated ?? payload.updatedAt ?? payload.timestamp;
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function snapshotResult(value, fromCache, fallback = false) {
  const checkedAt = value.payload.checkedAt;
  const checkedAge = Date.now() - Date.parse(checkedAt);
  fallback = fallback || (checkedAt !== undefined && (!Number.isFinite(checkedAge) || checkedAge < -5 * 60 * 1000 || checkedAge > 60 * 60 * 1000));
  return {
    payload: value.payload,
    _fetchedAt: value.fetchedAt,
    _lastUpdated: sourceTimestamp(value.payload),
    _fromCache: fromCache,
    ...(fallback ? { _isFallback: true, _offlineMode: true } : {}),
  };
}

export function fetchStaticSnapshot(options = {}) {
  if (snapshotRequest) return snapshotRequest;
  snapshotRequest = (async () => {
    if (!storageLoaded) {
      const cached = await readCachedValue(SNAPSHOT_KEY);
      if (cached && validPayload(cached.payload) && Number.isFinite(cached.fetchedAt) &&
          cached.fetchedAt > 0 && cached.fetchedAt <= Date.now()) {
        snapshot = cached;
      }
      storageLoaded = true;
    }
    const age = snapshot ? Date.now() - snapshot.fetchedAt : Infinity;
    if (snapshot && age >= 0 && age < CACHE_DURATION) {
      return snapshotResult(snapshot, true);
    }
    try {
      const response = await withRetry(() => apiClient.get('/api/static-data', {
        timeout: options.timeout || 10000,
      }));
      let payload = response.data;
      for (let depth = 0; depth < 3 && !validPayload(payload) && isRecord(payload?.data); depth++) {
        if (payload.success === false || payload.status === 'error') break;
        payload = payload.data;
      }
      if (!validPayload(payload)) throw new Error('Invalid static data snapshot');
      snapshot = { payload, fetchedAt: Date.now() };
      await writeCachedValue(SNAPSHOT_KEY, snapshot);
      return snapshotResult(snapshot, false);
    } catch (error) {
      if (snapshot) return snapshotResult(snapshot, true, true);
      throw error;
    }
  })().finally(() => { snapshotRequest = null; });
  return snapshotRequest;
}
