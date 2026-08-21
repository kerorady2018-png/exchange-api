import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetworkService from '../../utils/networkService';
import { useTheme } from '../../hooks/useTheme';

const NetworkStatus = () => {
  const { colors } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const handleNetworkChange = (online) => {
      setIsOnline(online);
      
      if (!online) {
        setIsVisible(true);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setIsVisible(false));
      }
    };

    NetworkService.addListener(handleNetworkChange);

    return () => {
      NetworkService.removeListener(handleNetworkChange);
    };
  }, [slideAnim]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isOnline ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)',
          transform: [{ translateY: slideAnim }],
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
        },
      ]}
    >
      <Ionicons
        name={isOnline ? 'wifi' : 'wifi-outline'}
        size={16}
        color="#fff"
        style={styles.icon}
      />
      <Text style={styles.text}>
        {isOnline ? 'متصل' : 'أوفلاين - يعمل ببيانات مخزنة'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Floating below status bar
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default NetworkStatus;
