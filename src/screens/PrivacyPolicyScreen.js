import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SettingsContext } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';

const PrivacyPolicyScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { language } = useContext(SettingsContext);
  const { colors } = useTheme();

  const Section = ({ title, content }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionContent, { color: colors.sectionHeader }]}>{content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={[styles.mainTitle, { color: colors.text }]}>
            {t('common.privacy_policy')}
          </Text>
          <Text style={[styles.lastUpdated, { color: colors.sectionHeader }]}>
            {t('common.date')}: 2024-08-11
          </Text>
        </View>

        <Section
          title={language === 'ar' ? '1. جمع البيانات' : '1. Data Collection'}
          content={language === 'ar'
            ? 'نحن نقوم بجمع الاسم ورقم الهاتف والبريد الإلكتروني فقط عند رغبتك في استخدام ميزة المزامنة السحابية لحفظ محفظتك.'
            : 'We collect name, phone number, and email only when you choose to use the cloud sync feature for your portfolio.'}
        />

        <Section
          title={language === 'ar' ? '2. حماية البيانات' : '2. Data Protection'}
          content={language === 'ar'
            ? 'يتم تشفير كافة البيانات الحساسة (مثل الهاتف والبريد) باستخدام تقنيات تشفير متطورة قبل تخزينها على الجهاز أو إرسالها للسيرفر.'
            : 'All sensitive data (like phone and email) is encrypted using advanced encryption technologies before being stored on the device or sent to the server.'}
        />

        <Section
          title={language === 'ar' ? '3. مشاركة البيانات' : '3. Data Sharing'}
          content={language === 'ar'
            ? 'نحن لا نقوم ببيع أو مشاركة بياناتك الخاصة مع أي أطراف ثالثة. بياناتك تستخدم فقط لأغراض المزامنة داخل التطبيق.'
            : 'We do not sell or share your private data with any third parties. Your data is only used for in-app synchronization purposes.'}
        />

        <Section
          title={language === 'ar' ? '4. حقوق المستخدم' : '4. User Rights'}
          content={language === 'ar'
            ? 'يمكنك تعديل أو مسح بياناتك المسجلة في أي وقت من خلال واجهة الإعدادات داخل التطبيق.'
            : 'You can modify or delete your registered data at any time through the app settings interface.'}
        />

        <TouchableOpacity
          style={[styles.contactBtn, { borderColor: colors.border }]}
          onPress={() => Linking.openURL('mailto:privacy@currencyvsau.com')}
        >
          <Ionicons name="mail-outline" size={20} color="#387c9f" />
          <Text style={[styles.contactBtnText, { color: '#387c9f' }]}>
            {language === 'ar' ? 'اتصل بنا بخصوص الخصوصية' : 'Contact us regarding privacy'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 25 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  lastUpdated: { fontSize: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sectionContent: { fontSize: 14, lineHeight: 22 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20
  },
  contactBtnText: { marginLeft: 10, fontWeight: '600' }
});

export default PrivacyPolicyScreen;
