import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { 
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import errorHandler from '../services/errorHandler';
import { Ionicons } from '@expo/vector-icons';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { currencyInfo } from '../constants/currencyData';
import ConnectionIndicator from '../components/layout/ConnectionIndicator';
import NeoBackground from '../components/layout/NeoBackground';
import { getNeoStyles } from '../styles/NeoStyle';
import { getCurrenciesData } from '../services/currenciesCoreData';
import { CACHE_KEYS } from '../constants/cacheKeys';

const HISTORY_KEY = CACHE_KEYS.CONVERTER_HISTORY;

const ConverterScreen = () => {
  const { t } = useTranslation();
  const { isDarkMode, favorites, toggleFavorite, language } = useContext(SettingsContext);
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const neoStyles = getNeoStyles(colors, isDarkMode);

  const [rates, setRates] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [fetchError, setFetchError] = useState(false);

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EGP');

  const [fromAmount, setFromAmount] = useState('1');
  const [toAmount, setToAmount] = useState('');
  const [activeField, setActiveField] = useState('from');

  const [history, setHistory] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const spinValue = useRef(new Animated.Value(0)).current;
  const logoSpinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;
    if (isRefreshing) {
      logoSpinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(logoSpinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      logoSpinAnim.stopAnimation();
      logoSpinAnim.setValue(0);
    }

    return () => {
      if (animation) animation.stop();
      logoSpinAnim.stopAnimation();
    };
  }, [isRefreshing, logoSpinAnim]);

  const headerLogoSpin = logoSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const savedHistory = await AsyncStorage.getItem(HISTORY_KEY);
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (!fromAmount || !toAmount || parseFloat(fromAmount) <= 0 || isNaN(parseFloat(fromAmount))) return;
    if (parseFloat(fromAmount) === 1) return;

    const timer = setTimeout(() => {
      const newItem = {
        id: Date.now().toString(),
        fromCurr: fromCurrency,
        toCurr: toCurrency,
        fromVal: fromAmount,
        toVal: toAmount,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setHistory(prev => {
        if (prev.length > 0 &&
            prev[0].fromCurr === newItem.fromCurr &&
            prev[0].toCurr === newItem.toCurr &&
            prev[0].fromVal === newItem.fromVal) {
          return prev;
        }
        const updated = [newItem, ...prev].slice(0, 15);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [fromCurrency, toCurrency, fromAmount, toAmount]);

  const clearHistory = async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  };

  // isMountedRef يتتبع إن كانت الشاشة لسه مُركّبة (mounted) عشان نتجاهل أي
  // نتيجة ترجع بعد ما المستخدم يكون غادر الشاشة (تجنّب تحديث state على مكوّن اتشال)
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadLocalRates = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setFetchError(false);

    try {
      // دائماً false، لا forceRefresh لمنع الطلبات المباشرة
      const data = await getCurrenciesData(false);

      if (!isMountedRef.current) return;

      if (data && data.rates && Object.keys(data.rates).length > 0) {
        setRates(data.rates);

        // جلب وقت التحديث من التخزين المحلي
        const cachedTimeStr = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES_TIME);
        if (!isMountedRef.current) return;

        if (cachedTimeStr) {
          const dateObj = new Date(parseInt(cachedTimeStr, 10));
          setLastUpdated(dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } else {
          setLastUpdated('');
        }
      } else {
        // فشل صامت من الخدمة (رجعت بيانات فاضية) - نعتبره خطأ عشان نبلّغ المستخدم
        setFetchError(true);
        // لو معندناش أسعار قديمة محفوظة أصلاً، نفضي الحالة
        setRates(prev => (Object.keys(prev).length > 0 ? prev : {}));
      }
    } catch (error) {
      console.error('Error loading local rates:', error);
      if (errorHandler && typeof errorHandler.logError === 'function') {
        errorHandler.logError(error, 'ConverterScreen:loadLocalRates');
      }
      if (isMountedRef.current) {
        setFetchError(true);
        // نسيب أي أسعار سابقة زي ما هي بدل ما نفضيها، أفضل من واجهة فاضية تمامًا
        setRates(prev => prev);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLocalRates(false);
  }, [loadLocalRates]);

  const onRefresh = useCallback(() => {
    loadLocalRates(true);
  }, [loadLocalRates]);

  const currencyItems = useMemo(() => {
    const keys = Object.keys(rates).length > 0 ? Object.keys(rates) : Object.keys(currencyInfo);
    const sortedKeys = keys.sort((a, b) => {
      const indexA = favorites.indexOf(a);
      const indexB = favorites.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    const mapped = sortedKeys.map(code => ({
      code,
      name: t(`currencies.${code}`, { defaultValue: currencyInfo[code]?.name || '' }),
      flag: currencyInfo[code]?.flag || '💵',
      isFavorite: favorites.includes(code),
    }));

    if (!searchQuery.trim()) return mapped;
    return mapped.filter(item =>
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rates, t, searchQuery, favorites]);

  const formatNumberWithCommas = (text) => {
    if (!text) return '';
    const clean = text.toString().replace(/,/g, '');
    const parts = clean.split('.');
    let intPart = parts[0].replace(/\D/g, '');
    if (intPart !== '') intPart = parseInt(intPart, 10).toLocaleString('en-US');
    else if (parts[0].includes('0')) intPart = '0';
    return parts.length > 1 ? `${intPart}.${parts[1]}` : (text.toString().endsWith('.') ? `${intPart}.` : intPart);
  };

  const getDynamicFontSize = (text) => {
    const len = (text || '').toString().length;
    if (len <= 6) return 26;
    if (len <= 9) return 21;
    if (len <= 12) return 17;
    return 14;
  };

  useEffect(() => {
    if (!rates[fromCurrency] || !rates[toCurrency]) return;
    const rate = rates[toCurrency] / rates[fromCurrency];
    if (activeField === 'from') {
      const numeric = parseFloat(fromAmount.replace(/,/g, ''));
      if (isNaN(numeric)) setToAmount('');
      else setToAmount(formatNumberWithCommas((numeric * rate).toFixed(2)));
    } else {
      const numeric = parseFloat(toAmount.replace(/,/g, ''));
      if (isNaN(numeric)) setFromAmount('');
      else setFromAmount(formatNumberWithCommas((numeric * (rates[fromCurrency] / rates[toCurrency])).toFixed(2)));
    }
  }, [fromCurrency, toCurrency, fromAmount, toAmount, activeField, rates]);

  const handleSwap = () => {
    Animated.sequence([
      Animated.timing(spinValue, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(spinValue, { toValue: 0, duration: 0, useNativeDriver: true })
    ]).start();
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setActiveField('from');
  };

  if (isLoading && Object.keys(rates).length === 0) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color="#387c9f" /></View>;
  }

  return (
    <NeoBackground blurIntensity={isDarkMode ? 160 : 140}>
      <SafeAreaView style={styles.container}>
        <View style={styles.screenTopIndicatorContainer}><ConnectionIndicator /></View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, zIndex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={isDarkMode ? '#ffffff' : '#387c9f'} />}>

            <View style={[neoStyles.floatingBar, { height: 60, paddingVertical: 0, paddingHorizontal: 12, justifyContent: 'flex-start', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: colors.glassBorder }]}>
              <View style={[styles.headerTitleGroup, { flex: 1, justifyContent: 'flex-start', flexDirection: 'row', alignItems: 'center' }]}>
                <Animated.View style={[{ width: 44, height: 44, marginRight: 8 }, { transform: [{ rotate: headerLogoSpin }] }]}><Image source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" /></Animated.View>
                <View style={{ flex: 1 }}>
                  <Text style={[neoStyles.mainTitle, { fontSize: 18, fontWeight: '900', textAlign: 'left' }]} numberOfLines={1}>{t('converter.title')}</Text>
                  {lastUpdated ? <Text style={[styles.lastUpdatedText, { color: colors.sectionHeader, fontSize: 9, fontWeight: '700', marginTop: -1, textAlign: 'left' }]} numberOfLines={1}>{t('converter.lastUpdated')}: {lastUpdated}</Text> : null}
                </View>
              </View>
              <TouchableOpacity style={[styles.refreshButton, { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(56, 124, 159, 0.1)', borderColor: 'rgba(56, 124, 159, 0.2)', marginLeft: 'auto' }]} onPress={() => loadLocalRates(true)} disabled={isRefreshing} activeOpacity={0.6}>
                {isRefreshing ? <ActivityIndicator size="small" color="#387c9f" /> : <Ionicons name="refresh" size={17} color="#387c9f" />}
              </TouchableOpacity>
            </View>

            {/* بانر تنبيه فشل تحديث الأسعار - يظهر فقط لما يكون فيه خطأ فعلي */}
            {fetchError && (
              <View style={[styles.errorBanner, {
                backgroundColor: isDarkMode ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255, 59, 48, 0.08)',
                borderColor: 'rgba(255, 59, 48, 0.3)'
              }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                <Text style={[styles.errorBannerText, { color: colors.text }]} numberOfLines={2}>
                  {t('converter.fetchError', { defaultValue: 'تعذر تحديث الأسعار، تحقق من الاتصال بالإنترنت' })}
                </Text>
                <TouchableOpacity
                  style={[styles.errorBannerRetryBtn, { borderColor: 'rgba(255, 59, 48, 0.4)' }]}
                  onPress={() => loadLocalRates(true)}
                  disabled={isRefreshing}
                  activeOpacity={0.7}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color="#FF3B30" />
                  ) : (
                    <Text style={styles.errorBannerRetryText}>
                      {t('converter.retry', { defaultValue: 'إعادة المحاولة' })}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* المستطيل الزجاجي الشفاف المسنفر الشامل - تباين عالي للوضوح بدون ظلال */}
            <View style={[styles.frostedGlassCard, {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
            }]}>

              {/* قسم اختيار العملات (من وإلى + زر التبديل) */}
              <View style={[styles.selectorsSection, { backgroundColor: 'transparent' }]}>
                <View style={styles.selectorColumn}>
                  <Text style={[styles.label, { color: colors.sectionHeader }]}>{t('converter.from')}</Text>
                  <TouchableOpacity style={[styles.pickerButton, { backgroundColor: 'transparent', borderColor: colors.glassBorder }]} onPress={() => { setSearchQuery(''); setSelectingType('from'); setModalVisible(true); }}>
                    <View style={styles.pickerButtonContent}><Text style={styles.flagEmoji}>{currencyInfo[fromCurrency]?.flag || '💵'}</Text><Text style={[styles.pickerButtonText, { color: colors.text }]}>{fromCurrency}</Text></View>
                    <Ionicons name="chevron-down" size={14} color={colors.sectionHeader} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.swapIconButton, { backgroundColor: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.08)', borderColor: 'rgba(0, 122, 255, 0.2)' }]} onPress={handleSwap}>
                  <Animated.View style={{ transform: [{ rotate: spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><Ionicons name="swap-horizontal" size={18} color="#387c9f" /></Animated.View>
                </TouchableOpacity>
                <View style={styles.selectorColumn}>
                  <Text style={[styles.label, { color: colors.sectionHeader }]}>{t('converter.to')}</Text>
                  <TouchableOpacity style={[styles.pickerButton, { backgroundColor: 'transparent', borderColor: colors.glassBorder }]} onPress={() => { setSearchQuery(''); setSelectingType('to'); setModalVisible(true); }}>
                    <View style={styles.pickerButtonContent}><Text style={styles.flagEmoji}>{currencyInfo[toCurrency]?.flag || '💵'}</Text><Text style={[styles.pickerButtonText, { color: colors.text }]}>{toCurrency}</Text></View>
                    <Ionicons name="chevron-down" size={14} color={colors.sectionHeader} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* حقول إدخال القيم */}
              <View style={[styles.inputsRow, { backgroundColor: 'transparent' }]}>
                <View style={[styles.inputContainer, { backgroundColor: 'transparent', borderColor: activeField === 'from' ? '#007AFF' : colors.glassBorder, borderStyle: activeField === 'from' ? 'solid' : 'dashed' }, activeField === 'from' && styles.activeInputContainer]}>
                  <TextInput style={[styles.input, { color: colors.text, fontSize: getDynamicFontSize(fromAmount) }]} keyboardType="numeric" value={fromAmount} onFocus={() => setActiveField('from')} onChangeText={(text) => { setActiveField('from'); setFromAmount(formatNumberWithCommas(text)); }} placeholder="0.00" placeholderTextColor={colors.sectionHeader} />
                </View>
                <View style={{ width: 12 }} />
                <View style={[styles.inputContainer, { backgroundColor: 'transparent', borderColor: activeField === 'to' ? '#007AFF' : colors.glassBorder, borderStyle: activeField === 'to' ? 'solid' : 'dashed' }, activeField === 'to' && styles.activeInputContainer]}>
                  <TextInput style={[styles.input, { color: colors.text, fontSize: getDynamicFontSize(toAmount) }]} keyboardType="numeric" value={toAmount} onFocus={() => setActiveField('to')} onChangeText={(text) => { setActiveField('to'); setToAmount(formatNumberWithCommas(text)); }} placeholder="0.00" placeholderTextColor={colors.sectionHeader} />
                </View>
              </View>

              {/* شريط الأرقام السريعة للتحويل */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll} contentContainerStyle={{ alignItems: 'center' }}>
                {[5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,150,200,250,300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000].map((val) => (
                  <TouchableOpacity key={val} style={[styles.presetButton, { backgroundColor: fromAmount === val.toString() ? '#007bff81' : (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'), borderColor: fromAmount === val.toString() ? '#007AFF' : colors.glassBorder }]} onPress={() => { setActiveField('from'); setFromAmount(val.toString()); }}>
                    <Text style={[styles.presetButtonText, { color: fromAmount === val.toString() ? '#FFFFFF' : colors.text }]}>{val}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* سجل التحويلات السابقة - تباين عالي للوضوح بدون ظلال */}
            <View style={[styles.frostedGlassCard, {
              width: '100%',
              marginTop: 24,
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.26)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <View style={styles.headerRowContainer}>
                <View style={styles.headerTitleRow}>
                  <View style={[styles.refreshButton, { backgroundColor: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.08)', borderColor: 'rgba(0, 122, 255, 0.2)', marginLeft: 0, marginRight: 10 }]}>
                    <Ionicons name="time-outline" size={18} color="#387c9f" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('converter.historyTitle')}</Text>
                </View>
                {history.length > 0 && (
                  <TouchableOpacity style={[styles.refreshButton, { backgroundColor: 'transparent', borderColor: 'rgba(255, 59, 48, 0.2)' }]} onPress={clearHistory}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>

              {history.length === 0 ? (
                <View style={[styles.emptyHistoryContainer, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.emptyHistoryText, { color: colors.sectionHeader }]}>{t('converter.emptyHistory')}</Text>
                </View>
              ) : (
                <View style={[styles.historyListContainer, { backgroundColor: 'transparent' }]}>
                  {history.map((item, index) => (
                    <View key={item.id} style={[styles.historyItemRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }, index === history.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.historyItemContent}>
                        <View style={styles.historyItemTop}>
                          <Text style={[styles.historyItemText, { color: colors.text }]}>{item.fromVal} {item.fromCurr}</Text>
                          <Ionicons name="arrow-forward" size={14} color={colors.sectionHeader} style={{ marginHorizontal: 8 }} />
                          <Text style={[styles.historyItemTextBold, { color: '#387c9f' }]}>{item.toVal} {item.toCurr}</Text>
                        </View>
                        <Text style={[styles.historyItemTime, { color: colors.sectionHeader }]}>{item.time}</Text>
                      </View>
                      <TouchableOpacity onPress={() => { setFromCurrency(item.fromCurr); setToCurrency(item.toCurr); setFromAmount(item.fromVal); setActiveField('from'); }} style={styles.historyRestoreBtn}>
                        <Ionicons name="reload" size={16} color="#387c9f" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* نافذة اختيار العملات */}
        <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
              <View style={styles.modalIndicator} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('converter.select_currency')}</Text>
              <TextInput style={[styles.searchInput, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.text }]} placeholder={t('converter.searchPlaceholder')} placeholderTextColor={colors.sectionHeader} value={searchQuery} onChangeText={setSearchQuery} />

              <FlatList
                style={{ flex: 1 }}
                data={currencyItems}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <View style={[styles.modalItemContainer, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.modalItemMain} onPress={() => { if (selectingType === 'from') { setFromCurrency(item.code); setActiveField('from'); } else { setToCurrency(item.code); setActiveField('to'); } setModalVisible(false); setSearchQuery(''); }}>
                      <Text style={styles.modalItemFlag}>{item.flag}</Text>
                      <View style={styles.modalItemTexts}><Text style={[styles.modalItemCode, { color: colors.text }]}>{item.code}</Text>{item.name ? <Text style={[styles.modalItemName, { color: colors.sectionHeader }]} numberOfLines={1}>{item.name}</Text> : null}</View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleFavorite(item.code)} style={styles.favoriteButton}><Ionicons name={item.isFavorite ? "star" : "star-outline"} size={22} color={item.isFavorite ? "#FFD700" : colors.sectionHeader} /></TouchableOpacity>
                  </View>
                )}
              />

              <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => { setModalVisible(false); setSearchQuery(''); }}><Text style={styles.closeModalText}>{t('common.close')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </NeoBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', overflow: 'hidden' },
  screenTopIndicatorContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 45 : 30, right: 16, zIndex: 50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, alignItems: 'center', paddingTop: 45, paddingBottom: 60 },

  // المستطيل الزجاجي الشفاف المسنفر الموحد (نسخة عالية التباين بدون ظلال)
  frostedGlassCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 20,
    marginTop: 0,
  },

  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  errorBannerRetryBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 10, minWidth: 78, alignItems: 'center', justifyContent: 'center' },
  errorBannerRetryText: { color: '#FF3B30', fontSize: 12, fontWeight: '700' },
  headerRowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  lastUpdatedText: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  refreshButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  selectorsSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  selectorColumn: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  pickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.2, borderRadius: 16, paddingHorizontal: 12, height: 48 },
  pickerButtonContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  flagEmoji: { fontSize: 20, marginRight: 8 },
  pickerButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  swapIconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8, marginTop: 20 },
  inputsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  inputContainer: { flex: 1, borderWidth: 1.2, borderRadius: 18, paddingHorizontal: 10, height: 70, justifyContent: 'center' },
  activeInputContainer: { borderColor: '#387c9f' },
  input: { fontWeight: 'bold', textAlign: 'center', padding: 0, letterSpacing: -0.5 },
  presetScroll: { marginTop: 16 },
  presetButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  presetButtonText: { fontSize: 13, fontWeight: '700' },
  emptyHistoryContainer: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  emptyHistoryText: { fontSize: 14, fontWeight: '500' },
  historyListContainer: { width: '100%' },
  historyItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, backgroundColor: 'transparent' },
  historyItemContent: { flex: 1 },
  historyItemTop: { flexDirection: 'row', alignItems: 'center' },
  historyItemText: { fontSize: 15, fontWeight: '600' },
  historyItemTextBold: { fontSize: 15, fontWeight: '700' },
  historyItemTime: { fontSize: 11, marginTop: 3 },
  historyRestoreBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(0, 122, 255, 0.3)', backgroundColor: 'rgba(0, 122, 255, 0.08)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContent: { height: '80%', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24 },
  modalIndicator: { width: 38, height: 5, borderRadius: 3, backgroundColor: '#C7C7CC', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center', letterSpacing: -0.4 },
  searchInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  modalItemContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5 },
  modalItemMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  modalItemFlag: { fontSize: 28, marginRight: 14 },
  modalItemTexts: { flex: 1 },
  modalItemCode: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  modalItemName: { fontSize: 13, marginTop: 2 },
  favoriteButton: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { marginTop: 16, padding: 16, borderRadius: 22, borderWidth: 1, alignItems: 'center' },
  closeModalText: { color: '#387c9f', fontSize: 16, fontWeight: '700' },
});

export default ConverterScreen;
