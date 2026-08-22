import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const HelpCenterScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const HelpItem = ({ icon, title, description, onPress, color = "#387c9f" }) => (
    <TouchableOpacity
      style={[styles.helpItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.helpTextContainer}>
        <Text style={[styles.helpTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.helpDesc, { color: colors.sectionHeader }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.sectionHeader} />
    </TouchableOpacity>
  );

  const openWhatsApp = () => {
    Linking.openURL('https://wa.me/+201281794762');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={[styles.mainTitle, { color: colors.text }]}>
            {t('common.help_center')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.sectionHeader }]}>
            {t('common.support_help')}
          </Text>
        </View>

        <HelpItem
          icon="logo-whatsapp"
          title={t('common.whatsapp_support')}
          description={t('settings.contact_whatsapp')}
          onPress={openWhatsApp}
          color="#25D366"
        />

        <HelpItem
          icon="mail-outline"
          title={t('common.email')}
          description="support@currencyvsau.com"
          onPress={() => Linking.openURL('mailto:support@currencyvsau.com')}
        />

        <View style={styles.faqSection}>
          <Text style={[styles.faqTitle, { color: colors.text }]}>
            {t('common.guide_title')}
          </Text>

          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={styles.faqItem}>
              <Text style={[styles.faqQuestion, { color: colors.text }]}>{t(`common.guide_${i}`)}</Text>
              <Text style={[styles.faqAnswer, { color: colors.sectionHeader }]}>{t(`common.guide_${i}_desc`)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 30 },
  mainTitle: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 5 },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  iconCircle: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  helpTextContainer: { flex: 1, marginLeft: 15 },
  helpTitle: { fontSize: 16, fontWeight: 'bold' },
  helpDesc: { fontSize: 12, marginTop: 2 },
  faqSection: { marginTop: 25 },
  faqTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  faqItem: { marginBottom: 20 },
  faqQuestion: { fontSize: 15, fontWeight: 'bold', marginBottom: 5 },
  faqAnswer: { fontSize: 13, lineHeight: 20 }
});

export default HelpCenterScreen;
