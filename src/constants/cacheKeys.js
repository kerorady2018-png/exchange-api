/**
 * مفاتيح الكاش الموحدة للتطبيق
 * لضمان التوافق وتجنب التضارب بين الخدمات المختلفة
 */

export const CACHE_KEYS = {
  // العملات والأسعار
  CURRENCIES: '@core_currencies_data',
  BM_RATES: '@core_bm_rates_data',
  CURRENCIES_TIME: '@core_currencies_fetch_time',
  
  // المعادن
  METALS: '@core_metals_data',
  METALS_TIME: '@core_metals_fetch_time',
  
  // قراءة الملف الثابت
  LAST_STATIC_FILE_REQUEST: '@last_static_file_request',
  
  // المستخدم والمصادقة (مفاتيح آمنة بدون @ لـ SecureStore)
  USER_NAME: 'secure_user_name',
  USER_PHONE: 'secure_user_phone',
  USER_EMAIL: 'secure_user_email',
  USER_COUNTRY: 'secure_user_country',
  IS_DATA_SAVED: '@is_data_saved',
  
  // المحفظة
  PORTFOLIO_ASSETS: 'portfolio_assets',
  PORTFOLIO_TOTAL_VALUE: 'portfolio_total_value',
  PORTFOLIO_TARGET: 'portfolio_target',
  PORTFOLIO_HIDE_VALUES: 'portfolio_hide_values',
  
  // المزامنة
  PENDING_CLOUD_SYNC: '@pending_cloud_sync',
  PORTFOLIO_NEEDS_SYNC: '@portfolio_needs_sync',
  LAST_MANUAL_SYNC: '@last_manual_sync_timestamp',
  LAST_AUTO_SYNC: '@last_auto_sync_timestamp',
  FIRST_ASSET_TIME: '@first_asset_added_time',
  
  // التاريخ
  PORTFOLIO_HISTORY: '@portfolio_value_history',
  ASSET_HISTORY_PREFIX: '@asset_value_history_',
  LAST_TRACK_DATE: '@last_history_track_date',
  
  // الإعدادات والمفضلة (مع إضافة المفاتيح البديلة لمنع Undefined)
  FAVORITES: '@favorite_currencies',
  FAVORITE_CURRENCIES: '@favorite_currencies', // للتوافق العكسي
  BASE_CURRENCY: '@base_currency',
  LANGUAGE: '@app_language',
  
  // المفاتيح القديمة (للتوافق)
  RATES_DATA: '@rates_data',
  PREV_RATES_DATA: '@previous_rates_data',
  PREVIOUS_RATES_DATA: '@previous_rates_data', // للتوافق العكسي
  RATES_LAST_DATE: '@rates_last_date',
  ONBOARDING_COMPLETED: '@onboarding_completed',
  
  // المحول
  CONVERTER_HISTORY: '@converter_history',
};

export const CACHE_DURATIONS = {
  CURRENCIES: 30 * 60 * 1000, // 30 دقيقة
  METALS: 30 * 60 * 1000,     // 30 دقيقة
  RATES_CONTEXT: 30 * 60 * 1000, // 30 دقيقة
  HISTORY_TRACKING: 24 * 60 * 60 * 1000, // 24 ساعة
  SYNC_MANUAL: 24 * 60 * 60 * 1000, // 24 ساعة
  SYNC_AUTO: 48 * 60 * 60 * 1000,   // 48 ساعة
  DEBOUNCE_DELAY: 3 * 1000,          // 3 ثوانٍ
  STATIC_FILE_READ_COOLDOWN: 5 * 60 * 1000, // 5 دقائق
};