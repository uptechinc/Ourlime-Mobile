import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const TOAST_VISIBLE_MS = 3000;

/** App-wide toast host (sonner-native): sits just above the tab bar, hides after 3 s, swipe left to dismiss. */
const AppToastHost = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  // Mirrors the tab bar height in app/(tabs)/_layout.tsx so toasts never cover it.
  const tabBarHeight = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);
  return (
    <Toaster
      position="bottom-center"
      offset={tabBarHeight + 12}
      duration={TOAST_VISIBLE_MS}
      swipeToDismissDirection="left"
      theme={isDark ? 'dark' : 'light'}
      visibleToasts={3}
      toastOptions={{
        style: {
          backgroundColor: colors.elevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
        },
        titleStyle: { color: colors.text, fontWeight: '700' },
        descriptionStyle: { color: colors.mutedText },
        success: { borderColor: '#10b981' },
        error: { borderColor: '#c64d53' },
      }}
    />
  );
};

export default AppToastHost;
