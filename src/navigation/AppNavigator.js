import React, { useContext } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { SettingsContext } from '../context/SettingsContext';
import GlassTabBar from './GlassTabBar';
import NetworkStatus from '../components/layout/NetworkStatus';

// Screens
import RatesScreen from '../screens/RatesScreen';
import ConverterScreen from '../screens/ConverterScreen';
import MetalsScreen from '../screens/MetalsScreen';
import PortfolioScreen from '../screens/PortfolioScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

const Tab = createMaterialTopTabNavigator();
const Stack = createStackNavigator();

const MainTabs = () => {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      initialRouteName="Rates"
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={{ swipeEnabled: true, lazy: true }}
    >
      <Tab.Screen
        name="Converter"
        component={ConverterScreen}
        options={{ tabBarLabel: t('tabs.converter', { defaultValue: 'المحول' }) }}
      />
      <Tab.Screen
        name="Rates"
        component={RatesScreen}
        options={{ tabBarLabel: t('tabs.rates', { defaultValue: 'العملات' }) }}
      />
      <Tab.Screen
        name="Metals"
        component={MetalsScreen}
        options={{ tabBarLabel: t('tabs.metals', { defaultValue: 'المعادن' }) }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ tabBarLabel: t('tabs.portfolio', { defaultValue: 'المحفظة' }) }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('tabs.settings', { defaultValue: 'الضبط' }) }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isDarkMode, language } = useContext(SettingsContext);
  const navTheme = isDarkMode ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer key={language} theme={navTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#121212' : '#FFFFFF'}
        translucent={false}
      />
      <NetworkStatus />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{
            headerShown: true,
            headerTitle: language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy',
            headerStyle: { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' },
            headerTintColor: isDarkMode ? '#FFFFFF' : '#000000',
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
