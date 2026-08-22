import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

const CustomPicker = ({ selectedValue, onValueChange, items, label, placeholder }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const selectedItem = useMemo(() => 
    items.find(i => i.value === selectedValue), 
    [items, selectedValue]
  );

  return (
    <View style={styles.pickerWrapper}>
      <TouchableOpacity
        style={[styles.pickerButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {selectedItem ? selectedItem.label : placeholder || label}
        </Text>
      </TouchableOpacity>
      
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.item, { borderBottomColor: colors.border }]}
                  onPress={() => { onValueChange(item.value); setModalVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
              <Text style={{ color: '#387c9f', fontSize: 16, fontWeight: 'bold' }}>{t('Close') || 'إغلاق'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerWrapper: { marginVertical: 5, width: 160 },
  pickerButton: { borderWidth: 1, borderRadius: 10, padding: 10 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { height: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  item: { padding: 15, borderBottomWidth: 1 },
  closeBtn: { padding: 20, alignItems: 'center' },
});

export default CustomPicker;
