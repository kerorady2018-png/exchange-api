import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Animated, TouchableOpacity, Modal, ActivityIndicator, Image, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { currencyInfo } from '../constants/currencyData';
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import ConnectionIndicator from '../components/layout/ConnectionIndicator';
import errorHandler from '../services/errorHandler';
import NeoBackground from '../components/layout/NeoBackground';
import { getNeoStyles } from '../styles/NeoStyle';
import { RatesContext } from '../context/RatesContext';
import { getCurrenciesData } from '../services/currenciesCoreData'; // ✅ إضافة الـ import الناقص

const STORAGE_KEY = '@rates_data';
const PREV_RATES_KEY = '@previous_rates_data';
const FAVORITES_KEY = '@favorite_currencies';
const RATES_LAST_DATE_KEY = '@rates_last_date';
const BM_RATES_KEY = '@core_bm_rates_data';

const RatesSkeleton = () => {
  const { colors, isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 60 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Animated.View
          key={i}
          style={{
            height: 72,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)',
            borderRadius: 20,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            opacity
          }}
        />
      ))}
    </View>
  );
};

export default function RatesScreen() {
  const { rates: contextRates, loadingRates: contextLoading, lastUpdated: contextLastUpdated, refreshRates } = useContext(RatesContext);
  const { t } = useTranslation();
  const { baseCurrency } = useContext(BaseCurrencyContext);
  const { favorites: contextFavorites, toggleFavorite, currencyAlerts, updateCurrencyAlert, removeCurrencyAlert } = useContext(SettingsContext);
  const { colors, isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const neoStyles = getNeoStyles(colors, isDarkMode);

  // ✅ تعريف المتغيرات التي كانت ناقصة - مزامنة مع RatesContext
  const [rates, setRates] = useState(contextRates || {});
  const [loading, setLoading] = useState(contextLoading ?? true);
  const [lastUpdated, setLastUpdated] = useState(contextLastUpdated || '');

  // ✅ مزامنة تلقائية مع RatesContext عند تغير البيانات
  useEffect(() => {
    if (contextRates && Object.keys(contextRates).length > 0) {
      setRates(contextRates);
    }
  }, [contextRates]);

  useEffect(() => {
    setLoading(contextLoading);
  }, [contextLoading]);

  useEffect(() => {
    if (contextLastUpdated) setLastUpdated(contextLastUpdated);
  }, [contextLastUpdated]);

  const [previousRates, setPreviousRates] = useState({});
  const [banqueMisrRates, setBanqueMisrRates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [tempFavorites, setTempFavorites] = useState([]);

  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [tempAlerts, setTempAlerts] = useState({});

  const logoSpinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;
    if (refreshing || isRefreshingManual) {
      logoSpinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(logoSpinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      animation.start();
    } else {
      logoSpinAnim.stopAnimation();
      logoSpinAnim.setValue(0);
    }
    return () => { if (animation) animation.stop(); };
  }, [refreshing, isRefreshingManual, logoSpinAnim]);

  const headerLogoSpin = logoSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    const syncFavorites = async () => {
      try {
        const storedFavs = await AsyncStorage.getItem(FAVORITES_KEY);
        if (contextFavorites && contextFavorites.length > 0) {
          setFavorites(contextFavorites);
        } else if (storedFavs !== null) {
          setFavorites(JSON.parse(storedFavs));
        }
      } catch (e) { console.error(e); }
    };
    syncFavorites();
  }, [contextFavorites]);

  const ratesRef = useRef(rates);
  
  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);

  const fetchRates = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshingManual(true);
    else setLoading(true);
    try {
      // دائماً false، لا forceRefresh لمنع الطلبات المباشرة
      const data = await getCurrenciesData(false);
      if (data) {
        if (Object.keys(ratesRef.current).length > 0) {
          setPreviousRates({ ...ratesRef.current });
        }
        
        setRates(data.rates || {});
        setBanqueMisrRates(data.banqueMisrRates || {});
        
        if (data._lastUpdated) {
          const date = new Date(data._lastUpdated);
          setLastUpdated(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } else {
          setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (error) { errorHandler.handleError(error); }
    finally { setLoading(false); setRefreshing(false); setIsRefreshingManual(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const sortedRates = useMemo(() => {
    const allKeys = Object.keys(rates);
    const baseRateValue = rates[baseCurrency] || 1;

    return allKeys.sort((a, b) => {
      const aIsFav = contextFavorites.includes(a);
      const bIsFav = contextFavorites.includes(b);
      if (aIsFav && bIsFav) return contextFavorites.indexOf(a) - contextFavorites.indexOf(b);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      const aHasBM = !!banqueMisrRates[a];
      const bHasBM = !!banqueMisrRates[b];
      if (aHasBM && !bHasBM) return -1;
      if (!aHasBM && bHasBM) return 1;

      const rateA = rates[a] > 0 ? baseRateValue / rates[a] : 0;
      const rateB = rates[b] > 0 ? baseRateValue / rates[b] : 0;

      return rateB - rateA;
    });
  }, [rates, contextFavorites, baseCurrency, banqueMisrRates]);

  const getRateChange = useCallback((item, currentRate) => {
    const prevRate = previousRates[item] || currentRate;
    const diff = currentRate - prevRate;
    const percent = prevRate > 0 ? (diff / prevRate) * 100 : 0;
    return {
      percentFormatted: Math.abs(percent).toFixed(2),
      isUp: diff > 0,
      isEqual: Math.abs(percent) < 0.01
    };
  }, [previousRates]);

  const handleSaveAlerts = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const [currency, value] of Object.entries(tempAlerts)) {
      if (value && String(value).trim() !== '') await updateCurrencyAlert(currency, String(value).trim());
      else await removeCurrencyAlert(currency);
    }
    setAlertModalVisible(false);
  };

  const moveFavorite = (index, direction) => {
    const newFavs = [...tempFavorites];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFavs.length) return;
    [newFavs[index], newFavs[targetIndex]] = [newFavs[targetIndex], newFavs[index]];
    setTempFavorites(newFavs);
    Haptics.selectionAsync();
  };

  const saveFavoritesOrder = async () => {
    setFavorites(tempFavorites);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(tempFavorites));
    setReorderModalVisible(false);
  };

  const handleToggleFavorite = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(item);
  };

  const renderCurrencyItem = useCallback(({ item }) => {
    const isFav = contextFavorites.includes(item);
    const baseRate = rates[baseCurrency] || 1;
    const itemRate = rates[item] || 1;
    const calculatedRate = itemRate > 0 ? baseRate / itemRate : 0;
    const formattedRate = Number(calculatedRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const change = getRateChange(item, calculatedRate);
    const bmDetails = banqueMisrRates[item];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => {
          if (isFav) {
            setTempFavorites([...contextFavorites]);
            setReorderModalVisible(true);
          }
        }}
        style={{
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)',
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: isFav ? colors.accent : (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'),
          marginBottom: 10,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '35%', backgroundColor: 'transparent' }}>
          <TouchableOpacity 
            onPress={() => handleToggleFavorite(item)}
          >
            <Ionicons 
              name={isFav ? "star" : "star-outline"} 
              size={20} 
              color={isFav ? colors.accent : colors.sectionHeader}
            />
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', marginBottom: 2 }}>
              <Text style={{ fontSize: 24, marginRight: 8 }}>{currencyInfo[item]?.flag || '🌐'}</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>{item}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginLeft: 2, opacity: 0.9 }} numberOfLines={1}>
              {t(`currencies.${item}`, { defaultValue: currencyInfo[item]?.name || '' })}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          {bmDetails ? (
            <>
              <View style={{ alignItems: 'center', marginHorizontal: 8, backgroundColor: 'transparent' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.text, textTransform: 'uppercase', opacity: 0.8 }}>{t('common.buy')}</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: colors.text }}>{bmDetails.buy}</Text>
              </View>
              <View style={{ width: 1.5, height: 18, backgroundColor: colors.text, opacity: 0.2, marginHorizontal: 4 }} />
              <View style={{ alignItems: 'center', marginHorizontal: 8, backgroundColor: 'transparent' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.text, textTransform: 'uppercase', opacity: 0.8 }}>{t('common.sell')}</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: colors.text }}>{bmDetails.sell}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', width: '25%', backgroundColor: 'transparent' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{formattedRate}</Text>
          {Object.keys(previousRates).length > 0 && previousRates[item] ? (
            <View style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginTop: 4,
              backgroundColor: change.isEqual ? 'rgba(128,128,128,0.1)' : (change.isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)')
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: change.isEqual ? colors.sectionHeader : (change.isUp ? '#10B981' : '#EF4444') }}>
                {change.isEqual ? '0.00%' : `${change.isUp ? '▲' : '▼'} ${change.percentFormatted}%`}
              </Text>
            </View>
          ) : (
            <View style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginTop: 4,
              backgroundColor: 'rgba(128,128,128,0.1)'
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.sectionHeader }}>
                --%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [contextFavorites, baseCurrency, rates, banqueMisrRates, t, colors, isDarkMode, getRateChange, handleToggleFavorite]);

  // تم نقل الشرط المباشر إلى هنا بعد جميع الـ Hooks
  if (loading && Object.keys(rates).length === 0) {
    return (
      <NeoBackground>
        <RatesSkeleton />
      </NeoBackground>
    );
  }

  const renderHeader = () => (
    <View style={[neoStyles.floatingBar, { marginTop: Platform.OS === 'ios' ? 40 : 30 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Animated.View style={{ width: 28, height: 28, marginRight: 8, transform: [{ rotate: headerLogoSpin }] }}>
          <Image
            source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </Animated.View>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{t('rates.live_rates')}</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.sectionHeader }}>
            {t('converter.last_updated', { defaultValue: 'آخر تحديث' })}: {lastUpdated || contextLastUpdated}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={[styles.headerCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          onPress={() => setAlertModalVisible(true)}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          onPress={() => fetchRates(true)}
          disabled={isRefreshingManual}
        >
          {isRefreshingManual ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh" size={20} color={colors.text} />}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <NeoBackground>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <View style={styles.container}>
        <View style={styles.topBar}><ConnectionIndicator /></View>

        <FlatList
          data={sortedRates}
          keyExtractor={(item) => item}
          ListHeaderComponent={renderHeader}
          renderItem={renderCurrencyItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchRates(true)} tintColor={colors.accent} />}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />

        <Modal visible={alertModalVisible} transparent animationType="slide">
          <View style={styles.modalBlur}>
            <View style={[styles.proModal, { backgroundColor: colors.background, borderColor: colors.glassBorder }]}>
              <View style={styles.modalHead}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('common.currency_alerts')}</Text>
                <TouchableOpacity onPress={() => setAlertModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              <FlatList
                data={sortedRates}
                keyExtractor={item => `alert-${item}`}
                renderItem={({ item }) => (
                  <View style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                    <Text style={styles.proFlagText}>{currencyInfo[item]?.flag}</Text>
                    <Text style={[styles.proCodeText, { color: colors.text, flex: 1, marginLeft: 10 }]}>{item}</Text>
                    <TextInput
                      style={[styles.proInput, { color: colors.text, borderColor: colors.border }]}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.sectionHeader}
                      value={tempAlerts[item] || ''}
                      onChangeText={val => setTempAlerts({...tempAlerts, [item]: val})}
                    />
                  </View>
                )}
              />
              <TouchableOpacity style={[styles.proSaveBtn, { backgroundColor: colors.activeBlue }]} onPress={handleSaveAlerts}>
                <Text style={styles.proSaveBtnText}>{t('common.save_alerts')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={reorderModalVisible} transparent animationType="slide">
          <View style={styles.modalBlur}>
            <View style={[styles.proModal, { backgroundColor: colors.background, borderColor: colors.glassBorder }]}>
              <View style={styles.modalHead}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('common.reorder_favorites')}</Text>
                <TouchableOpacity onPress={() => setReorderModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              <FlatList
                data={tempFavorites}
                keyExtractor={item => `reorder-${item}`}
                renderItem={({ item, index }) => (
                  <View style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                    <Text style={styles.proFlagText}>{currencyInfo[item]?.flag}</Text>
                    <Text style={[styles.proCodeText, { color: colors.text, flex: 1, marginLeft: 10 }]}>{item}</Text>
                    <View style={styles.reorderGroup}>
                      <TouchableOpacity onPress={() => moveFavorite(index, 'up')} style={styles.reorderIcon}><Ionicons name="chevron-up" size={20} color={colors.accent} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => moveFavorite(index, 'down')} style={styles.reorderIcon}><Ionicons name="chevron-down" size={20} color={colors.accent} /></TouchableOpacity>
                    </View>
                  </View>
                )}
              />
              <TouchableOpacity style={[styles.proSaveBtn, { backgroundColor: colors.activeBlue }]} onPress={saveFavoritesOrder}>
                <Text style={styles.proSaveBtnText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </NeoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', top: 5, right: 5, zIndex: 1000 },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  headerBtns: { flexDirection: 'row', gap: 8, backgroundColor: 'transparent' },
  headerCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 30 },
  proFlagText: { fontSize: 22 },
  proCodeText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  modalBlur: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  proModal: { borderRadius: 28, padding: 24, maxHeight: '85%', borderWidth: 1 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  proInput: { flex: 0.6, height: 36, borderBottomWidth: 1, textAlign: 'right', fontSize: 16, fontWeight: '700' },
  proSaveBtn: { borderRadius: 20, padding: 18, alignItems: 'center', marginTop: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  proSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  reorderGroup: { flexDirection: 'row', gap: 14 },
  reorderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }
});