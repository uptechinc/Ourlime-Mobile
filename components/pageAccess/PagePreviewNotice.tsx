import { useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { pageAccessService } from '@/lib/services/PageAccessService';
import { getPageAccessBadgeText } from '@/lib/pageAccess/PageRegistry';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/**
 * Same as the website's preview pill: admins, testers and developers can open pages that are switched off
 * for everyone else, so this reminds them the page isn't public. × hides it for that page until the app restarts.
 */
export default function PagePreviewNotice() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { getDecision, loading } = usePageAccess();
  const [dismissedRoutes, setDismissedRoutes] = useState<string[]>([]);
  const route = useMemo(() => pageAccessService.normalizeRoute(pathname || '/'), [pathname]);
  const decision = getDecision(route);

  const isPreviewingHiddenPage = !loading
    && decision.canAccess
    && decision.status !== 'enabled'
    && !pageAccessService.isPublicRoute(route);
  if (!isPreviewingHiddenPage || dismissedRoutes.includes(route)) return null;

  const handleDismiss = (): void => {
    setDismissedRoutes((routes) => [...routes, route]);
  };

  return (
    <View
      pointerEvents="box-none"
      // Above the tab bar (and above where toasts appear) so it never covers page titles or headers.
      style={{ position: 'absolute', bottom: 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20) + 72, left: 0, right: 0, alignItems: 'center', zIndex: 9990, elevation: 9990 }}
    >
      <View
        accessibilityRole="text"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          maxWidth: '92%',
          paddingLeft: 10,
          paddingRight: 4,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(251,191,36,0.3)' : 'rgba(252,211,77,0.7)',
          backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.96)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Ionicons name="construct-outline" size={14} color="#f59e0b" />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, fontWeight: '700', color: colors.secondaryText }}>
          Preview: {decision.setting?.pageName || 'Ourlime'}
        </Text>
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: isDark ? 'rgba(244,63,94,0.15)' : '#fff1f2' }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#e11d48' }}>
            {decision.setting?.badgeText || getPageAccessBadgeText(decision.status)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Hide preview notice"
          hitSlop={8}
          style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={14} color={colors.mutedText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
