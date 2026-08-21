import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';

const { width, height } = Dimensions.get('window');

const NeoBackground = ({ children }) => {
  const { isDarkMode, colors } = useTheme();

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
