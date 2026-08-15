import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Appearance, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResolvedSettingsTheme, SettingsTheme } from '@/lib/profile/settings/SettingsService';

const THEME_STORAGE_KEY = 'ourlime:color-theme';

type ThemeContextValue = {
  theme: SettingsTheme;
  isDark: boolean;
  colors: AppThemeColors;
  setTheme: (theme: SettingsTheme) => Promise<void>;
};

export type AppThemeColors = {
  canvas: string;
  surface: string;
  elevated: string;
  control: string;
  input: string;
  text: string;
  secondaryText: string;
  mutedText: string;
  border: string;
  icon: string;
  accent: string;
  accentText: string;
  onAccent: string;
  selectedControl: string;
  selectedText: string;
  destructive: string;
  destructiveSurface: string;
  destructiveText: string;
  disabled: string;
  disabledText: string;
  modalScrim: string;
  navigation: string;
  navigationBorder: string;
  warningSurface: string;
  warningText: string;
  successSurface: string;
  successText: string;
};

const LIGHT_COLORS: AppThemeColors = {
  canvas: '#f8fafc', surface: '#ffffff', elevated: '#ffffff', control: '#f1f5f9', input: '#f8fafc',
  text: '#0f172a', secondaryText: '#334155', mutedText: '#64748b', border: '#e2e8f0', icon: '#475569',
  accent: '#10b981', accentText: '#047857', onAccent: '#ffffff', selectedControl: '#10b981', selectedText: '#ffffff',
  destructive: '#dc2626', destructiveSurface: '#fef2f2', destructiveText: '#b91c1c', disabled: '#e2e8f0', disabledText: '#94a3b8',
  modalScrim: 'rgba(15,23,42,0.55)', navigation: '#ffffff', navigationBorder: '#e2e8f0',
  warningSurface: '#fffbeb', warningText: '#92400e', successSurface: '#ecfdf5', successText: '#047857',
};
const DARK_COLORS: AppThemeColors = {
  canvas: '#020617', surface: '#0f172a', elevated: '#111c31', control: '#1e293b', input: '#0f172a',
  text: '#f8fafc', secondaryText: '#e2e8f0', mutedText: '#a8b3c7', border: '#334155', icon: '#cbd5e1',
  accent: '#10b981', accentText: '#34d399', onAccent: '#ffffff', selectedControl: '#10b981', selectedText: '#ffffff',
  destructive: '#ef4444', destructiveSurface: '#3f161d', destructiveText: '#fca5a5', disabled: '#1e293b', disabledText: '#64748b',
  modalScrim: 'rgba(0,0,0,0.78)', navigation: '#0f172a', navigationBorder: '#334155',
  warningSurface: '#3b2f10', warningText: '#fcd34d', successSurface: '#053b31', successText: '#6ee7b7',
};

const getSystemTheme = (): ResolvedSettingsTheme => Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

type ThemeProviderProps = { children: ReactNode };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<SettingsTheme>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedSettingsTheme>(getSystemTheme());
  const [hydrated, setHydrated] = useState(false);

  const resolvedTheme: ResolvedSettingsTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedTheme) => {
      const savedTheme: SettingsTheme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
      const currentSystemTheme = getSystemTheme();
      setSystemTheme(currentSystemTheme);
      setThemeState(savedTheme);
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  const setTheme = useCallback(async (nextTheme: SettingsTheme) => {
    setThemeState(nextTheme);
    const nextResolvedTheme: ResolvedSettingsTheme = nextTheme === 'system' ? getSystemTheme() : nextTheme;
    if (nextTheme === 'system') setSystemTheme(nextResolvedTheme);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const value = useMemo<ThemeContextValue>(() => ({ theme, isDark, colors, setTheme }), [colors, isDark, setTheme, theme]);
  if (!hydrated) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#020617' : '#ffffff' }}><ActivityIndicator color="#10b981" /></View>;
  return <ThemeContext.Provider value={value}><View style={{ flex: 1, backgroundColor: colors.canvas }}>{children}</View></ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required');
  return context;
}
