import React, { useState, useRef, useContext, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList, SafeAreaView, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { SettingsContext } from '../context/SettingsContext';
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import AuthService from '../services/authService';
import { currencyInfo } from '../constants/currencyData';

const { width, height } = Dimensions.get('window');

import NeoBackground from '../components/layout/NeoBackground';
const OnboardingScreen = ({ onFinish }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { language, changeLanguage } = useContext(SettingsContext);
  const { baseCurrency, changeBaseCurrency } = useContext(BaseCurrencyContext);

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  // Registration states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState({ nameAr: 'مصر', nameEn: 'Egypt', flag: '🇪🇬', value: '+20' });
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const languagesList = useMemo(() => [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ur', name: 'اردو', flag: '🇵🇰' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
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
  ], []);

  const currenciesList = useMemo(() => {
    const priority = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'KWD'];
    const otherKeys = Object.keys(currencyInfo).filter(k => !priority.includes(k));
    return [...priority, ...otherKeys].map(code => ({
      code,
      name: t(`currencies.${code}`, { defaultValue: currencyInfo[code]?.name || code }),
      flag: currencyInfo[code]?.flag || '🌐'
    }));
  }, [t]);

  const slides = useMemo(() => [
    {
      id: '1',
      icon: 'language',
      title: t('onboarding.slide2_title', { defaultValue: 'اختر لغتك المفضلة' }),
      description: t('onboarding.slide2_desc', { defaultValue: 'يدعم التطبيق 11 لغة عالمية لتناسب احتياجاتك في أي مكان' }),
      color: '#4CAF50',
      type: 'language'
    },
    {
      id: '2',
      icon: 'cash',
      title: t('common.base_currency', { defaultValue: 'العملة الأساسية' }),
      description: t('rates.select_base_currency', { defaultValue: 'اختر عملتك المحلية لعرض الأسعار والذهب بها' }),
      color: '#AF52DE',
      type: 'currency'
    },
    {
      id: '3',
      icon: 'person-add',
      title: t('onboarding.slide3_title', { defaultValue: 'سجل بياناتك' }),
      description: t('onboarding.slide3_desc', { defaultValue: 'سجل لتفعيل ميزة المزامنة السحابية وحفظ محفظتك الاستثمارية بأمان' }),
      color: '#FF9500',
      type: 'register'
    }
  ], [t]);

  const handleFinish = async (isSkipping = false) => {
    if (isSkipping && !showSkipWarning) {
      setShowSkipWarning(true);
      return;
    }

    setIsLoading(true);
    try {
      // Logic for skipped slides:
      // If language not set (skipped first slide), default to 'en'
      // If base currency not set (skipped second slide), default to 'EGP'

      const currentLang = await AsyncStorage.getItem('language');
      if (!currentLang) {
        changeLanguage('en');
      }

      const currentBase = await AsyncStorage.getItem('@base_currency');
      if (!currentBase) {
        changeBaseCurrency('EGP');
      }

      if (!isSkipping && name.trim().length > 0) {
        await AuthService.saveUser({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          countryCode: selectedCountry.value,
          portfolio: [],
          target: null
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem('@onboarding_completed', 'true');
      onFinish();
    } catch (e) {
      console.warn('Finish onboarding error:', e.message);
      await AsyncStorage.setItem('@onboarding_completed', 'true');
      onFinish();
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < slides.length) {
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      handleFinish(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex === 0) {
      // Default to English if skipped language
      changeLanguage('en');
    }
    if (currentIndex === 1) {
      // Default to EGP if skipped currency
      changeBaseCurrency('EGP');
    }

    if (currentIndex === slides.length - 1) {
      handleFinish(true);
    } else {
      const lastIndex = slides.length - 1;
      setCurrentIndex(lastIndex);
      flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true });
    }
  };

  const renderLanguageItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.listItem,
        {
          backgroundColor: language === item.code ? '#387c9f' : colors.cardBg,
          borderColor: colors.border
        }
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        changeLanguage(item.code);
      }}
    >
      <Text style={styles.listFlag}>{item.flag}</Text>
      <Text style={[styles.listText, { color: language === item.code ? '#FFF' : colors.text }]}>{item.name}</Text>
      {language === item.code && <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
    </TouchableOpacity>
  ), [language, colors, changeLanguage]);

  const renderCurrencyItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.listItem,
        {
          backgroundColor: baseCurrency === item.code ? '#AF52DE' : colors.cardBg,
          borderColor: colors.border
        }
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        changeBaseCurrency(item.code);
      }}
    >
      <Text style={styles.listFlag}>{item.flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listCode, { color: baseCurrency === item.code ? '#FFF' : colors.text }]}>{item.code}</Text>
        <Text style={[styles.listSubText, { color: baseCurrency === item.code ? '#EEE' : colors.sectionHeader }]} numberOfLines={1}>{item.name}</Text>
      </View>
      {baseCurrency === item.code && <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
    </TouchableOpacity>
  ), [baseCurrency, colors, changeBaseCurrency]);

  const renderSlideItem = useCallback(({ item }) => {
    if (item.type === 'language') {
      return (
        <View style={styles.slide}>
          <View style={[styles.iconContainerSmall, { backgroundColor: '#E8F5E9', marginBottom: 20 }]}>
            <Ionicons name={item.icon} size={40} color={item.color} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <FlatList
            data={languagesList}
            renderItem={renderLanguageItem}
            keyExtractor={(l) => l.code}
            style={styles.scrollList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      );
    }

    if (item.type === 'currency') {
      return (
        <View style={styles.slide}>
          <View style={[styles.iconContainerSmall, { backgroundColor: '#F3E5F5', marginBottom: 20 }]}>
            <Ionicons name={item.icon} size={40} color={item.color} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <FlatList
            data={currenciesList}
            renderItem={renderCurrencyItem}
            keyExtractor={(c) => c.code}
            style={styles.scrollList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      );
    }

    if (item.type === 'register') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.slide}
        >
          <View style={[styles.iconContainerSmall, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name={item.icon} size={40} color={item.color} />
          </View>

          <View style={styles.registrationFormTop}>
            <Text style={[styles.titleSmall, { color: colors.text }]}>{item.title}</Text>

            <View style={styles.inputsContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={20} color={colors.sectionHeader} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder={t('common.name')}
                  placeholderTextColor={colors.sectionHeader}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.phoneGroup}>
                <TouchableOpacity
                  style={[styles.countryPicker, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  onPress={() => setIsCountryModalVisible(true)}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={[styles.countryValue, { color: colors.text }]}>{selectedCountry.value}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.sectionHeader} />
                </TouchableOpacity>

                <View style={[styles.phoneInputWrapper, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.inputField, { color: colors.text }]}
                    placeholder={t('common.phone')}
                    placeholderTextColor={colors.sectionHeader}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={colors.sectionHeader} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder={t('common.email')}
                  placeholderTextColor={colors.sectionHeader}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <Text style={[styles.descriptionSmall, { color: colors.sectionHeader }]}>
              {item.description}
            </Text>
          </View>
        </KeyboardAvoidingView>
      );
    }
  }, [colors, t, name, phone, email, selectedCountry, language, languagesList, currenciesList, renderLanguageItem, renderCurrencyItem]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* SOLID HEADER WITHOUT TRANSPARENCY */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.indicator, { backgroundColor: currentIndex === i ? '#387c9f' : colors.border, width: currentIndex === i ? 24 : 8 }]} />
          ))}
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButtonActive}>
          <Text style={styles.skipTextWhite}>{t('onboarding.skip', { defaultValue: 'تخطي' })}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlideItem}
        horizontal
        pagingEnabled
        scrollEnabled={currentIndex === 2}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        keyExtractor={(item) => item.id}
      />

      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.nextBtn, { width: '100%' }]}
          onPress={handleNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.nextBtnText}>
              {currentIndex === slides.length - 1
                ? (name.trim() ? t('common.done') : t('onboarding.skip_register', { defaultValue: 'الدخول بدون تسجيل' }))
                : t('common.next')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* WARNING MODAL FOR SKIPPING REGISTRATION */}
      <Modal visible={showSkipWarning} animationType="slide" transparent={false}>
        <View style={[styles.warningScreen, { backgroundColor: colors.background }]}>
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={80} color="#FF9500" style={{ marginBottom: 20 }} />
            <Text style={[styles.warningTitle, { color: colors.text }]}>تنبيه هام</Text>
            <Text style={[styles.warningText, { color: colors.sectionHeader }]}>
              عند الدخول بدون تسجيل، لن تتمكن من مزامنة محفظتك الاستثمارية سحابياً. ستقوم بحفظ بياناتك محلياً فقط على هذا الجهاز، مما يعني فقدانها عند مسح التطبيق. يفضل التسجيل لضمان أمان بياناتك.
            </Text>

            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => handleFinish(true)}
            >
              <Text style={styles.startBtnText}>ابدأ الآن</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setShowSkipWarning(false)}
            >
              <Text style={{ color: '#387c9f', fontWeight: 'bold' }}>العودة للتسجيل</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SOLID COUNTRY MODAL */}
      <Modal visible={isCountryModalVisible} animationType="fade" transparent={false}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('common.select_country')}</Text>
            <TouchableOpacity onPress={() => setIsCountryModalVisible(false)} style={styles.closeModalBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={countriesList}
            keyExtractor={(c) => c.value}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedCountry(item);
                  setIsCountryModalVisible(false);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.countryItemFlag}>{item.flag}</Text>
                <Text style={[styles.countryItemName, { color: colors.text }]}>
                  {language === 'ar' ? item.nameAr : item.nameEn}
                </Text>
                <Text style={[styles.countryItemValue, { color: colors.sectionHeader }]}>{item.value}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  skipButtonActive: { backgroundColor: '#387c9f', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12 },
  skipTextWhite: { fontSize: 14, color: '#FFF', fontWeight: 'bold' },
  slide: { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  iconContainerSmall: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  titleSmall: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  descriptionSmall: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 15 },
  registrationFormTop: { width: '100%', paddingTop: 10 },
  inputsContainer: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 55, borderRadius: 15, borderWidth: 1.5, paddingHorizontal: 15, marginBottom: 12 },
  inputIcon: { marginRight: 10 },
  inputField: { flex: 1, fontSize: 16, height: '100%' },
  phoneGroup: { flexDirection: 'row', marginBottom: 12 },
  countryPicker: { flexDirection: 'row', alignItems: 'center', height: 55, borderRadius: 15, borderWidth: 1.5, paddingHorizontal: 12, marginRight: 10 },
  countryFlag: { fontSize: 20, marginRight: 6 },
  countryValue: { fontSize: 15, fontWeight: '600', marginRight: 6 },
  phoneInputWrapper: { flex: 1, height: 55, borderRadius: 15, borderWidth: 1.5, paddingHorizontal: 15 },
  footer: { paddingHorizontal: 30, paddingBottom: 40, paddingTop: 10 },
  indicatorContainer: { flexDirection: 'row', alignItems: 'center' },
  indicator: { height: 8, borderRadius: 4, marginHorizontal: 3 },
  nextBtn: { backgroundColor: '#387c9f', height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  nextBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 17 },
  scrollList: { width: '100%', maxHeight: height * 0.5 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, borderWidth: 1.5, marginBottom: 10 },
  listFlag: { fontSize: 22, marginRight: 15 },
  listText: { flex: 1, fontSize: 16, fontWeight: '600' },
  listCode: { fontSize: 17, fontWeight: 'bold' },
  listSubText: { fontSize: 13 },

  // WARNING SCREEN STYLES
  warningScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  warningContent: { alignItems: 'center', width: '100%' },
  warningTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 15 },
  warningText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  startBtn: { backgroundColor: '#4CAF50', width: '100%', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  startBtnText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  // SOLID MODAL STYLES
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  closeModalBtn: { padding: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 0.5 },
  countryItemFlag: { fontSize: 24, marginRight: 15 },
  countryItemName: { flex: 1, fontSize: 17 },
  countryItemValue: { fontSize: 15, fontWeight: '600' }
});

export default OnboardingScreen;
