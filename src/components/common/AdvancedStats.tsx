import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const AdvancedStats = ({ assets, currencyRates, metalRates, baseCurrency }) => {
  const { i18n } = useTranslation();
  const { colors } = useTheme;

  const calculateAssetDistribution = () => {
    const distribution = {};
    let totalValue = 0;

    assets.forEach(asset => {
      const rate = getAssetRate(asset);
      const value = asset.amount * rate;
      const type = asset.currency.startsWith('XAU') || asset.currency.startsWith('XAG') ? 'metals' : 'currencies';
      
      distribution[type] = (distribution[type] || 0) + value;
      totalValue += value;
    });

    const data = Object.keys(distribution).map((key, index) => ({
      name: key === 'metals' ? (i18n.language === 'ar' ? 'المعادن' : 'Metals') : (i18n.language === 'ar' ? 'العملات' : 'Currencies'),
      population: distribution[key],
      color: index === 0 ? '#FFD700' : '#007AFF',
      legendFontColor: colors.text,
      legendFontSize: 12,
    }));

    return { data, totalValue };
  };

  const getAssetRate = (asset) => {
    // Simplified rate calculation
    return currencyRates[asset.currency] || metalRates[asset.currency] || 1;
  };

  const { data, totalValue } = calculateAssetDistribution();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {i18n.language === 'ar' ? 'توزيع الأصول' : 'Asset Distribution'}
        </Text>
        <PieChart
          data={data}
          width={width - 64}
          height={220}
          chartConfig={{
            backgroundColor: colors.cardBg,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {i18n.language === 'ar' ? 'إجمالي القيمة' : 'Total Value'}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {totalValue.toFixed(2)} {baseCurrency}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {i18n.language === 'ar' ? 'عدد الأصول' : 'Total Assets'}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>{assets.length}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default AdvancedStats;
