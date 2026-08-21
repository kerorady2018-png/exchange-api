import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

export default function ConnectionIndicator() {
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected;

  return (
    <View style={[styles.dot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  }
});
