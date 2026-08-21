import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, RefreshControl, Alert, Animated, Image, Platform, useWindowDimensions, InteractionManager, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { currencyInfo } from '../constants/currencyData';
import { LineChart } from "react-native-gifted-charts";
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { getCurrenciesData } from '../services/currenciesCoreData';
import { getMetalsData } from '../services/FinalMetalData';
import { trackPortfolioValue, getPortfolioHistory, isHistoryDataSufficient } from '../services/historyTracker';
import { CACHE_KEYS } from '../constants/cacheKeys';
import ConnectionIndicator from '../components/layout/ConnectionIndicator';
import NeoBackground from '../components/layout/NeoBackground';
import { getNeoStyles } from '../styles/NeoStyle';

const getElapsedTime = (dateString, t) => {
  if (!dateString) return '';
  const start = new Date(dateString);
  if (isNaN(start.getTime())) return '';
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? t('common.year') : t('common.years')}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? t('common.month') : t('common.months')}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? t('common.day') : t('common.days')}`);

  const separator = t('common.and') || ' and ';
  const agoSuffix = t('common.ago') || ' ago';
  return `${parts.join(separator)}${agoSuffix}`;
};

const PortfolioSkeleton = () => {
  const { colors, isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => {
      animation.stop();
      opacity.stopAnimation();
    };
  }, [opacity]);

  const skeletonColor = isDarkMode ? '#2a2a2a' : '#e1e9ee';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.totalContainer, { backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa', borderColor: colors.border, opacity }]}>
        <View style={styles.headerRowContainer}>
          <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor }]} />
          <View style={[styles.skeletonCircleSmall, { backgroundColor: skeletonColor }]} />
        </View>
        <View style={[styles.skeletonLineLong, { backgroundColor: skeletonColor, height: 28, width: '60%', marginVertical: 8 }]} />
        <View style={styles.perfSplitRow}>
          <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, flex: 1, marginHorizontal: 4 }]} />
          <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, flex: 1, marginHorizontal: 4 }]} />
        </View>
      </Animated.View>

      {[1, 2, 3, 4].map((item) => (
        <Animated.View key={item} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity }]}>
          <View style={styles.cardInfo}>
            <View style={[styles.skeletonCircle, { backgroundColor: skeletonColor }]} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, width: '40%' }]} />
                <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, width: '30%' }]} />
              </View>
              <View style={[styles.cardDetailsRow, { marginTop: 8 }]}>
                <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, width: '35%' }]} />
                <View style={[styles.skeletonLineShort, { backgroundColor: skeletonColor, width: '25%' }]} />
              </View>
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

const CustomPicker = ({ selectedValue, onValueChange, items, label, isCurrencyPicker = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { favorites = [], toggleFavorite } = useContext(SettingsContext) || {};

  const selectedItem = useMemo(() =>
    items.find(i => i.value === selectedValue),
    [items, selectedValue]
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(i =>
      i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return (
    <View style={styles.pickerWrapper}>
      <TouchableOpacity
        style={[styles.pickerButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => {
          Haptics.selectionAsync();
          setSearchQuery('');
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.text, fontSize: 15 }}>
          {selectedItem ? selectedItem.label : label}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: colors.background }]}>
            {items.length > 5 && (
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.text, marginTop: 0, marginBottom: 12 }]}
                placeholder={t('common.search')}
                placeholderTextColor={colors.sectionHeader}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            )}
            <FlatList
              style={{ flex: 1 }}
              data={filteredItems}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isFav = isCurrencyPicker && favorites.includes(item.value);
                return (
                  <View style={[styles.modalItemContainer, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.modalItemMain}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onValueChange(item.value);
                        setModalVisible(false);
                        setSearchQuery('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{item.label}</Text>
                    </TouchableOpacity>
                    {isCurrencyPicker && (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          toggleFavorite(item.value);
                        }}
                        style={styles.favoriteButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isFav ? "star" : "star-outline"}
                          size={20}
                          color={isFav ? "#FFD700" : colors.sectionHeader}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalVisible(false); setSearchQuery(''); }}>
              <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: 'bold' }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function PortfolioScreen() {
  const { t, i18n } = useTranslation();
  const { baseCurrency } = useContext(BaseCurrencyContext);
  const { language, favorites = [], toggleFavorite } = useContext(SettingsContext) || {};
  const { colors, isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const BRAND_COLOR = '#387c9f';
  const neoStyles = getNeoStyles(colors, isDarkMode);

  const [assets, setAssets] = useState([]);
  const [currencyRates, setCurrencyRates] = useState({ USD: 1 });
  const [metalRates, setMetalRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const [hideValues, setHideValues] = useState(false);
  const [portfolioTarget, setPortfolioTarget] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [bellModalVisible, setBellModalVisible] = useState(false);
  const [reportsModalVisible, setReportsModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);

  const [activeChartTab, setActiveChartTab] = useState('1M');
  const [activeReportTab, setActiveReportTab] = useState('daily');

  const [assetType, setAssetType] = useState('currency');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newAmount, setNewAmount] = useState('');
  const [editingAsset, setEditingAsset] = useState(null);

  const [historyPoints, setHistoryPoints] = useState([]);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const spinValue = useRef(new Animated.Value(0)).current;
  const isLoaded = useRef(false);
  const saveTimeoutRef = useRef(null);

  const handleToggleHideValues = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextValue = !hideValues;
    setHideValues(nextValue);
    try {
      await AsyncStorage.setItem('portfolio_hide_values', JSON.stringify(nextValue));
    } catch (error) {
      console.error('Error saving hideValues preference:', error);
    }
  };

  const metalInfo = useMemo(() => ({
    'XAU_24': { name: t('metals.gold_24k'), flag: '🏆' },
    'XAU_22': { name: t('metals.gold_22k'), flag: '🪙' },
    'XAU_21': { name: t('metals.gold_21k'), flag: '🪙' },
    'XAU_18': { name: t('metals.gold_18k'), flag: '🪙' },
    'XAU_14': { name: t('metals.gold_14k'), flag: '🪙' },
    'XAU_12': { name: t('metals.gold_12k'), flag: '🪙' },
    'XAU_9': { name: t('metals.gold_9k'), flag: '🪙' },
    'XAU_INGOT_1': { name: t('metals.gold_bar_1g'), flag: '🧱' },
    'XAU_INGOT_2_5': { name: t('metals.gold_bar_2_5g'), flag: '🧱' },
    'XAU_INGOT_5': { name: t('metals.gold_bar_5g'), flag: '🧱' },
    'XAU_INGOT_10': { name: t('metals.gold_bar_10g'), flag: '🧱' },
    'XAU_INGOT_20': { name: t('metals.gold_bar_20g'), flag: '🧱' },
    'XAU_INGOT_50': { name: t('metals.gold_bar_50g'), flag: '🧱' },
    'XAU_INGOT_100': { name: t('metals.gold_bar_100g'), flag: '🧱' },
    'XAU_COIN': { name: t('metals.gold_coin'), flag: '🪙' },
    'XAG_999': { name: t('metals.silver_999'), flag: '🥈' },
    'XAG_925': { name: t('metals.silver_925'), flag: '🥈' },
    'XAG_800': { name: t('metals.silver_800'), flag: '🥈' },
    'XAG_GRAM': { name: t('metals.silver_gram'), flag: '🥈' },
  }), [t, language]);

  const metalOptions = useMemo(() => [
    { label: `🏆 ${t('metals.gold_24k')}`, value: 'XAU_24' },
    { label: `🪙 ${t('metals.gold_22k')}`, value: 'XAU_22' },
    { label: `🪙 ${t('metals.gold_21k')}`, value: 'XAU_21' },
    { label: `🪙 ${t('metals.gold_18k')}`, value: 'XAU_18' },
    { label: `🪙 ${t('metals.gold_14k')}`, value: 'XAU_14' },
    { label: `🪙 ${t('metals.gold_12k')}`, value: 'XAU_12' },
    { label: `🪙 ${t('metals.gold_9k')}`, value: 'XAU_9' },
    { label: `🪙 ${t('metals.gold_coin')}`, value: 'XAU_COIN' },
    { label: `🥈 ${t('metals.silver_999')}`, value: 'XAG_999' },
    { label: `🥈 ${t('metals.silver_925')}`, value: 'XAG_925' },
    { label: `🥈 ${t('metals.silver_800')}`, value: 'XAG_800' },
    { label: `🥈 ${t('metals.silver_gram')}`, value: 'XAG_GRAM' },
  ], [t, language]);

  const hasAnyTarget = useMemo(() => {
    const hasPortfolio = portfolioTarget !== undefined && portfolioTarget !== '' && portfolioTarget !== null;
    const hasAsset = assets.some(a => a.targetValue !== undefined && a.targetValue !== '' && a.targetValue !== null);
    return hasPortfolio || hasAsset;
  }, [portfolioTarget, assets]);

  useEffect(() => {
    let animation;
    if (refreshing || isRefreshingManual) {
      spinValue.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      spinValue.stopAnimation();
    }

    return () => {
      if (animation) animation.stop();
      spinValue.stopAnimation();
    };
  }, [refreshing, isRefreshingManual, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getRateForAsset = useCallback((assetKey, currRates, metRates, targetBaseCurr) => {
    if (!assetKey) return 0;
    const upperAssetKey = assetKey.toUpperCase();
    const upperTargetBase = targetBaseCurr ? targetBaseCurr.toUpperCase() : 'USD';

    if (upperAssetKey === upperTargetBase) return 1;

    const isMetalAsset = upperAssetKey.startsWith('XAU') || upperAssetKey.startsWith('XAG');

    if (isMetalAsset) {
      let priceInAppBase = 0;
      const base24 = metRates['XAU_24'] || 0;
      const baseSilver = metRates['XAG_GRAM'] || 0;

      if (upperAssetKey.startsWith('XAU_INGOT_')) {
        const weight = Number(upperAssetKey.replace('XAU_INGOT_', '').replace('_', '.'));
        priceInAppBase = base24 * weight;
      } else {
        switch (upperAssetKey) {
          case 'XAU_24': priceInAppBase = base24; break;
          case 'XAU_22': priceInAppBase = base24 * (22 / 24); break;
          case 'XAU_21': priceInAppBase = base24 * (21 / 24); break;
          case 'XAU_18': priceInAppBase = base24 * (18 / 24); break;
          case 'XAU_14': priceInAppBase = base24 * (14 / 24); break;
          case 'XAU_COIN': priceInAppBase = base24 * (21 / 24) * 8; break;
          case 'XAG_GRAM': case 'XAG_999': priceInAppBase = baseSilver; break;
          default: priceInAppBase = Number(metRates[upperAssetKey]) || 0;
        }
      }

      if (upperTargetBase === baseCurrency.toUpperCase()) {
        return priceInAppBase;
      } else {
        const rateToTarget = (currRates[upperTargetBase] || 1) / (currRates[baseCurrency.toUpperCase()] || 1);
        return priceInAppBase * rateToTarget;
      }
    } else {
      const targetRate = currRates[upperTargetBase] || 1;
      const assetRate = currRates[upperAssetKey] || 0;
      if (!assetRate) return 0;
      return targetRate / assetRate;
    }
  }, [baseCurrency]);

  const calculateAssetValueHelper = useCallback((asset, currRates, metRates, targetBase) => {
    const rate = getRateForAsset(asset.currency, currRates, metRates, targetBase);
    return (asset.amount * rate) || 0;
  }, [getRateForAsset]);

  const calculateAssetValue = useCallback((asset) => {
    return calculateAssetValueHelper(asset, currencyRates, metalRates, baseCurrency);
  }, [currencyRates, metalRates, baseCurrency, calculateAssetValueHelper]);

  useEffect(() => {
    if (!isLoaded.current) return;
    
    // Debounced saving to prevent lag
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_ASSETS, JSON.stringify(assets)).catch(() => {});
      
      const rawTotal = assets.reduce((sum, asset) => sum + calculateAssetValue(asset), 0);
      AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_TOTAL_VALUE, String(rawTotal)).catch(() => {});
    }, 500); // 500ms debounce
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [assets, calculateAssetValue]);

  useEffect(() => {
    if (!isLoaded.current) return;
    
    // Debounced saving for target
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_TARGET, portfolioTarget).catch(() => {});
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [portfolioTarget]);

  const loadStoredRates = useCallback(async (isManual = false) => {
    let isActive = true;
    if (isManual) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsRefreshingManual(true);
    }

    try {
      const storedAssets = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_ASSETS);
      const storedTarget = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_TARGET);
      const storedHideValues = await AsyncStorage.getItem(CACHE_KEYS.PORTFOLIO_HIDE_VALUES);

      if (isActive) {
        // Radical Fix: Only update assets if we have NOT loaded them yet
        // This prevents overwriting memory state with old storage data during additions
        if (storedAssets && !isLoaded.current) {
          setAssets(JSON.parse(storedAssets));
        }
        if (storedTarget !== null) setPortfolioTarget(storedTarget);
        if (storedHideValues !== null) setHideValues(JSON.parse(storedHideValues));
        isLoaded.current = true;
        setLoading(false);
      }

      if (isManual) {
        let parsedCurrencyRates = { USD: 1 };
        let parsedMetalRates = {};

        // دائماً false، لا forceRefresh لمنع الطلبات المباشرة
        const cData = await getCurrenciesData(false);
        if (isActive) parsedCurrencyRates = cData?.rates || { USD: 1 };

        const mData = await getMetalsData(baseCurrency, parsedCurrencyRates, false);
        if (isActive) {
          const flatMetals = {};
          if (mData) {
            Object.keys(mData).forEach(key => {
              if (mData[key] && mData[key].price) flatMetals[key] = mData[key].price;
            });
          }
          parsedMetalRates = flatMetals;

          setCurrencyRates(parsedCurrencyRates);
          setMetalRates(parsedMetalRates);
          setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

          const totalValue = assets.reduce((sum, asset) => sum + calculateAssetValueHelper(asset, parsedCurrencyRates, parsedMetalRates, baseCurrency), 0);
          await trackPortfolioValue(totalValue, assets, parsedCurrencyRates, parsedMetalRates, baseCurrency);

          // Load chart data in background to prevent UI lag
          setIsChartLoading(true);
          setTimeout(async () => {
            try {
              const updatedHistory = await getPortfolioHistory(activeChartTab);
              const formattedHistory = updatedHistory.map((p, index) => ({
                value: p.value,
                label: p.label || '',
                date: p.date
              }));
              setHistoryPoints(formattedHistory);
            } catch (error) {
              console.error('Error loading chart data:', error);
            } finally {
              setIsChartLoading(false);
            }
          }, 100); // Small delay to prioritize UI updates
        }
      }
    } catch (error) {
      console.error('Error loading portfolio data:', error);
    } finally {
      if (isActive) {
        setRefreshing(false);
        setIsRefreshingManual(false);
      }
    }
    return () => { isActive = false; };
  }, [baseCurrency, calculateAssetValueHelper]);

  useFocusEffect(
    useCallback(() => {
      // التحميل لحظي من الذاكرة المحلية لتقليل اللاج
      InteractionManager.runAfterInteractions(async () => {
        await loadStoredRates(false);
        const history = await getPortfolioHistory();
        const formattedHistory = history.map((p, index) => ({
          value: p.value,
          label: index % 3 === 0 && p.date ? p.date.split('-').slice(1).reverse().join('/') : '',
          labelTextStyle: { color: colors.sectionHeader, fontSize: 8 }
        }));
        setHistoryPoints(formattedHistory);
      });
      return () => {
        // تنظيف عند الخروج لمنع التداخل
        setIsRefreshingManual(false);
      };
    }, [loadStoredRates, colors.sectionHeader])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStoredRates(false); // دائماً false، لا forceRefresh
  }, [loadStoredRates]);

  const resetPerformance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("portfolio.reset_performance"),
      t("portfolio.reset_performance_confirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.reset"),
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const updatedAssets = assets.map(asset => {
              const currentValue = calculateAssetValue(asset);
              return {
                ...asset,
                initialValue: currentValue,
                initialCurrency: baseCurrency,
                date: new Date().toISOString(),
                lastModified: Date.now()
              };
            });
            setAssets(updatedAssets);
            AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'true');
          },
          style: "destructive"
        }
      ]
    );
  };

  const saveAsset = () => {
    if (!newAmount || isNaN(newAmount) || parseFloat(newAmount) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("portfolio.amount_validation"));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const parsedAmount = parseFloat(newAmount);
    const currentVal = calculateAssetValue({ currency: newCurrency, amount: parsedAmount });
    const currentDate = new Date().toISOString();

    if (editingAsset) {
      setAssets(prevAssets => prevAssets.map(item =>
        item.id === editingAsset.id ? {
          ...item,
          currency: newCurrency,
          amount: parsedAmount,
          initialValue: item.initialValue !== undefined ? item.initialValue : currentVal,
          initialCurrency: item.initialCurrency || baseCurrency,
          date: item.date || currentDate,
          lastModified: Date.now()
        } : item
      ));
    } else {
      if (assets.length === 0) {
        AsyncStorage.getItem(CACHE_KEYS.FIRST_ASSET_TIME).then(val => {
          if (!val) AsyncStorage.setItem(CACHE_KEYS.FIRST_ASSET_TIME, Date.now().toString());
        });
      }

      setAssets(prevAssets => [...prevAssets, {
        id: Date.now().toString(),
        currency: newCurrency,
        amount: parsedAmount,
        initialValue: currentVal,
        initialCurrency: baseCurrency,
        date: currentDate,
        lastModified: Date.now()
      }]);
    }

    AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'true');
    closeModal();
  };

  const deleteAsset = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("common.confirm"),
      t("portfolio.delete_confirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setAssets(prevAssets => prevAssets.filter(item => item.id !== id));
            AsyncStorage.setItem(CACHE_KEYS.PORTFOLIO_NEEDS_SYNC, 'true');
          },
          style: "destructive"
        }
      ]
    );
  };

  const openEdit = (asset) => {
    Haptics.selectionAsync();
    setEditingAsset(asset);
    const isMetal = asset.currency.startsWith('XAU') || asset.currency.startsWith('XAG');
    setAssetType(isMetal ? 'metal' : 'currency');
    setNewCurrency(asset.currency);
    setNewAmount(asset.amount.toString());
    setModalVisible(true);
  };

  const openAddModal = () => {
    Haptics.selectionAsync();
    setEditingAsset(null);
    setAssetType('currency');
    setNewCurrency('USD');
    setNewAmount('');
    setModalVisible(true);
  };

  const closeModal = () => {
    Haptics.selectionAsync();
    setModalVisible(false);
    setEditingAsset(null);
    setNewAmount('');
    setNewCurrency('USD');
    setAssetType('currency');
  };

  const updateTargetValue = (id, targetVal) => {
    setAssets(assets.map(item =>
      item.id === id ? { ...item, targetValue: targetVal } : item
    ));
  };

  const formatNumber = (num) => {
    if (hideValues) return '••••';
    return isNaN(num) ? '0.00' : Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const formatAlwaysVisibleNumber = (num) => {
    return isNaN(num) ? '0.00' : Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const formattedTotal = useMemo(() => {
    const rawTotal = assets.reduce((sum, asset) => sum + calculateAssetValue(asset), 0);
    const num = isNaN(rawTotal) ? 0 : rawTotal;

    if (hideValues) return { integerPart: '••••', decimalPart: '' };

    const parts = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).split('.');

    return { integerPart: parts[0], decimalPart: `.${parts[1] || '00'}` };
  }, [assets, calculateAssetValue, hideValues]);

  const getAssetPerformance = useCallback((asset) => {
    const currentValue = calculateAssetValue(asset);
    let effectiveInitial = asset.initialValue !== undefined ? asset.initialValue : currentValue;

    if (asset.initialCurrency && asset.initialCurrency !== baseCurrency) {
      const conversionRate = getRateForAsset(asset.initialCurrency, currencyRates, metalRates, baseCurrency);
      effectiveInitial = asset.initialValue * conversionRate;
    }

    const diff = currentValue - effectiveInitial;
    const percent = effectiveInitial > 0 ? (diff / effectiveInitial) * 100 : 0;

    return {
      currentValueFormatted: formatNumber(currentValue),
      diffFormatted: formatNumber(Math.abs(diff)),
      percentFormatted: hideValues ? '••••' : Math.abs(percent).toFixed(2),
      isProfit: diff > 0,
      isEqual: Math.abs(diff) < 0.01 || Math.abs(percent) < 0.01
    };
  }, [calculateAssetValue, hideValues, baseCurrency, currencyRates, metalRates, getRateForAsset]);

  const getPortfolioPerformance = useMemo(() => {
    let totalCurrent = 0;
    let totalInitialAdjusted = 0;
    let totalGains = 0;
    let totalLosses = 0;

    assets.forEach(asset => {
      const currentValue = calculateAssetValue(asset);
      totalCurrent += currentValue;

      let effectiveInitial = asset.initialValue !== undefined ? asset.initialValue : currentValue;
      if (asset.initialCurrency && asset.initialCurrency !== baseCurrency) {
        const conversionRate = getRateForAsset(asset.initialCurrency, currencyRates, metalRates, baseCurrency);
        effectiveInitial = asset.initialValue * conversionRate;
      }
      totalInitialAdjusted += effectiveInitial;

      const diff = currentValue - effectiveInitial;
      if (diff > 0.01) totalGains += diff;
      else if (diff < -0.01) totalLosses += Math.abs(diff);
    });

    const netDiff = totalCurrent - totalInitialAdjusted;
    const netPercent = totalInitialAdjusted > 0 ? (netDiff / totalInitialAdjusted) * 100 : 0;

    return {
      totalGainsFormatted: formatNumber(totalGains),
      totalLossesFormatted: formatNumber(totalLosses),
      netDiffFormatted: formatNumber(Math.abs(netDiff)),
      netPercentFormatted: hideValues ? '••••' : Math.abs(netPercent).toFixed(2),
      isProfit: netDiff > 0.01,
      isEqual: Math.abs(netDiff) < 0.01
    };
  }, [assets, calculateAssetValue, hideValues, baseCurrency, currencyRates, metalRates, getRateForAsset]);

  const activeReportData = useMemo(() => {
    const now = new Date();
    const tabDaysMap = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, semiannual: 180, yearly: 365 };
    const periodDays = tabDaysMap[activeReportTab] || 1;
    const periodStartDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    let pTotalCurrent = 0;
    let pInitialBase = 0;
    let pGains = 0;
    let pLosses = 0;

    const assetReports = assets.map(asset => {
      const assetDate = asset.date ? new Date(asset.date) : now;
      if (assetDate > periodStartDate) return { id: asset.id, currency: asset.currency, amount: asset.amount, isNotActiveYet: true };

      const currentVal = calculateAssetValue(asset);
      let effectiveInitial = asset.initialValue !== undefined ? asset.initialValue : currentVal;

      if (asset.initialCurrency && asset.initialCurrency !== baseCurrency) {
        const conversionRate = getRateForAsset(asset.initialCurrency, currencyRates, metalRates, baseCurrency);
        effectiveInitial = asset.initialValue * conversionRate;
      }

      pTotalCurrent += currentVal;
      pInitialBase += effectiveInitial;

      const diff = currentVal - effectiveInitial;
      if (diff > 0.01) pGains += diff;
      else if (diff < -0.01) pLosses += Math.abs(diff);

      return {
        id: asset.id,
        currency: asset.currency,
        amount: asset.amount,
        currentValue: formatAlwaysVisibleNumber(currentVal),
        diffFormatted: formatAlwaysVisibleNumber(Math.abs(diff)),
        percentFormatted: Math.abs(pInitialBase > 0 ? (diff / pInitialBase) * 100 : 0).toFixed(2),
        isProfit: diff > 0.01,
        isEqual: Math.abs(diff) < 0.01,
        isNotActiveYet: false,
      };
    });

    const netDiff = pTotalCurrent - pInitialBase;

    return {
      totalValue: formatAlwaysVisibleNumber(pTotalCurrent),
      totalGains: formatAlwaysVisibleNumber(pGains),
      totalLosses: formatAlwaysVisibleNumber(pLosses),
      netDiffFormatted: formatAlwaysVisibleNumber(Math.abs(netDiff)),
      netPercentFormatted: Math.abs(pInitialBase > 0 ? (netDiff / pInitialBase) * 100 : 0).toFixed(2),
      isProfit: netDiff > 0.01,
      isEqual: Math.abs(netDiff) < 0.01,
      assetReports,
    };
  }, [assets, calculateAssetValue, activeReportTab, baseCurrency, currencyRates, metalRates, getRateForAsset]);

  const currencyOptions = useMemo(() => {
    const keys = Object.keys(currencyRates).length > 1
      ? Object.keys(currencyRates).filter(k => !k.startsWith('XAU') && !k.startsWith('XAG'))
      : Object.keys(currencyInfo);
    const priorityOrder = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'GBP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD'];

    const sortedKeys = [...keys].sort((a, b) => {
      const indexA = favorites.indexOf(a);
      const indexB = favorites.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      const pA = priorityOrder.indexOf(a);
      const pB = priorityOrder.indexOf(b);
      if (pA !== -1 && pB !== -1) return pA - pB;
      if (pA !== -1) return -1;
      if (pB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map(c => ({
      label: `${currencyInfo[c]?.flag || '🌐'} ${c} - ${t(`currencies.${c}`, { defaultValue: currencyInfo[c]?.name || c })}`,
      value: c
    }));
  }, [currencyRates, t, favorites]);

  // --- تصفية البيانات التاريخية للرسم البياني ---
  const filteredHistory = useMemo(() => {
    if (historyPoints.length === 0) return [];

    // ملاحظة: historyPoints تأتي مرتبة من الأقدم للأحدث من getPortfolioHistory
    const now = new Date();
    let filterDate = new Date();

    switch (activeChartTab) {
      case '1W': filterDate.setDate(now.getDate() - 7); break;
      case '1M': filterDate.setMonth(now.getMonth() - 1); break;
      case '3M': filterDate.setMonth(now.getMonth() - 3); break;
      case '6M': filterDate.setMonth(now.getMonth() - 6); break;
      case '9M': filterDate.setMonth(now.getMonth() - 9); break;
      case '1Y': filterDate.setFullYear(now.getFullYear() - 1); break;
      case 'ALL': return historyPoints;
      default: filterDate.setMonth(now.getMonth() - 1);
    }

    // تصفية النقاط بناءً على التاريخ المختار
    const filtered = historyPoints.filter(p => {
      // نفترض أن p.label تحتوى على التاريخ بتنسيق MM/DD من الكود السابق،
      // ولكن historyPoints الحقيقية من getPortfolioHistory تحتوى على p.date الأصلي
      // سنعتمد على p.timestamp إذا كان موجوداً أو نحول p.date
      const pointDate = p.timestamp ? new Date(p.timestamp) : new Date();
      return pointDate >= filterDate;
    });

    // تنسيق الملصقات (Labels) ديناميكياً لتجنب الزحام
    return filtered.map((p, index) => {
      let label = '';
      const totalPoints = filtered.length;

      // منطق ذكي لإظهار الملصقات:
      // 1. في حالة الأسبوع: أظهر كل الأيام
      if (activeChartTab === '1W') {
        label = p.label;
      }
      // 2. في حالة الشهر: أظهر ملصق كل 5 أيام
      else if (activeChartTab === '1M') {
        label = index % 5 === 0 ? p.label : '';
      }
      // 3. في حالة مدد أطول: أظهر ملصق كل 15 يوم أو بداية كل شهر
      else {
        label = index % 15 === 0 ? p.label : '';
      }

      return {
        ...p,
        label: label,
        labelTextStyle: { color: colors.sectionHeader, fontSize: 8 }
      };
    });
  }, [historyPoints, activeChartTab, colors.sectionHeader]);

  const minChartVal = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    return Math.min(...filteredHistory.map(p => p.value));
  }, [filteredHistory]);

  const maxChartVal = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    return Math.max(...filteredHistory.map(p => p.value));
  }, [filteredHistory]);

  if (loading && assets.length === 0) return <PortfolioSkeleton />;

  return (
    <NeoBackground>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <View style={[styles.container]}>
        <View style={styles.topIndicatorRow}><ConnectionIndicator /></View>

        {/* 1. Header Row */}
        <View style={[neoStyles.floatingBar, { height: 60, paddingVertical: 0, paddingHorizontal: 12, justifyContent: 'flex-start', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: colors.glassBorder, marginTop: 40, marginBottom: 15 }]}>
          <View style={[styles.headerTitleGroup, { flex: 1, justifyContent: 'flex-start', flexDirection: 'row', alignItems: 'center' }]}>
            <Animated.View style={[{ width: 44, height: 44, marginRight: 8 }, { transform: [{ rotate: spin }] }]}><Image source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" /></Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={[neoStyles.mainTitle, { fontSize: 18, fontWeight: '900', textAlign: 'left' }]} numberOfLines={1}>{t('portfolio.title')}</Text>
              {lastUpdated ? <Text style={{ color: colors.sectionHeader, fontSize: 9, fontWeight: '700', marginTop: -1, textAlign: 'left' }} numberOfLines={1}>{t('converter.last_updated')}: {lastUpdated}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity style={[styles.headerCircle, { width: 34, height: 34, borderRadius: 17, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: colors.border, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' }]} onPress={() => { Haptics.selectionAsync(); setBellModalVisible(true); }}>
              <Ionicons name={hasAnyTarget ? "notifications" : "notifications-outline"} size={17} color={hasAnyTarget ? "#FF9500" : BRAND_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerCircle, { width: 34, height: 34, borderRadius: 17, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: colors.border, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' }]} onPress={() => loadStoredRates(false)} disabled={isRefreshingManual}>
              {isRefreshingManual ? <ActivityIndicator size="small" color={BRAND_COLOR} /> : <Ionicons name="refresh" size={17} color={BRAND_COLOR} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Floating Stats Section */}
        <View style={{
          width: '100%',
          maxWidth: 800,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          alignItems: 'center',
          marginTop: 5,
        }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={[styles.totalLabel, { color: colors.text, opacity: 0.8 }]}>{t('portfolio.total_value')}</Text>
            <TouchableOpacity
              style={{ marginLeft: 10, padding: 4 }}
              onPress={handleToggleHideValues}
              activeOpacity={0.7}
            >
              <Ionicons name={hideValues ? "eye-off" : "eye"} size={18} color={hideValues ? "#FF3B30" : BRAND_COLOR} />
            </TouchableOpacity>
          </View>

          <View style={styles.totalValueContainer}>
            <Text style={styles.totalValueText}>
              <Text style={[styles.integerPart, { color: BRAND_COLOR }]}>{formattedTotal.integerPart}</Text>
              {formattedTotal.decimalPart ? <Text style={[styles.decimalPart, { color: BRAND_COLOR }]}>{formattedTotal.decimalPart}</Text> : null}
              <Text style={[styles.currencySymbol, { color: BRAND_COLOR }]}> {baseCurrency}</Text>
            </Text>
          </View>

          <View style={[styles.perfSplitRow, { width: '100%', borderTopWidth: 0 }]}>
            <View style={styles.perfSide}>
              <Text style={styles.perfSideLabel}>{t('portfolio.gains')}</Text>
              <Text style={[styles.perfSideValue, { color: '#34C759' }]}>▲ {hideValues ? '••••' : `+${getPortfolioPerformance.totalGainsFormatted}`}</Text>
            </View>
            <View style={styles.perfSide}>
              <Text style={styles.perfSideLabel}>{t('portfolio.losses')}</Text>
              <Text style={[styles.perfSideValue, { color: '#FF3B30' }]}>▼ {hideValues ? '••••' : `-${getPortfolioPerformance.totalLossesFormatted}`}</Text>
            </View>
          </View>

          <View style={[styles.netResultContainer, { marginTop: 4 }]}>
            <Text style={[styles.netResultText, { color: getPortfolioPerformance.isEqual ? colors.sectionHeader : (getPortfolioPerformance.isProfit ? '#34C759' : '#FF3B30') }]}>
              {hideValues ? '••••' : (getPortfolioPerformance.isEqual ? `0.00 ${baseCurrency} (0.00%)` : `${getPortfolioPerformance.isProfit ? '+' : '-'}${getPortfolioPerformance.netDiffFormatted} ${baseCurrency} (${getPortfolioPerformance.netPercentFormatted}%)`)}
            </Text>
          </View>

          {/* Mini Sparkline Chart */}
          {historyPoints.length > 1 && (
            <View style={{
              width: '100%',
              height: 60,
              marginTop: 15,
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderRadius: 16,
              overflow: 'hidden',
              flexDirection: 'row',
              alignItems: 'center',
              paddingRight: 10,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
            }}>
              <View style={{ flex: 1, height: '100%', pointerEvents: 'none' }}>
                {isChartLoading ? (
                  <ActivityIndicator size="small" color={BRAND_COLOR} />
                ) : (
                  <LineChart
                    data={historyPoints}
                    height={50}
                    width={screenWidth - 100}
                    initialSpacing={0}
                    spacing={(screenWidth - 120) / Math.max(1, historyPoints.length - 1)}
                    color={BRAND_COLOR}
                    thickness={2}
                    hideDataPoints
                    hideRules
                    hideYAxisText
                    hideAxesAndRules
                    yAxisThickness={0}
                    xAxisThickness={0}
                    curved
                    areaChart
                    startFillColor={BRAND_COLOR}
                    startOpacity={0.1}
                    endFillColor={BRAND_COLOR}
                    endOpacity={0.01}
                  />
                )}
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setChartModalVisible(true); }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: BRAND_COLOR + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="stats-chart" size={16} color={BRAND_COLOR} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.totalActionButtonsRow, { width: '100%', marginTop: 12 }]}>
            <TouchableOpacity style={[styles.resetButton, { flex: 1, marginRight: 6, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)', borderColor: '#FF9500' }]} onPress={resetPerformance} activeOpacity={0.8}>
              <Ionicons name="reload-circle-outline" size={14} color="#FF9500" style={{ marginRight: 4 }} />
              <Text style={styles.resetButtonText}>{t('portfolio.reset_performance')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resetButton, { flex: 1, marginLeft: 6, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)', borderColor: BRAND_COLOR }]} onPress={() => { Haptics.selectionAsync(); setReportsModalVisible(true); }} activeOpacity={0.8}>
              <Ionicons name="bar-chart-outline" size={14} color={BRAND_COLOR} style={{ marginRight: 4 }} />
              <Text style={[styles.resetButtonText, { color: BRAND_COLOR }]}>{t('common.details')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 170, flexGrow: 1, maxWidth: 800, alignSelf: 'center', width: '100%' }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => {
            const perf = getAssetPerformance(item);
            const isMetal = item.currency.startsWith('XAU') || item.currency.startsWith('XAG');
            const flag = isMetal ? (metalInfo[item.currency]?.flag || '🪙') : (currencyInfo[item.currency]?.flag || '🌐');
            const assetName = isMetal ? (metalInfo[item.currency]?.name || item.currency) : (t(`currencies.${item.currency}`, { defaultValue: item.currency }));
            const unitLabel = item.currency.startsWith('XAU_INGOT') || item.currency === 'XAG_GRAM' || item.currency.startsWith('XAU_2') || item.currency.startsWith('XAU_1') || item.currency.startsWith('XAU_9') ? 'g' : (t('portfolio.units') || 'وحدات');

            let cardBg = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)';
            let cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
            if (item.currency.startsWith('XAU')) {
              cardBg = isDarkMode ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 215, 0, 0.22)';
              cardBorder = isDarkMode ? 'rgba(212, 175, 55, 0.45)' : 'rgba(212, 175, 55, 0.5)';
            } else if (item.currency.startsWith('XAG')) {
              cardBg = isDarkMode ? 'rgba(192, 192, 192, 0.2)' : 'rgba(220, 224, 230, 0.85)';
              cardBorder = isDarkMode ? 'rgba(192, 192, 192, 0.4)' : 'rgba(192, 192, 192, 0.6)';
            }

            return (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.cardInfo}>
                  <Text style={styles.flag}>{flag}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                        <Text style={[styles.assetName, { color: colors.text }]} numberOfLines={1}>{assetName}</Text>
                        {(item.targetValue !== undefined && item.targetValue !== '') && <Ionicons name="notifications" size={13} color="#FF9500" style={{ marginRight: 4 }} />}
                      </View>
                      <Text style={[styles.assetValueInBase, { color: colors.text }]}>{perf.currentValueFormatted} {baseCurrency}</Text>
                    </View>
                    <View style={styles.cardDetailsRow}>
                      <Text style={[styles.assetBalance, { color: colors.sectionHeader }]}>{formatNumber(item.amount)} {unitLabel}</Text>
                      <Text style={[styles.performanceText, { color: perf.isEqual ? colors.sectionHeader : (perf.isProfit ? '#34C759' : '#FF3B30') }]}>
                        {hideValues ? '••••' : (perf.isEqual ? `0.00 (0%)` : `${perf.isProfit ? '+' : '-'}${perf.diffFormatted} (${perf.percentFormatted}%)`)}
                      </Text>
                    </View>
                    <View style={styles.dateInfoRow}>
                      <Ionicons name="time-outline" size={10} color={colors.sectionHeader} style={{ marginRight: 3 }} />
                      <Text style={[styles.assetDateText, { color: colors.sectionHeader }]}>
                        {item.date ? `${new Date(item.date).toLocaleDateString()} (${getElapsedTime(item.date, t)})` : t('portfolio.not_specified')}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}><Ionicons name="pencil-outline" size={15} color="orange" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAsset(item.id)} style={styles.actionBtn}><Ionicons name="trash-outline" size={15} color="red" /></TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')} style={styles.emptyLogo} resizeMode="contain" />
              <Text style={[styles.emptyText, { color: colors.sectionHeader }]}>{t('portfolio.no_assets')}</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        />

        <TouchableOpacity style={[styles.addButton, { maxWidth: 800, alignSelf: 'center' }]} onPress={openAddModal} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>{t('portfolio.add_asset')}</Text>
        </TouchableOpacity>

        {/* Reports Modal */}
        <Modal visible={reportsModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReportsModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '90%', maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="bar-chart" size={20} color="#387c9f" style={{ marginRight: 8 }} /><Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('portfolio.portfolio_reports')}</Text></View>
                <TouchableOpacity onPress={() => setReportsModalVisible(false)} style={{ padding: 4 }}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
              </View>
              <View style={styles.reportTabsContainer}>
                {['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'].map((key) => (
                  <TouchableOpacity key={key} style={[styles.reportTabButton, { backgroundColor: activeReportTab === key ? '#387c9f' : colors.cardBg, borderColor: activeReportTab === key ? '#387c9f' : colors.border }]} onPress={() => setActiveReportTab(key)}>
                    <Text style={[styles.reportTabText, { color: activeReportTab === key ? '#fff' : colors.text }]}>{key.substring(0, 3).toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.reportSummaryCard, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
                <Text style={{ fontSize: 11, color: colors.sectionHeader, fontWeight: '600' }}>{t('portfolio.period_total_value')}</Text>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#387c9f', marginVertical: 2 }}>{activeReportData.totalValue} {baseCurrency}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6, borderTopWidth: 0.5, borderTopColor: 'rgba(150,150,150,0.2)', paddingTop: 4 }}>
                  <Text style={{ fontSize: 12, color: '#34C759', fontWeight: '600' }}>+{activeReportData.totalGains}</Text>
                  <Text style={{ fontSize: 12, color: '#FF3B30', fontWeight: '600' }}>-{activeReportData.totalLosses}</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: activeReportData.isEqual ? colors.sectionHeader : (activeReportData.isProfit ? '#34C759' : '#FF3B30') }}>
                     {activeReportData.isEqual ? '0%' : `${activeReportData.isProfit ? '+' : ''}${activeReportData.netPercentFormatted}%`}
                  </Text>
                </View>
              </View>
              <FlatList
                data={activeReportData.assetReports}
                keyExtractor={(item) => `report_${item.id}`}
                renderItem={({ item }) => (
                  <View style={[styles.reportItemCard, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)', borderColor: colors.border, borderWidth: 1.2 }]}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{t(`currencies.${item.currency}`, { defaultValue: item.currency })}</Text>
                        <Text style={{ color: colors.text }}>{item.currentValue}</Text>
                     </View>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: colors.sectionHeader }}>{formatNumber(item.amount)}</Text>
                        <Text style={{ fontSize: 10, color: item.isEqual ? colors.sectionHeader : (item.isProfit ? '#34C759' : '#FF3B30') }}>
                          {item.isNotActiveYet ? '---' : `${item.isProfit ? '+' : ''}${item.percentFormatted}%`}
                        </Text>
                     </View>
                  </View>
                )}
              />
              <TouchableOpacity style={styles.confirmButton} onPress={() => setReportsModalVisible(false)}><Text style={styles.confirmButtonText}>{t('common.close')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Chart Modal */}
        <Modal visible={chartModalVisible} animationType="slide" transparent={true} onRequestClose={() => setChartModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '95%', maxWidth: 800, alignSelf: 'center', width: '100%', paddingBottom: 10 }]}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="trending-up-outline" size={24} color={BRAND_COLOR} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>
                    {t('portfolio.performance_analysis', { defaultValue: 'تحليل الأداء' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setChartModalVisible(false)} style={{ padding: 6, backgroundColor: colors.cardBg, borderRadius: 20 }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Time Filter Buttons */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, maxHeight: 45 }} contentContainerStyle={{ paddingRight: 20 }}>
                {['1W', '1M', '3M', '6M', '9M', '1Y', 'ALL'].map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveChartTab(tab);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: activeChartTab === tab ? BRAND_COLOR : colors.cardBg,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: activeChartTab === tab ? BRAND_COLOR : colors.border,
                      minWidth: 55,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: activeChartTab === tab ? '#fff' : colors.sectionHeader, fontWeight: '800', fontSize: 12 }}>
                      {tab === 'ALL' ? t('common.all', { defaultValue: 'الكل' }) : tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Dynamic Scrollable Chart */}
              <View style={{ marginBottom: 20, alignItems: 'center', width: '100%', height: 260 }}>
                {isChartLoading ? (
                  <ActivityIndicator size="large" color={BRAND_COLOR} />
                ) : filteredHistory.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 40 }}>
                    <LineChart
                      data={filteredHistory}
                      height={220}
                      width={Math.max(screenWidth - 60, filteredHistory.length * 40)}
                      initialSpacing={20}
                      spacing={45}
                      color={BRAND_COLOR}
                      thickness={4}
                      startFillColor={BRAND_COLOR}
                      endFillColor={BRAND_COLOR}
                      startOpacity={0.4}
                      endOpacity={0.01}
                      areaChart
                      curved
                      hideDataPoints={false}
                      dataPointsColor={BRAND_COLOR}
                      dataPointsRadius={4}
                      hideRules
                      xAxisThickness={1}
                      xAxisColor={colors.border}
                      yAxisThickness={0}
                      yAxisTextStyle={{ color: colors.sectionHeader, fontSize: 10 }}
                      noOfSections={5}
                      xAxisLabelTextStyle={{
                        color: colors.sectionHeader,
                        fontSize: 8,
                        opacity: 0.8,
                        textAlign: 'center'
                      }}
                      stepHeight={40}
                      pointerConfig={{
                        pointerStripHeight: 220,
                        pointerStripColor: BRAND_COLOR,
                        pointerStripWidth: 2,
                        pointerColor: BRAND_COLOR,
                        radius: 6,
                        pointerLabelComponent: items => {
                          if (!items || !items.length || items[0]?.value === undefined) return null;
                          return (
                            <View style={{
                              padding: 12,
                              backgroundColor: colors.cardBg,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: 'center',
                              bottom: 60,
                              shadowColor: '#000',
                              shadowOpacity: 0.1,
                              shadowRadius: 10,
                              minWidth: 100
                            }}>
                              <Text style={{ color: BRAND_COLOR, fontWeight: '900', fontSize: 15 }}>
                                {Number(items[0].value).toLocaleString()}
                              </Text>
                              <Text style={{ color: colors.sectionHeader, fontSize: 10, marginTop: 4 }}>
                                {items[0].label || ''}
                              </Text>
                            </View>
                          );
                        }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.sectionHeader, fontSize: 13 }}>{t('portfolio.no_assets')}</Text>
                  </View>
                )}
              </View>

              {/* Stats Summary Card */}
              <View style={{ padding: 20, borderRadius: 24, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <Text style={{ color: colors.sectionHeader, fontWeight: '700' }}>
                    {t('portfolio.period_low', { defaultValue: 'أدنى قيمة' })}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{minChartVal.toLocaleString()} {baseCurrency}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <Text style={{ color: colors.sectionHeader, fontWeight: '700' }}>
                    {t('portfolio.period_high', { defaultValue: 'أعلى قيمة' })}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{maxChartVal.toLocaleString()} {baseCurrency}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 }}>
                  <Text style={{ color: colors.sectionHeader, fontWeight: '700' }}>
                    {t('portfolio.net_growth', { defaultValue: 'صافي النمو' })}
                  </Text>
                  <Text style={{ color: getPortfolioPerformance.isProfit ? '#34C759' : '#FF3B30', fontWeight: '900' }}>
                    {getPortfolioPerformance.isProfit ? '+' : ''}{getPortfolioPerformance.netPercentFormatted}%
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.confirmButton, { marginTop: 10 }]} onPress={() => setChartModalVisible(false)}>
                <Text style={styles.confirmButtonText}>{t('common.done', { defaultValue: 'تم' })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add/Edit Asset Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text }}>{editingAsset ? t("portfolio.edit_asset") : t("portfolio.add_asset")}</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity style={[styles.typeTab, { backgroundColor: assetType === 'currency' ? '#387c9f' : colors.cardBg }]} onPress={() => { setAssetType('currency'); setNewCurrency('USD'); }}><Text style={{ color: assetType === 'currency' ? '#fff' : colors.text, fontWeight: 'bold' }}>{t('portfolio.currencies_tab')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.typeTab, { backgroundColor: assetType === 'metal' ? '#f59e0b' : colors.cardBg }]} onPress={() => { setAssetType('metal'); setNewCurrency('XAU_21'); }}><Text style={{ color: assetType === 'metal' ? '#fff' : colors.text, fontWeight: 'bold' }}>{t('portfolio.metals')}</Text></TouchableOpacity>
              </View>
              <CustomPicker label={t('portfolio.select_currency')} selectedValue={newCurrency} onValueChange={setNewCurrency} items={assetType === 'currency' ? currencyOptions : metalOptions} isCurrencyPicker={assetType === 'currency'} />
              <TextInput style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.text }]} placeholder={t("common.amount")} keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />
              <TouchableOpacity style={styles.confirmButton} onPress={saveAsset}><Text style={styles.confirmButtonText}>{t('common.save')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={closeModal}><Text style={styles.cancelButton}>{t('common.cancel')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Targets & Notifications Modal */}
        <Modal visible={bellModalVisible} animationType="slide" transparent={true} onRequestClose={() => setBellModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '85%', maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('portfolio.targets_notifications')}</Text><TouchableOpacity onPress={() => setBellModalVisible(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity></View>
              <FlatList
                data={assets}
                keyExtractor={(item) => `target_${item.id}`}
                renderItem={({ item }) => (
                  <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 10 }]}>
                     <Text style={{ color: colors.text, fontWeight: 'bold' }}>{t(`currencies.${item.currency}`, { defaultValue: item.currency })}</Text>
                     <TextInput style={[styles.input, { height: 35, marginTop: 5 }]} placeholder={t('portfolio.target')} keyboardType="numeric" value={item.targetValue} onChangeText={(v) => updateTargetValue(item.id, v)} />
                  </View>
                )}
              />
              <TouchableOpacity style={styles.confirmButton} onPress={() => setBellModalVisible(false)}><Text style={styles.confirmButtonText}>{t('common.done')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </NeoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 35 : 40,
    right: 16,
    zIndex: 1000,
  },
  floatingHeader: {
    paddingHorizontal: 0,
    marginTop: 25,
    marginBottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 99
  },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  headerBtns: { flexDirection: 'row', gap: 8, backgroundColor: 'transparent' },
  headerCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 30 },
  proCard: {
    marginBottom: 14,
    padding: 14,
  },
  proFlagText: { fontSize: 22 },
  proCodeText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  proNameText: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  proPriceLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  proPriceValue: { fontSize: 12, fontWeight: '800' },
  proMainRate: { fontSize: 18, fontWeight: '900' },
  proBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  proBadgeText: { fontSize: 10, fontWeight: '800' },
  modalBlur: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  proModal: { borderRadius: 28, padding: 24, maxHeight: '85%', borderWidth: 1 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  proInput: { flex: 0.6, height: 36, borderBottomWidth: 1, textAlign: 'right', fontSize: 16, fontWeight: '700' },
  proSaveBtn: { borderRadius: 20, padding: 18, alignItems: 'center', marginTop: 24, shadowColor: '#387c9f', shadowOpacity: 0.1, shadowRadius: 5 },
  proSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  reorderGroup: { flexDirection: 'row', gap: 14 },
  reorderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  topIndicatorRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 35 : 40,
    right: 16,
    zIndex: 1000,
  },
  totalContainer: { padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1.5 },
  absoluteBellButton: { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: 18, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  headerRowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingLeft: 40 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerButtonsColumn: { alignItems: 'center' },
  headerLogo: { width: 44, height: 44, marginRight: 10 },
  totalLabel: { fontSize: 18, fontWeight: '700' },
  lastUpdatedText: { fontSize: 10 },
  headerIconButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  prominentEyeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  totalValueContainer: { alignItems: 'center', marginTop: 6, marginBottom: 2 },
  totalValueText: { textAlign: 'center' },
  integerPart: { fontSize: 34, fontWeight: '900', color: '#387c9f' },
  decimalPart: { fontSize: 18, fontWeight: '700', color: '#387c9f' },
  currencySymbol: { fontSize: 18, fontWeight: '700', color: '#387c9f' },
  perfSplitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)', paddingTop: 6 },
  perfSide: { flex: 1, alignItems: 'center' },
  perfSideLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2, color: '#888' },
  perfSideValue: { fontSize: 13, fontWeight: 'bold' },
  netResultContainer: { marginTop: 6, alignItems: 'center' },
  netResultText: { fontSize: 13, fontWeight: 'bold' },
  totalActionButtonsRow: { flexDirection: 'row', marginTop: 8 },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  resetButtonText: { fontSize: 11, fontWeight: '600', color: '#FF9500' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, marginVertical: 4, borderWidth: 1.5 },
  cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  flag: { fontSize: 20, marginRight: 8 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetName: { fontSize: 13, fontWeight: 'bold' },
  assetValueInBase: { fontSize: 13, fontWeight: '700' },
  cardDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  assetBalance: { fontSize: 10 },
  performanceText: { fontSize: 10, fontWeight: 'bold' },
  dateInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  assetDateText: { fontSize: 9 },
  actionButtons: { flexDirection: 'row', marginLeft: 6 },
  actionBtn: { padding: 5 },
  addButton: { backgroundColor: '#387c9f', paddingVertical: 12, borderRadius: 12, alignItems: 'center', position: 'absolute', bottom: 95, left: 12, right: 12, elevation: 5 },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 },
  modalContent: { padding: 16, borderRadius: 16 },
  typeSelectorRow: { flexDirection: 'row', marginBottom: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)' },
  typeTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  confirmButton: { backgroundColor: '#387c9f', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  cancelButton: { textAlign: 'center', marginTop: 12, color: '#FF3B30' },
  pickerWrapper: { marginVertical: 4 },
  pickerButton: { borderWidth: 1, borderRadius: 10, padding: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerModalContent: { height: '65%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalItemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 0.5 },
  modalItemMain: { flex: 1 },
  favoriteButton: { padding: 8 },
  closeBtn: { padding: 14, alignItems: 'center' },
  skeletonCircle: { width: 36, height: 36, borderRadius: 18 },
  skeletonCircleSmall: { width: 24, height: 24, borderRadius: 12 },
  skeletonLineShort: { height: 12, borderRadius: 6, width: '40%' },
  skeletonLineLong: { height: 12, borderRadius: 6, width: '70%' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyLogo: { width: 60, height: 60, marginBottom: 15, opacity: 0.4 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  reportTabsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  reportTabButton: { flex: 1, paddingVertical: 6, marginHorizontal: 2, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  reportTabText: { fontSize: 10, fontWeight: 'bold' },
  reportSummaryCard: { padding: 12, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', marginBottom: 8 },
  reportItemCard: { padding: 12, borderRadius: 14, borderWidth: 1.2, marginVertical: 3 },
});
