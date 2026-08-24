import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

const MultiSelectPicker = ({ selectedValues, onSave, items, placeholder, type = 'checkbox' }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelected, setTempSelected] = useState(selectedValues || []);
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    setTempSelected(selectedValues || []);
  }, [selectedValues, modalVisible]);

  const toggleSelect = useCallback((value) => {
    setTempSelected(prev =>
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  }, []);

  const getIcon = (isSelected) => {
    if (type === 'bell') {
      return isSelected ? '🔔' : '🔕';
    }
    return isSelected ? '☑️' : '☐';
  };

  return (
    <View style={styles.pickerWrapperFull}>
      <TouchableOpacity
        style={[styles.pickerButtonFull, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {type === 'bell' ? '🔔 ' : ''}{placeholder} ({tempSelected.length} {t('Selected') || 'محدد'})
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{placeholder}</Text>

            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = tempSelected.includes(item.value);
                return (
                  <TouchableOpacity
                    style={[
                      styles.item,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: isDarkMode ? '#1a2530' : '#F0F7FF' }
                    ]}
                    onPress={() => toggleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{item.label}</Text>
                    <Text style={{ fontSize: 18, color: isSelected ? '#387c9f' : colors.sectionHeader }}>
                      {getIcon(isSelected)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: '#387c9f' }]}
                onPress={() => {
                  onSave(tempSelected);
                  setModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{t('Done') || 'تم'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold' }}>{t('Cancel') || 'إغلاق'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerWrapperFull: { marginVertical: 8 },
  pickerButtonFull: { borderWidth: 1, borderRadius: 12, padding: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10 },
  doneBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: 'center', marginRight: 10 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'red' },
});

export default MultiSelectPicker;
