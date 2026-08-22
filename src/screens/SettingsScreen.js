import React, { useContext, useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, SafeAreaView, ActivityIndicator, TouchableOpacity, Linking, KeyboardAvoidingView, ScrollView, Platform, Image, Modal, FlatList, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { SettingsContext } from '../context/SettingsContext';
import { currencyInfo } from '../constants/currencyData';
import { useTheme } from '../hooks/useTheme';
import { CACHE_KEYS } from '../constants/cacheKeys';

import CustomPicker from '../components/common/CustomPicker';
import MultiSelectPicker from '../components/common/MultiSelectPicker';
import BaseCurrencySelector from '../components/common/BaseCurrencySelector';
import AuthService from '../services/authService';
import SecureStorageService from '../utils/secureStorageService';

const SettingsScreen = () => {
  const { i18n, t } = useTranslation();
  const { 
    isDarkMode, 
    toggleTheme, 
    language, 
    changeLanguage, 
    favorites, 
    updateFavorites 
  } = useContext(SettingsContext);
  
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('+20');
  const [errors, setErrors] = useState({});

  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [isDataSaved, setIsDataSaved] = useState(false);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  useEffect(() => {
    const loadSavedUserData = async () => {
      try {
        const savedName = await SecureStorageService.getValue(CACHE_KEYS?.USER_NAME || 'USER_NAME');
        const savedPhone = await SecureStorageService.getValue(CACHE_KEYS?.USER_PHONE || 'USER_PHONE');
        const savedCountry = await SecureStorageService.getValue(CACHE_KEYS?.USER_COUNTRY || 'USER_COUNTRY');
        const savedEmail = await SecureStorageService.getValue(CACHE_KEYS?.USER_EMAIL || 'USER_EMAIL');
        const savedStatus = await AsyncStorage.getItem(CACHE_KEYS?.IS_DATA_SAVED || '@is_data_saved');

        if (savedName) {
          setUserName(savedName);
          if (savedPhone) setUserPhone(savedPhone);
          if (savedCountry) setSelectedCountry(savedCountry);
          if (savedEmail) setUserEmail(savedEmail);
          if (savedStatus === 'true') setIsDataSaved(true);
        }
      } catch (error) {
        console.warn('Failed to load secure data:', error.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedUserData();
    setAvailableCurrencies(Object.keys(currencyInfo));
  }, []);

  const languagesList = useMemo(() => [
    { code: 'ar', nameAr: 'العربية', nameEn: 'Arabic', flag: '🇸🇦' },
    { code: 'en', nameAr: 'الإنجليزية', nameEn: 'English', flag: '🇺🇸' },
    { code: 'fr', nameAr: 'الفرنسية', nameEn: 'French', flag: '🇫🇷' },
    { code: 'es', nameAr: 'الإسبانية', nameEn: 'Spanish', flag: '🇪🇸' },
    { code: 'de', nameAr: 'الألمانية', nameEn: 'German', flag: '🇩🇪' },
    { code: 'tr', nameAr: 'التركية', nameEn: 'Turkish', flag: '🇹🇷' },
    { code: 'it', nameAr: 'الإيطالية', nameEn: 'Italian', flag: '🇮🇹' },
    { code: 'ru', nameAr: 'الروسية', nameEn: 'Russian', flag: '🇷🇺' },
    { code: 'zh', nameAr: 'الصينية', nameEn: 'Chinese', flag: '🇨🇳' },
    { code: 'ur', nameAr: 'الأردية', nameEn: 'Urdu', flag: '🇵🇰' },
    { code: 'nl', nameAr: 'الهولندية', nameEn: 'Dutch', flag: '🇳🇱' },
  ], []);

  const countriesList = useMemo(() => [
    { nameAr: 'مصر', nameEn: 'Egypt', flag: '🇪🇬', value: '+20' },
    { nameAr: 'السعودية', nameEn: 'Saudi Arabia', flag: '🇸🇦', value: '+966' },
    { nameAr: 'الإمارات', nameEn: 'UAE', flag: '🇦🇪', value: '+971' },
    { nameAr: 'الكويت', nameEn: 'Kuwait', flag: '🇰🇼', value: '+965' },
    { nameAr: 'قطر', nameEn: 'Qatar', flag: '🇶🇦', value: '+974' },
    { nameAr: 'البحرين', nameEn: 'Bahrain', flag: '🇧🇭', value: '+973' },
    { nameAr: 'عمان', nameEn: 'Oman', flag: '🇴🇲', value: '+968' },
    { nameAr: 'الأردن', nameEn: 'Jordan', flag: '🇯🇴', value: '+962' },
    { nameAr: 'العراق', nameEn: 'Iraq', flag: '🇮🇶', value: '+964' },
    { nameAr: 'تركيا', nameEn: 'Turkey', flag: '🇹🇷', value: '+90' },
    { nameAr: 'المملكة المتحدة', nameEn: 'UK', flag: '🇬🇧', value: '+44' },
    { nameAr: 'الولايات المتحدة', nameEn: 'USA', flag: '🇺🇸', value: '+1' },
  ], []);

  const filteredCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) return countriesList;
    const query = countrySearchQuery.toLowerCase();
    return countriesList.filter(
      c => c.nameAr.toLowerCase().includes(query) ||
           c.nameEn.toLowerCase().includes(query) ||
           c.value.includes(query)
    );
  }, [countrySearchQuery, countriesList]);

  const currentSelectedCountryObj = useMemo(() => {
    return countriesList.find(c => c.value === selectedCountry) || countriesList[0];
  }, [selectedCountry, countriesList]);

  const openWhatsAppSupport = () => {
    const phoneNumber = '+201281794762';
    const webUrl = `https://wa.me/${phoneNumber}`;
    Linking.openURL(webUrl).catch(() => {
      alert(t('messages.whatsapp_not_installed'));
    });
  };

  const handleSaveUserData = async () => {
    const validation = AuthService.validateUserData(userName, userPhone, userEmail);
    if (!validation.isValid) {
      setErrors(validation.errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsProcessing(true);
      setErrors({});
      const portfolioAssetsRaw = await AsyncStorage.getItem(CACHE_KEYS?.PORTFOLIO_ASSETS || '@portfolio_assets');
      const portfolioTarget = await AsyncStorage.getItem(CACHE_KEYS?.PORTFOLIO_TARGET || '@portfolio_target');
      const portfolioTotalValueRaw = await AsyncStorage.getItem(CACHE_KEYS?.PORTFOLIO_TOTAL_VALUE || '@portfolio_total_value');

      const portfolioAssets = portfolioAssetsRaw ? JSON.parse(portfolioAssetsRaw) : [];
      const totalValueNum = portfolioTotalValueRaw ? parseFloat(portfolioTotalValueRaw) : 0;

      const response = await AuthService.saveUser({
        name: userName.trim(),
        phone: userPhone.trim(),
        email: userEmail.trim().toLowerCase(),
        countryCode: selectedCountry,
        portfolio: portfolioAssets,
        totalValue: totalValueNum,
        target: portfolioTarget || null
      }, true);

      if (response.success) {
        setIsDataSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert(t('common.data_saved'));
      } else if (response.rate_limited) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          t('common.attention', { defaultValue: 'تنبيه' }),
          t('messages.sync_limit_reached', {
            defaultValue: `لقد وصلت للحد الأقصى للمزامنة اليدوية. يرجى الانتظار ${response.remainingHours} ساعة للمرة القادمة.`,
            hours: response.remainingHours
          })
        );
      } else {
        alert(t('common.save_error'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreUserData = async () => {
    if (!userPhone.trim() && !userEmail.trim()) {
      alert(t('common.restore_error'));
      return;
    }

    try {
      setIsProcessing(true);
      setErrors({});
      const response = await AuthService.getUser(userPhone, userEmail, selectedCountry);
      if (response.success && response.user) {
        const userData = response.user;
        const ok = await AuthService.applyRestoredData(userData, selectedCountry);
        if (ok) {
          setUserName(userData.name || '');
          setUserEmail(userData.email || '');
          if (userData.phone) {
             const purePhone = userData.phone.startsWith(selectedCountry)
               ? userData.phone.replace(selectedCountry, '').trim()
               : userData.phone.trim();
             setUserPhone(purePhone);
          }
          setIsDataSaved(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          alert(t('common.data_restored'));
        }
      } else {
        alert(t('common.no_data'));
      }
    } catch (error) {
      console.error('Error restoring data:', error);
      alert(t('common.restore_error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUserData = async () => {
    try {
      Haptics.selectionAsync();
      
      // 1. مسح المفاتيح الآمنة
      await SecureStorageService.clearAllUserData();
      
      // 2. مسح حالة الحفظ
      await AsyncStorage.removeItem(CACHE_KEYS?.IS_DATA_SAVED || '@is_data_saved');
      
      // 3. تفريغ المدخلات وحالة الشاشة لتفتح استمارة الإدخال من جديد
      setUserName('');
      setUserPhone('');
      setUserEmail('');
      setIsDataSaved(false);
      setErrors({});
      
    } catch (error) {
      console.error('Clear data error:', error);
    }
  };

  const currencyItems = useMemo(() => {
    const keys = availableCurrencies.length > 0 ? availableCurrencies : Object.keys(currencyInfo);
    const priorityOrder = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'GBP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD'];

    return [...keys].sort((a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    }).map(currency => ({
      label: `${currencyInfo[currency]?.flag || '🌐'} ${currency} - ${t(`currencies.${currency}`, { defaultValue: currencyInfo[currency]?.name || currency })}`,
      value: currency
    }));
  }, [availableCurrencies, language, t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {isProcessing && <View style={styles.overlay}><ActivityIndicator size="large" color="#007AFF" /></View>}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.logoHeaderContainer}>
            <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={[styles.appNameText, { color: colors.text }]}>{t('app_subtitle')}</Text>
            {isDataSaved ? (
              <View style={styles.userProfileHeader}>
                <Text style={[styles.userNameDisplay, { color: colors.text }]}>{userName}</Text>
                <TouchableOpacity onPress={handleEditUserData} style={[styles.editButtonSmall, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <Ionicons name="pencil" size={12} color={colors.text} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.appVersionText, { color: colors.sectionHeader }]}>{t('settings.version')}</Text>
            )}
          </View>

          {/* APP PREFERENCES */}
          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.app_preferences')}</Text>
            <View style={styles.preferenceRow}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.dark_mode')}</Text>
              <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: '#387c9f' }} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
            </View>
            <View style={styles.preferenceRow}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.language')}</Text>
              <CustomPicker selectedValue={language} onValueChange={changeLanguage} items={languagesList.map(l => ({ label: `${l.flag} ${language === 'ar' ? l.nameAr : l.nameEn}`, value: l.code }))} label={t('common.language')} />
            </View>
            <View style={[styles.preferenceRow, { borderBottomWidth: 0, marginTop: 2 }]}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.base_currency')}</Text>
              <BaseCurrencySelector />
            </View>
          </View>

          {/* FAVORITE CURRENCIES */}
          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.favorite_currencies')}</Text>
            {isLoading ? <ActivityIndicator size="small" color="#387c9f" /> : (
              <MultiSelectPicker selectedValues={favorites} onSave={updateFavorites} items={currencyItems} placeholder={t('common.select_favorites_placeholder')} />
            )}
            <Text style={[styles.hintText, { color: colors.sectionHeader, marginTop: 6, fontSize: 11 }]}>
              {t('common.favorites_desc')}
            </Text>
          </View>

          {/* PORTFOLIO BACKUP */}
          {!isDataSaved ? (
            <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.portfolio_backup')}</Text>
              <Text style={[styles.aboutDescription, { color: colors.text, marginBottom: 10 }]}>
                {t('common.portfolio_backup_desc')}
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.name ? '#FF3B30' : colors.border }]}
                placeholder={t('common.name')}
                placeholderTextColor={colors.sectionHeader}
                value={userName}
                onChangeText={(txt) => {setUserName(txt); if(errors.name) setErrors({...errors, name: null})}}
              />
              <View style={[styles.phoneInputContainer, { backgroundColor: colors.background, borderColor: errors.phone ? '#FF3B30' : colors.border }]}>
                <TouchableOpacity style={[styles.countrySelectButton, { borderRightColor: colors.border }]} onPress={() => setIsCountryModalVisible(true)}>
                  <Text style={[styles.countryButtonText, { color: colors.text }]}>{currentSelectedCountryObj.flag} {currentSelectedCountryObj.value}</Text>
                </TouchableOpacity>
                <TextInput style={[styles.phoneInput, { color: colors.text }]} placeholder={t('common.phone')} placeholderTextColor={colors.sectionHeader} keyboardType="phone-pad" value={userPhone} onChangeText={(txt) => {setUserPhone(txt); if(errors.phone) setErrors({...errors, phone: null})}} />
              </View>
              <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.email ? '#FF3B30' : colors.border }]} placeholder={t('common.email')} placeholderTextColor={colors.sectionHeader} keyboardType="email-address" autoCapitalize="none" value={userEmail} onChangeText={(txt) => {setUserEmail(txt); if(errors.email) setErrors({...errors, email: null})}} />

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#387c9f', flex: 1, marginRight: 5 }]} onPress={handleSaveUserData} activeOpacity={0.8}><Text style={styles.saveButtonText}>{t('common.save_data')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#34C759', flex: 1, marginLeft: 5 }]} onPress={handleRestoreUserData} activeOpacity={0.8}><Text style={styles.saveButtonText}>{t('common.restore_data')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
             <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{language === 'ar' ? 'البيانات المسجلة' : 'REGISTERED DATA'}</Text>
                <View style={styles.savedDataItem}><Ionicons name="call-outline" size={18} color={colors.sectionHeader}/><Text style={[styles.savedDataText, {color:colors.text}]}>{userPhone}</Text></View>
                {userEmail ? <View style={styles.savedDataItem}><Ionicons name="mail-outline" size={18} color={colors.sectionHeader}/><Text style={[styles.savedDataText, {color:colors.text}]}>{userEmail}</Text></View> : null}
                <TouchableOpacity onPress={handleEditUserData} style={[styles.saveButton, { backgroundColor: '#007AFF', marginTop: 10 }]} activeOpacity={0.8}><Text style={styles.saveButtonText}>{t('common.edit')}</Text></TouchableOpacity>
             </View>
          )}

          {/* Privacy Center */}
          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.privacy_policy')}</Text>
            <TouchableOpacity style={styles.preferenceRow} onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.privacy_policy')}</Text>
              <Ionicons name="shield-checkmark" size={20} color="#34C759" />
            </TouchableOpacity>
            <View style={[styles.preferenceRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.data_encryption')}</Text>
                <Text style={{ fontSize: 10, color: colors.sectionHeader }}>{t('common.data_encryption_desc')}</Text>
              </View>
              <Ionicons name="lock-closed" size={18} color="#387c9f" />
            </View>
          </View>

          {/* SUPPORT */}
          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.support_help')}</Text>
            <TouchableOpacity style={styles.preferenceRow} onPress={() => navigation.navigate('HelpCenter')}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.help_center')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.sectionHeader} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.preferenceRow, { borderBottomWidth: 0 }]} onPress={openWhatsAppSupport}>
              <Text style={[styles.preferenceLabel, { color: colors.text }]}>{t('common.whatsapp_support')}</Text>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </TouchableOpacity>
          </View>

          {/* ABOUT */}
          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.cardHeader, { color: colors.sectionHeader }]}>{t('common.about_app')}</Text>
            <Text style={[styles.aboutDescription, { color: colors.text }]}>
              {t('common.app_description')}
            </Text>
            <TouchableOpacity onPress={() => setIsAboutExpanded(!isAboutExpanded)} style={styles.moreButtonContainer}>
              <Text style={styles.moreButtonText}>{isAboutExpanded ? t('common.show_less') : t('common.read_more')}</Text>
            </TouchableOpacity>
            {isAboutExpanded && (
               <View style={styles.detailedContainer}>
                  <Text style={[styles.detailedHeaderTitle, { color: colors.text }]}>{t('common.guide_title')}</Text>

                  {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={styles.guideItem}>
                      <Text style={[styles.detailedItemTitle, {color:colors.text}]}>{t(`common.guide_${i}`)}</Text>
                      <Text style={[styles.detailedItemDesc, {color:colors.sectionHeader}]}>
                        {t(`common.guide_${i}_desc`)}
                      </Text>
                    </View>
                  ))}
               </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Modal */}
      <Modal visible={isCountryModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? 'rgba(30, 35, 45, 0.98)' : 'rgba(255, 255, 255, 0.98)', borderColor: colors.border }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>{t('common.select_country')}</Text><TouchableOpacity onPress={() => setIsCountryModalVisible(false)}><Text style={{ color: colors.text, fontSize: 20 }}>✕</Text></TouchableOpacity></View>
            <TextInput style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder={t('common.search_country')} placeholderTextColor={colors.sectionHeader} value={countrySearchQuery} onChangeText={setCountrySearchQuery} />
            <FlatList data={filteredCountries} keyExtractor={(item) => item.value + item.nameEn} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.countryListItem, { borderBottomColor: colors.border }]} onPress={() => { setSelectedCountry(item.value); setIsCountryModalVisible(false); }}>
                <Text style={styles.countryItemFlag}>{item.flag}</Text>
                <Text style={[styles.countryItemName, { color: colors.text }]}>{language === 'ar' ? item.nameAr : item.nameEn}</Text>
                <Text style={[styles.countryItemCode, { color: colors.sectionHeader }]}>{item.value}</Text>
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { paddingBottom: 140, paddingHorizontal: 12 },
  logoHeaderContainer: { alignItems: 'center', marginVertical: 12 },
  logoImage: { width: 55, height: 55, borderRadius: 14, marginBottom: 5 },
  appNameText: { fontSize: 17, fontWeight: 'bold' },
  appVersionText: { fontSize: 11, marginTop: 1 },
  userProfileHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  userNameDisplay: { fontSize: 15, fontWeight: 'bold', marginRight: 6 },
  editButtonSmall: { borderWidth: 1.5, borderRadius: 8, padding: 4 },
  card: { borderWidth: 1.5, borderRadius: 18, padding: 14, marginTop: 12 },
  cardHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  preferenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  preferenceLabel: { fontSize: 14, fontWeight: '600' },
  hintText: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontSize: 14, marginBottom: 10 },
  phoneInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, marginBottom: 10, overflow: 'hidden', height: 48 },
  countrySelectButton: { paddingHorizontal: 12, borderRightWidth: 1, height: '100%', justifyContent: 'center' },
  countryButtonText: { fontSize: 14, fontWeight: 'bold' },
  phoneInput: { flex: 1, paddingHorizontal: 12, height: '100%', fontSize: 14 },
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  saveButton: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  savedDataItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  savedDataText: { fontSize: 14, marginLeft: 10 },
  aboutDescription: { fontSize: 13, lineHeight: 18 },
  moreButtonContainer: { marginTop: 8, paddingVertical: 4 },
  moreButtonText: { color: '#387c9f', fontWeight: 'bold', fontSize: 13 },
  detailedContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.1)' },
  detailedHeaderTitle: { fontWeight: '800', marginBottom: 12, fontSize: 14 },
  guideItem: { marginBottom: 10 },
  detailedItemTitle: { fontWeight: '700', fontSize: 13 },
  detailedItemDesc: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, borderWidth: 1.5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 14 },
  countryListItem: { flexDirection: 'row', paddingVertical: 14, alignItems: 'center', borderBottomWidth: 0.5 },
  countryItemFlag: { fontSize: 20 },
  countryItemName: { flex: 1, marginLeft: 10, fontSize: 15 },
  countryItemCode: { fontSize: 14, fontWeight: 'bold' },
});

export default SettingsScreen;