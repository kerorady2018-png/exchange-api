import React from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';

const { width, height } = Dimensions.get('window');

const NeoBackground = ({ children, variant = 'default', blurIntensity }) => {
  const { isDarkMode, colors } = useTheme();

  if (variant === 'vertical') {
    const gradientColors = isDarkMode
      ? ['#0B3B4F', '#155E75', '#1E293B', '#0F172A']
      : ['#2F6F8F', '#4C8FAE', '#A9CBDB', '#F2F6F9'];
    const intensity = blurIntensity ?? (isDarkMode ? 40 : 30);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.3, 0.62, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          intensity={intensity}
          tint={isDarkMode ? 'dark' : 'light'}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDarkMode
          ? ['#0F172A', '#1E293B', '#0F172A']
          : ['#F0F4F8', '#E2E8F0', '#F0F4F8']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Glows */}
      <View style={[
        styles.glow,
        {
          top: -100,
          right: -100,
          backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE',
          opacity: isDarkMode ? 0.3 : 0.5
        }
      ]} />

      <View style={[
        styles.glow,
        {
          bottom: -150,
          left: -150,
          backgroundColor: isDarkMode ? '#312E81' : '#E0E7FF',
          opacity: isDarkMode ? 0.2 : 0.4
        }
      ]} />

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  }
});

export default NeoBackground;
