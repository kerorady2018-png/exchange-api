import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import NeoBackground from '../components/layout/NeoBackground';
import { getNeoStyles } from '../styles/NeoStyle';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const { t } = useTranslation();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const neoStyles = getNeoStyles(colors, isDarkMode);

  const navigateTo = (screenName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate(screenName);
  };

  const MenuTile = ({ title, icon, color, onPress, isWide = false }) => (
    <TouchableOpacity
      style={[
        styles.tile,
        neoStyles.glassCard,
        {
          width: isWide ? width - 32 : (width / 2) - 24,
          height: isWide ? 110 : 150,
          marginBottom: 20,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconCircle, { backgroundColor: color + (isDarkMode ? '30' : '15') }, neoStyles.accentGlow]}>
        <Ionicons name={icon} size={isWide ? 30 : 36} color={color} />
      </View>
      <View style={isWide ? styles.wideTextContainer : styles.normalTextContainer}>
        <Text style={[styles.tileTitle, { color: colors.text }]}>
          {title}
        </Text>
        {isWide && (
          <Text style={[styles.tileSubtitle, { color: colors.sectionHeader }]}>
            {t('tabs.converter_desc', { defaultValue: 'تحويل سريع ودقيق' })}
          </Text>
        )}
      </View>
      {isWide && (
        <View style={[styles.chevronContainer, { backgroundColor: colors.border }]}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <NeoBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.welcomeText, { color: colors.sectionHeader }]}>
              {t('app_subtitle')}
            </Text>
            <Text style={[styles.mainTitle, { color: colors.text }]}>
              {t('common.home')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingsBtn, neoStyles.glassCard]}
            onPress={() => navigateTo('Settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <MenuTile
            title={t('tabs.converter')}
            icon="swap-horizontal"
            color="#007AFF"
            isWide={true}
            onPress={() => navigateTo('Converter')}
          />

          <View style={styles.grid}>
            <MenuTile
              title={t('tabs.rates')}
              icon="stats-chart"
              color="#34C759"
              onPress={() => navigateTo('Rates')}
            />
            <MenuTile
              title={t('tabs.metals')}
              icon="diamond"
              color="#FF9500"
              onPress={() => navigateTo('Metals')}
            />
            <MenuTile
              title={t('tabs.portfolio')}
              icon="wallet"
              color="#AF52DE"
              onPress={() => navigateTo('Portfolio')}
            />
            <MenuTile
              title={t('common.privacy_policy')}
              icon="shield-checkmark"
              color="#5856D6"
              onPress={() => navigateTo('PrivacyPolicy')}
            />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.sectionHeader }]}>
              © 2024 {t('app_subtitle')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </NeoBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTextContainer: { flex: 1 },
  welcomeText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  settingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  normalTextContainer: {
    alignItems: 'center',
  },
  wideTextContainer: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  tileTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  chevronContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: { marginTop: 30, marginBottom: 20, alignItems: 'center' },
  footerText: { fontSize: 12, fontWeight: '500', opacity: 0.5 }
});

export default HomeScreen;
