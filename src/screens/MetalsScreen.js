import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, Animated,
  TouchableOpacity, ActivityIndicator, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform, useWindowDimensions, SafeAreaView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BaseCurrencyContext } from '../context/BaseCurrencyContext';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { getMetalsData } from '../services/FinalMetalData';
import ConnectionIndicator from '../components/layout/ConnectionIndicator';
import NeoBackground from '../components/layout/NeoBackground';
import { getNeoStyles } from '../styles/NeoStyle';

const PriceText = ({ price, mainSize, subSize, color, weight = '900' }) => {
  if (!price) return <Text style={{ fontSize: mainSize, color }}>0</Text>;
  const parts = Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  return (
    <Text style={{ color }}>
      <Text style={{ fontSize: mainSize, fontWeight: weight }}>{parts[0]}</Text>
      <Text style={{ fontSize: subSize, fontWeight: '700' }}>.{parts[1]}</Text>
    </Text>
  );
};

const MetalsSkeleton = () => {
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
    <View style={{ paddingHorizontal: 16, paddingTop: 60 }}>
       <Animated.View style={{ height: 180, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)', borderRadius: 24, marginBottom: 20, opacity }} />
       <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
         {[1,2,3,4].map(i => (
           <Animated.View key={i} style={{ width: '48%', height: 100, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.6)', borderRadius: 18, marginBottom: 15, opacity }} />
         ))}
       </View>
    </View>
  );
};

export default function MetalsScreen() {
  const { t, i18n } = useTranslation();
  const { baseCurrency } = useContext(BaseCurrencyContext);
  const { isDarkMode } = useContext(SettingsContext);
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const neoStyles = getNeoStyles(colors, isDarkMode);

  const [metalsData, setMetalsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadMetals = useCallback(async (isManual = false) => {
    let isActive = true;
    if (isManual) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // دائماً false، لا forceRefresh لمنع الطلبات المباشرة
      const data = await getMetalsData(baseCurrency, {}, false);
      if (isActive) {
        setMetalsData(data || {});
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (error) {
      console.error('Error loading metals:', error);
    } finally {
      if (isActive) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    return () => { isActive = false; };
  }, [baseCurrency]);

  useEffect(() => {
    const cleanup = loadMetals();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [loadMetals]);

  const shopDollar = metalsData['SHOP_USD']?.price || 0;
  const bankDollar = metalsData['BANK_USD']?.price || 0;
  const priceGap = metalsData['PRICE_GAP']?.price || 0;
  const goldOunceUSD = metalsData['XAU_OUNCE']?.priceUSD || 0;
  const goldOunceBase = metalsData['XAU_OUNCE']?.price || 0;

  const getMarketAdvice = () => {
    const gap = parseFloat(priceGap);
    if (gap <= 5) return { text: t('messages.market_stable'), color: '#10b981', icon: 'checkmark-circle' };
    if (gap <= 15) return { text: t('messages.market_hedge'), color: '#f59e0b', icon: 'alert-circle' };
    return { text: t('messages.market_speculation'), color: '#ef4444', icon: 'warning' };
  };

  const marketAdvice = getMarketAdvice();

  if (loading && Object.keys(metalsData).length === 0) {
    return (
      <NeoBackground>
        <MetalsSkeleton />
      </NeoBackground>
    );
  }

  const isSmallDevice = screenWidth < 375;
  const heroMainSize = isSmallDevice ? 36 : 44;
  const bentoItemWidth = screenWidth > 600 ? '31%' : '48.5%';

  const renderHeader = () => (
    <View style={[neoStyles.floatingBar, { height: 60, paddingVertical: 0, paddingHorizontal: 12, justifyContent: 'flex-start', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: colors.glassBorder, marginBottom: 20 }]}>
      <View style={[styles.headerTitleGroup, { flex: 1, justifyContent: 'flex-start', flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ width: 44, height: 44, marginRight: 8 }}>
          <Image
            source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[neoStyles.mainTitle, { fontSize: 18, fontWeight: '900', textAlign: 'left' }]} numberOfLines={1}>
            {t('metals.title')}
          </Text>
          {lastUpdated ? (
            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.sectionHeader, marginTop: -1, textAlign: 'left' }} numberOfLines={1}>
              {t('converter.last_updated')}: {lastUpdated}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <TouchableOpacity
          style={[styles.headerCircle, { width: 34, height: 34, borderRadius: 17, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' }]}
        >
          <Ionicons name="notifications-outline" size={17} color="#f59e0b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerCircle, { width: 34, height: 34, borderRadius: 17, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => { setRefreshing(true); loadMetals(true); }}
          disabled={refreshing}
        >
          {refreshing ? <ActivityIndicator size="small" color="#f59e0b" /> : <Ionicons name="refresh" size={17} color="#f59e0b" />}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <NeoBackground>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <View style={styles.container}>
        <View style={styles.topIndicatorRow}><ConnectionIndicator /></View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { maxWidth: 800, alignSelf: 'center', width: '100%', paddingHorizontal: 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMetals(true); }} tintColor="#f59e0b" />}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}

          <View style={styles.insightGrid}>
            <View style={[styles.miniInsightCard, { width: '48.5%', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
              <Text style={[styles.miniInsightLabel, { color: colors.sectionHeader }]}>{t('metals.shop_dollar')}</Text>
              <Text style={[styles.miniInsightValue, { color: '#f59e0b' }]}>{shopDollar.toFixed(2)}</Text>
              <Text style={styles.miniInsightUnit}>EGP</Text>
            </View>
            <View style={[styles.miniInsightCard, { width: '48.5%', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
              <Text style={[styles.miniInsightLabel, { color: colors.sectionHeader }]}>{t('rates.base_currency')}</Text>
              <Text style={[styles.miniInsightValue, { color: '#387c9f' }]}>{bankDollar.toFixed(2)}</Text>
              <Text style={styles.miniInsightUnit}>EGP</Text>
            </View>

            <View style={[styles.miniInsightCard, { width: '48.5%', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
              <Text style={[styles.miniInsightLabel, { color: colors.sectionHeader }]}>{t('metals.global_price')}</Text>
              <Text style={[styles.miniInsightValue, { color: '#387c9f' }]}>${goldOunceUSD.toLocaleString()}</Text>
              <Text style={styles.miniInsightUnit}>USD</Text>
            </View>
            <View style={[styles.miniInsightCard, { width: '48.5%', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
              <Text style={[styles.miniInsightLabel, { color: colors.sectionHeader }]}>{t('metals.local_price')}</Text>
              <Text style={[styles.miniInsightValue, { color: '#387c9f' }]}>{Number(goldOunceBase).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              <Text style={styles.miniInsightUnit}>{baseCurrency}</Text>
            </View>

            <View style={[styles.miniInsightCard, { width: '100%', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5, marginTop: 4, paddingVertical: 8 }]}>
              <Text style={[styles.miniInsightLabel, { color: colors.sectionHeader }]}>{t('metals.metals_price_alerts')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <Text style={[styles.miniInsightValue, { color: marketAdvice.color, fontSize: 16 }]}>{priceGap.toFixed(2)}</Text>
                 <Text style={[styles.miniInsightUnit, { marginLeft: 5, fontSize: 8 }]}>EGP / Gram</Text>
              </View>
            </View>
          </View>

          <View style={[styles.adviceBox, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.65)', borderColor: marketAdvice.color, borderWidth: 1.5 }]}>
            <Ionicons name={marketAdvice.icon} size={14} color={marketAdvice.color} style={{ marginRight: 6 }} />
            <Text style={[styles.adviceText, { color: marketAdvice.color }]}>{marketAdvice.text}</Text>
          </View>

          <View style={[styles.heroGoldCard, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 251, 235, 0.85)', borderColor: '#f59e0b', borderWidth: 1.5 }]}>
            <View style={styles.heroHeader}>
               <Text style={[styles.heroTitle, { fontWeight: '800' }]}>{t('metals.gold_21k')} {t('common.active')}</Text>
               <View style={styles.liveIndicator}><View style={styles.dot}/><Text style={styles.liveText}>LIVE</Text></View>
            </View>
            <PriceText price={metalsData['XAU_21']?.price} mainSize={heroMainSize} subSize={heroMainSize * 0.45} color="#b45309" />
            <Text style={[styles.heroCurrency, { fontWeight: '700' }]}>{baseCurrency}</Text>

            <View style={styles.heroActionRow}>
              <View style={styles.actionBox}>
                <Text style={[styles.actionLabel, { fontWeight: '700' }]}>{t('metals.buy_from_shop')}</Text>
                <PriceText price={metalsData['XAU_21']?.price} mainSize={18} subSize={12} color="#b45309" />
              </View>
              <View style={[styles.actionBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(180,83,9,0.1)' }]}>
                <Text style={[styles.actionLabel, { fontWeight: '700' }]}>{t('metals.sell_to_shop')}</Text>
                <PriceText price={metalsData['XAU_21']?.buyPrice} mainSize={18} subSize={12} color="#b45309" />
              </View>
            </View>
          </View>

          <View style={[styles.sectionPlate, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.08)', borderWidth: 1.5, padding: 12, marginBottom: 12 }]}>
            <View style={[styles.plateHeader, { justifyContent: 'center' }]}>
              <Ionicons name="medal-outline" size={14} color="#b45309" style={{ marginRight: 6 }} />
              <Text style={[styles.plateTitle, { color: '#b45309', fontWeight: '800' }]}>{t('portfolio.metals')}</Text>
            </View>
            <View style={styles.bentoGrid}>
              {[
                { key: 'XAU_24', label: t('metals.gold_24k_short', { defaultValue: '24K' }) },
                { key: 'XAU_22', label: t('metals.gold_22k_short', { defaultValue: '22K' }) },
                { key: 'XAU_18', label: t('metals.gold_18k_short', { defaultValue: '18K' }) },
                { key: 'XAU_14', label: t('metals.gold_14k_short', { defaultValue: '14K' }) },
                { key: 'XAU_12', label: t('metals.gold_12k_short', { defaultValue: '12K' }) },
                { key: 'XAU_COIN', label: t('metals.gold_coin') },
              ].map((item) => (
                <View key={item.key} style={[styles.bentoItem, { width: bentoItemWidth, marginBottom: 8, padding: 10, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
                  <Text style={[styles.bentoLabel, { color: colors.text, fontWeight: '800' }]}>{item.label}</Text>
                  <PriceText price={metalsData[item.key]?.price} mainSize={18} subSize={11} color={isDarkMode ? '#f59e0b' : '#b45309'} />
                  <Text style={[styles.bentoCurrency, { fontWeight: '700' }]}>{baseCurrency}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.sectionPlate, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.08)', borderWidth: 1.5, padding: 12, marginBottom: 30 }]}>
            <View style={[styles.plateHeader, { justifyContent: 'center' }]}>
              <Ionicons name="sunny-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={[styles.plateTitle, { color: '#64748b', fontWeight: '800' }]}>{t('metals.silver_grades')}</Text>
            </View>
            <View style={styles.bentoGrid}>
              {[
                { key: 'XAG_999', label: '999' },
                { key: 'XAG_925', label: '925' },
                { key: 'XAG_800', label: '800' },
                { key: 'XAG_GRAM', label: t('metals.silver_gram') },
              ].map((item) => (
                <View key={item.key} style={[styles.bentoItem, { width: bentoItemWidth, marginBottom: 8, padding: 10, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1.5 }]}>
                  <Text style={[styles.bentoLabel, { color: colors.text, fontWeight: '800' }]}>{item.label}</Text>
                  <PriceText price={metalsData[item.key]?.price} mainSize={17} subSize={10} color={isDarkMode ? '#cbd5e1' : '#475569'} />
                  <Text style={[styles.bentoCurrency, { fontWeight: '700' }]}>{baseCurrency}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </NeoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topIndicatorRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 35 : 40,
    right: 16,
    zIndex: 1000,
  },
  scrollContent: { paddingHorizontal: 10, paddingBottom: 110, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  welcomeText: { fontSize: 18, fontWeight: '900' },
  updateText: { fontSize: 10 },
  bellBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.1)', justifyContent: 'center', alignItems: 'center' },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6 },
  miniInsightCard: { width: '48.5%', padding: 6, borderRadius: 12, marginBottom: 6, borderWidth: 1.5, alignItems: 'center' },
  miniInsightLabel: { fontSize: 8, fontWeight: 'bold', marginBottom: 2 },
  miniInsightValue: { fontSize: 13, fontWeight: '900' },
  miniInsightUnit: { fontSize: 7, color: '#888', marginTop: 1 },
  adviceBox: { flexDirection: 'row', alignItems: 'center', padding: 5, marginBottom: 10, borderRadius: 10, justifyContent: 'center', borderWidth: 1.5, borderStyle: 'solid' },
  adviceText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  sectionPlate: { borderRadius: 24, padding: 10, marginBottom: 10 },
  plateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: 0.9 },
  plateTitle: { fontSize: 12 },
  heroGoldCard: { padding: 12, borderRadius: 24, alignItems: 'center', marginBottom: 12 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heroTitle: { fontSize: 11, color: '#b45309' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ef4444', marginRight: 3 },
  liveText: { fontSize: 7, color: '#ef4444', fontWeight: 'bold' },
  heroCurrency: { fontSize: 12, color: '#b45309', marginTop: -1 },
  heroActionRow: { flexDirection: 'row', marginTop: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(180,83,9,0.1)', paddingTop: 6, width: '100%' },
  actionBox: { flex: 1, alignItems: 'center' },
  actionLabel: { fontSize: 8.5, color: '#888', marginBottom: 1 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bentoItem: { borderRadius: 18, padding: 8, marginBottom: 7, alignItems: 'center' },
  bentoLabel: { fontSize: 10, marginBottom: 2 },
  bentoCurrency: { fontSize: 7.5, color: '#888', marginTop: 1 }
});
