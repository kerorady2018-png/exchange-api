import './i18n';
console.log('--- QIRSH APP LOADING NEW ARCHITECTURE ---');
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BaseCurrencyProvider } from './context/BaseCurrencyContext';
import { SettingsProvider } from './context/SettingsContext';
import { RatesProvider } from './context/RatesContext';

import AuthService from './services/authService';
import NetworkService from './utils/networkService';
import OnboardingScreen from './screens/OnboardingScreen';
import AppNavigator from './navigation/AppNavigator';

const RootNavigator = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkOnboarding = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('@onboarding_completed');
        if (isMounted) {
          if (!onboardingCompleted) setShowOnboarding(true);
          setIsReady(true);
        }
      } catch (e) {
        if (isMounted) setIsReady(true);
      }
    };
    checkOnboarding();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleNetworkChange = (online) => {
      if (online) {
        AuthService.processSyncQueue();
      }
    };
    NetworkService.addListener(handleNetworkChange);
    return () => NetworkService.removeListener(handleNetworkChange);
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: '#FFFFFF' }]}>
        <Image source={require('./assets/logo-colored.png')} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="small" color="#387c9f" style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (showOnboarding) return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  return <AppNavigator />;
};

export default function App() {
  return (
    <BaseCurrencyProvider>
      <SettingsProvider>
        <RatesProvider>
          <RootNavigator />
        </RatesProvider>
      </SettingsProvider>
    </BaseCurrencyProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: 120, height: 120 },
});
