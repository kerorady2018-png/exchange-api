import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BaseCurrencyContext } from '../../context/BaseCurrencyContext';
import { currencyInfo } from '../../constants/currencyData';
import { useTheme } from '../../hooks/useTheme';

export default function BaseCurrencySelector() {
  const { t } = useTranslation();
  const { baseCurrency, changeBaseCurrency } = useContext(BaseCurrencyContext);
  const [modalVisible, setModalVisible] = useState(false);
  const { colors, isDarkMode } = useTheme();

  const handleSelect = (code) => {
    if (changeBaseCurrency) {
      changeBaseCurrency(code);
    }
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.text, { color: colors.text }]}>
          {currencyInfo[baseCurrency]?.flag} {t('Base Currency')}: {baseCurrency}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('Select Base Currency') || 'اختر العملة الأساسية'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.keys(currencyInfo)}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => {
                const isSelected = item === baseCurrency;
                return (
                  <TouchableOpacity
                    style={[
                      styles.currencyItem,
                      {
                        backgroundColor: isSelected
                          ? (isDarkMode ? '#1a2530' : '#F0F7FF')
                          : colors.cardBg,
                        borderColor: isSelected ? '#387c9f' : colors.border,
                      }
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.flag}>{currencyInfo[item]?.flag || '🌐'}</Text>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.currencyCode, { color: colors.text }]}>
                        {item}
                      </Text>
                      <Text style={[styles.currencyName, { color: colors.text, opacity: 0.7 }]} numberOfLines={1}>
                        {t(`currencies.${item}`, { defaultValue: currencyInfo[item]?.name || '' })}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#387c9f" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15 },
  button: { padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  text: { fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
  },
  flag: { fontSize: 24, marginRight: 10 },
  currencyCode: { fontSize: 16, fontWeight: 'bold' },
  currencyName: { fontSize: 12, marginTop: 2 },
});
