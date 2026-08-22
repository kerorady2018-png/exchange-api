import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { SettingsContext } from '../context/SettingsContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const GlassTabBar = ({ state, descriptors, navigation }) => {
  const { isDarkMode } = useContext(SettingsContext);
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  const BAR_HEIGHT = 50;
  const BAR_WIDTH = Math.min(width - 32, 500);
  const TAB_WIDTH = BAR_WIDTH / state.routes.length;
  const CIRCLE_SIZE = 44;
  const DIP_DEPTH = 25;
  const CORNER_RADIUS = 26;

  const animatedValue = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: state.index,
      useNativeDriver: false,
      friction: 10,
      tension: 40
    }).start();
  }, [state.index]);

  const translateX = animatedValue.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * TAB_WIDTH)
  });

  const getIconName = (name) => {
    switch (name) {
      case 'Converter': return 'swap-horizontal';
      case 'Rates': return 'stats-chart';
      case 'Metals': return 'diamond';
      case 'Portfolio': return 'wallet';
      case 'Settings': return 'settings';
      default: return 'ellipse';
    }
  };

  const createPath = (idx) => {
    const center = idx * TAB_WIDTH + TAB_WIDTH / 2;
    const cw = 40;
    const r = CORNER_RADIUS;
    const w = BAR_WIDTH;
    const h = BAR_HEIGHT;
    const d = DIP_DEPTH;

    const p1x = Math.max(r, center - cw);
    const p2x = Math.max(r, center - 16);
    const p3x = Math.min(w - r, center + 16);
    const p4x = Math.min(w - r, center + cw);

    return `
      M 0 ${r}
      Q 0 0 ${r} 0
      L ${p1x} 0
      C ${p2x} 0 ${center - 12} ${d} ${center} ${d}
      C ${center + 12} ${d} ${p3x} 0 ${p4x} 0
      L ${w - r} 0
      Q ${w} 0 ${w} ${r}
      L ${w} ${h - r}
      Q ${w} ${h} ${w - r} ${h}
      L ${r} ${h}
      Q 0 ${h} 0 ${h - r}
      Z
    `;
  };

  const animatedPath = animatedValue.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => createPath(i))
  });

  return (
    <View style={styles.glassContainer}>
      <View style={[styles.glassBarWrapper, { width: BAR_WIDTH, height: BAR_HEIGHT }]}>
        <Svg width={BAR_WIDTH} height={BAR_HEIGHT + 30} style={{ position: 'absolute', top: 0 }}>
          <AnimatedPath
            d={animatedPath}
            fill={isDarkMode ? 'rgba(25, 30, 35, 0.98)' : 'rgba(255, 255, 255, 0.96)'}
            stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
            strokeWidth="1"
          />
        </Svg>

        <View style={styles.iconsRow}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const iconName = getIconName(route.name);

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  if (!isFocused) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate(route.name);
                  }
                }}
                activeOpacity={1}
                style={[styles.glassTabItem, { width: TAB_WIDTH }]}
              >
                {!isFocused && (
                  <Ionicons
                    name={`${iconName}-outline`}
                    size={22}
                    color={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  />
                )}
                <Text style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? (isDarkMode ? '#FFFFFF' : '#387c9f') : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
                    marginTop: isFocused ? 26 : 4
                  }
                ]}>
                  {t(`tabs.${route.name.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Animated.View style={[
          styles.floatingCircle,
          {
            left: translateX,
            width: TAB_WIDTH,
            transform: [{ translateY: -CIRCLE_SIZE / 2 + 3 }]
          }
        ]}>
          <View style={[styles.circleInner, {
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            backgroundColor: isDarkMode ? '#387c9f' : '#FFFFFF',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)',
            borderWidth: 1.5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }]}>
             <Ionicons
                name={getIconName(state.routes[state.index].name)}
                size={22}
                color={isDarkMode ? '#FFFFFF' : '#387c9f'}
             />
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

export default GlassTabBar;

const styles = StyleSheet.create({
  glassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    alignItems: 'center',
    zIndex: 999,
  },
  glassBarWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  floatingCircle: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  circleInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconsRow: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    zIndex: 20,
    position: 'absolute',
    bottom: 0,
  },
  glassTabItem: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.2,
  }
});
