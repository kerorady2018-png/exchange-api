import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const SYNC_TASK_NAME = 'user-data-sync-task';
const LAST_SYNCED_ASSETS_KEY = '@last_synced_assets_hash';
const LAST_SYNCED_TARGET_KEY = '@last_synced_target';

// دالة إنشاء hash للأصول فقط (بدون القيم) للمقارنة
const createAssetsHash = (assets) => {
  if (!assets || !Array.isArray(assets)) return '';
  
  // إنشاء hash يعتمد فقط على:
  // - عدد الأصول
  // - نوع كل أصل (currency)
  // - كمية كل أصل (amount)
  // - معرف الأصل (id)
  // ولا يشمل القيم الحالية أو القيم الأولية
  const assetsStructure = assets.map(asset => ({
    id: asset.id,
    currency: asset.currency,
    amount: asset.amount,
    assetType: asset.assetType
  }));
  
  const str = JSON.stringify(assetsStructure);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// دالة التحقق من تغير الأصول فقط (إضافة/إزالة/تعديل)
const hasAssetsChanged = async () => {
  try {
    const currentAssets = await AsyncStorage.getItem('portfolio_assets');
    const currentTarget = await AsyncStorage.getItem('portfolio_target');
    
    const lastSyncedAssetsHash = await AsyncStorage.getItem(LAST_SYNCED_ASSETS_KEY);
    const lastSyncedTarget = await AsyncStorage.getItem(LAST_SYNCED_TARGET_KEY);
    
    // إذا لم يكن هناك بيانات محفوظة من آخر مزامنة، نعتبر البيانات متغيرة
    if (!lastSyncedAssetsHash || !lastSyncedTarget) {
      return true;
    }
    
    // حساب hash للأصول الحالية (بدون القيم)
    const currentAssetsHash = createAssetsHash(currentAssets ? JSON.parse(currentAssets) : []);
    const currentTargetStr = currentTarget || '';
    
    // مقارنة الأصول الحالية مع المحفوظة
    const assetsChanged = currentAssetsHash !== lastSyncedAssetsHash;
    const targetChanged = currentTargetStr !== lastSyncedTarget;
    
    // البيانات تغيرت إذا تغيرت الأصول (إضافة/إزالة/تعديل) أو الهدف
    return assetsChanged || targetChanged;
  } catch (error) {
    console.error('Error checking assets changes:', error);
    return true; // في حالة الخطأ، نقوم بالمزامنة
  }
};

export async function syncUserDataTask() {
  try {
    const savedName = await AsyncStorage.getItem('@user_name');
    const savedPhone = await AsyncStorage.getItem('@user_phone');
    const savedCountry = await AsyncStorage.getItem('@user_country');
    const savedEmail = await AsyncStorage.getItem('@user_email');
    const savedAssets = await AsyncStorage.getItem('portfolio_assets');
    const savedTarget = await AsyncStorage.getItem('portfolio_target');

    if (!savedName) {
      console.log('No user data to sync');
      return;
    }

    // التحقق من تغير الأصول فقط (إضافة/إزالة/تعديل) قبل المزامنة
    const assetsChanged = await hasAssetsChanged();
    
    if (!assetsChanged) {
      console.log('No assets changes detected (same structure), skipping sync to save API requests');
      return;
    }

    const fullPhoneNumber = savedPhone ? `${savedCountry}${savedPhone}` : '';
    const cleanEmail = savedEmail ? savedEmail.toLowerCase() : undefined;
    const portfolio = savedAssets ? JSON.parse(savedAssets) : [];

    const response = await axios.post('https://exchange-api-sepia.vercel.app/api/save-user', {
      name: savedName,
      phone: fullPhoneNumber,
      email: cleanEmail,
      portfolio: portfolio,
      target: savedTarget || null,
      date: new Date().toISOString(),
      syncType: 'automatic'
    });

    if (response.status === 200 || response.status === 201) {
      // حفظ hash الأصول الحالية (بدون القيم) للمقارنة المستقبلية
      const currentAssetsHash = createAssetsHash(portfolio);
      await AsyncStorage.setItem(LAST_SYNCED_ASSETS_KEY, currentAssetsHash);
      await AsyncStorage.setItem(LAST_SYNCED_TARGET_KEY, savedTarget || '');
      await AsyncStorage.setItem('@user_data_last_sync_time', Date.now().toString());
      
      console.log('User data synced successfully via background task (assets structure changed)');
    }
  } catch (error) {
    console.error('Error syncing user data in background task:', error);
  }
}

TaskManager.defineTask(SYNC_TASK_NAME, syncUserDataTask);