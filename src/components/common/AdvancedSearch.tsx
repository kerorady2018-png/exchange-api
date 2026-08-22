import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { currencyInfo } from '../../constants/currencyData';

const AdvancedSearch = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [filteredCurrencies, setFilteredCurrencies] = useState([]);

  const BRAND_COLOR = '#387c9f';

  const regions = [
    { id: 'all', name: t('common.all_regions', { defaultValue: 'All Regions' }) },
    { id: 'africa', name: t('regions.africa', { defaultValue: 'Africa' }) },
    { id: 'asia', name: t('regions.asia', { defaultValue: 'Asia' }) },
    { id: 'europe', name: t('regions.europe', { defaultValue: 'Europe' }) },
    { id: 'americas', name: t('regions.americas', { defaultValue: 'Americas' }) },
    { id: 'oceania', name: t('regions.oceania', { defaultValue: 'Oceania' }) },
  ];

  const currencyRegions = {
    'africa': ['EGP', 'ZAR', 'NGN', 'KES', 'GHS'],
    'asia': ['JPY', 'CNY', 'INR', 'KRW', 'SGD', 'MYR', 'THB', 'IDR', 'PHP'],
    'europe': ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF'],
    'americas': ['USD', 'CAD', 'MXN', 'BRL', 'ARS', 'CLP', 'COP'],
    'oceania': ['AUD', 'NZD'],
  };

  const filterCurrencies = useCallback(() => {
    let currencies = Object.keys(currencyInfo);

    // تصفية حسب المنطقة - تم إصلاح منطق البحث
    if (selectedRegion !== 'all') {
      const regionCodes = currencyRegions[selectedRegion.toLowerCase()];
      if (regionCodes) {
        currencies = currencies.filter(code => regionCodes.includes(code.toUpperCase()));
      }
    }

    // تصفية حسب البحث
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      currencies = currencies.filter(code => {
        const info = currencyInfo[code];
        return (
          code.toLowerCase().includes(query) ||
          info?.name?.toLowerCase().includes(query) ||
          info?.nameAr?.includes(query)
        );
      });
    }

    setFilteredCurrencies(currencies);
  }, [searchQuery, selectedRegion]);

  useEffect(() => {
    filterCurrencies();
  }, [filterCurrencies]);

  const handleSelect = (currency) => {
    onSelect(currency);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('common.advanced_search', { defaultValue: 'Advanced Search' })}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="search" size={20} color={BRAND_COLOR} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('common.search_placeholder', { defaultValue: 'Search currencies...' })}
              placeholderTextColor={colors.sectionHeader}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.regionFilter}>
            <FlatList
              horizontal
              data={regions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedRegion(item.id)}
                  style={[
                    styles.regionChip,
                    selectedRegion === item.id
                      ? { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR }
                      : { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.regionText,
                      selectedRegion === item.id ? { color: '#fff' } : { color: colors.text },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>

          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const info = currencyInfo[item];
              return (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  style={[styles.currencyItem, { borderBottomColor: colors.border }]}
                >
                  <Text style={styles.flag}>{info?.flag || '🌐'}</Text>
                  <View style={styles.currencyInfo}>
                    <Text style={[styles.currencyCode, { color: colors.text }]}>{item}</Text>
                    <Text style={[styles.currencyName, { color: colors.sectionHeader }]}>
                      {info?.name || item}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.sectionHeader} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={50} color={colors.sectionHeader} />
                <Text style={[styles.emptyText, { color: colors.sectionHeader }]}>
                  {t('common.no_results', { defaultValue: 'No currencies found' })}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  regionFilter: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  regionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  regionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  flag: {
    fontSize: 32,
    marginRight: 16,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  currencyName: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});

export default AdvancedSearch;
