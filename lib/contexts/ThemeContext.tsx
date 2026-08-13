import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Appearance, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResolvedSettingsTheme, SettingsTheme } from '@/lib/profile/settings/SettingsService';
import { themeStyleService } from '@/lib/services/ThemeStyleService';

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
  text: string;
  mutedText: string;
  border: string;
  icon: string;
};

const LIGHT_COLORS: AppThemeColors = {
  canvas: '#f8fafc', surface: '#ffffff', elevated: '#ffffff', control: '#f1f5f9',
  text: '#0f172a', mutedText: '#64748b', border: '#e2e8f0', icon: '#475569',
};
const DARK_COLORS: AppThemeColors = {
  canvas: '#020617', surface: '#0f172a', elevated: '#111c31', control: '#1e293b',
  text: '#f8fafc', mutedText: '#a8b3c7', border: '#334155', icon: '#cbd5e1',
};

const getSystemTheme = (): ResolvedSettingsTheme => Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

type ThemeProviderProps = { children: ReactNode };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<SettingsTheme>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedSettingsTheme>(getSystemTheme());
  const [hydrated, setHydrated] = useState(false);

  const resolvedTheme: ResolvedSettingsTheme = theme === 'system' ? systemTheme : theme;

  // Style preprocessors run while native style props are prepared. Keep the
  // service synchronized before descendants render so legacy StyleSheets do
  // not receive the previous system palette for one render and remain stale.
  themeStyleService.setTheme(resolvedTheme);

  useEffect(() => {
    themeStyleService.install();
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedTheme) => {
      const savedTheme: SettingsTheme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
      const currentSystemTheme = getSystemTheme();
      setSystemTheme(currentSystemTheme);
      themeStyleService.setTheme(savedTheme === 'system' ? currentSystemTheme : savedTheme);
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
    themeStyleService.setTheme(nextResolvedTheme);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const isDark = resolvedTheme === 'dark';
  const value = useMemo<ThemeContextValue>(() => ({ theme, isDark, colors: isDark ? DARK_COLORS : LIGHT_COLORS, setTheme }), [isDark, setTheme, theme]);
  if (!hydrated) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#020617' : '#ffffff' }}><ActivityIndicator color="#10b981" /></View>;
  return <ThemeContext.Provider value={value}><View key={resolvedTheme} style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>{children}</View></ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required');
  return context;
}
