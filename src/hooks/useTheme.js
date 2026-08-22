import { useContext, useMemo } from 'react';
import { SettingsContext } from '../context/SettingsContext';

export const useTheme = () => {
  const { isDarkMode } = useContext(SettingsContext);

  const colors = useMemo(() => ({
    background: isDarkMode ? '#0F131A' : '#F2F4F7',
    text: isDarkMode ? '#F8FAFC' : '#111827',
    sectionHeader: isDarkMode ? '#64748B' : '#6B7280',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    cardBg: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.4)',
    glassBorder: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.5)',
    accent: '#387c9f',
    activeBlue: '#387c9f',
    activeGlow: 'rgba(0, 242, 255, 0.3)',
    insetBg: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    shadowLight: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 1)',
    shadowDark: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(100, 116, 139, 0.2)',
    cyanGlow: '#387c9f',
  }), [isDarkMode]);

  return { isDarkMode, colors };
};
