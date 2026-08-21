import { StyleSheet, Platform } from 'react-native';

export const getNeoStyles = (colors, isDarkMode) => {
  return StyleSheet.create({
    glassCard: {
      backgroundColor: colors.cardBg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      ...Platform.select({
        ios: {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0,
          shadowRadius: 15,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    neoButton: {
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadowDark,
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 1,
          shadowRadius: 5,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    neoButtonLight: {
      ...Platform.select({
        ios: {
          shadowColor: colors.shadowLight,
          shadowOffset: { width: -3, height: -3 },
          shadowOpacity: 1,
          shadowRadius: 5,
        },
      }),
    },
    neoInput: {
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    floatingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0,
          shadowRadius: 10,
        },
        android: { elevation: 0 },
      }),
    },
    accentGlow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
    }
  });
};
