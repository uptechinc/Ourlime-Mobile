import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Home } from 'lucide-react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type EHubNavItemId = 'home' | 'shop' | 'professionals' | 'seller';
type EHubNavItem = { id: EHubNavItemId; label: string; isActive: (pathname: string) => boolean };

/**
 * The website's EHubNavigation pills. "Shop" opens the E-Hub home catalog but lights up on product pages, and
 * "Seller Center" also lights up on the enquiry inbox (the website's /profile/ehub/* pages).
 */
const NAVIGATION_ITEMS: EHubNavItem[] = [
  { id: 'home', label: 'E-Hub Home', isActive: (pathname) => pathname === '/ehub' },
  { id: 'shop', label: 'Shop', isActive: (pathname) => pathname.startsWith('/ehub/products') },
  { id: 'professionals', label: 'Professionals', isActive: (pathname) => pathname.startsWith('/ehub/discover') },
  { id: 'seller', label: 'Seller Center', isActive: (pathname) => pathname.startsWith('/ehub/seller') || pathname.startsWith('/ehub/enquiries') },
];

type EHubSectionNavProps = {
  /** The breadcrumb's last item (the website's currentLabel); no breadcrumb when left out. */
  currentLabel?: string;
  parentLabel?: string;
  onParentPress?: () => void;
};

/** Section pills (and the breadcrumb) shown under the header on every inner E-Hub screen, like the website. */
export default function EHubSectionNav({ currentLabel, parentLabel, onParentPress }: EHubSectionNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleHome = () => router.dismissTo('/ehub' as Href);

  const handlePress = (id: EHubNavItemId) => {
    if (id === 'home') { handleHome(); return; }
    // Goes back to the E-Hub home already in the stack (or opens it) and jumps to its catalog, the website's /ehub#featured-products.
    if (id === 'shop') { router.dismissTo(`/ehub?section=products&jump=${Date.now()}` as Href); return; }
    if (id === 'professionals') {
      if (pathname.startsWith('/ehub/discover')) router.setParams({ kind: 'professional' });
      else router.push('/ehub/discover?kind=professional' as Href);
      return;
    }
    if (!pathname.startsWith('/ehub/seller')) router.push('/ehub/seller' as Href);
  };

  return <View style={styles.container}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pills} accessibilityLabel="E-Hub sections">
      {NAVIGATION_ITEMS.map((item) => {
        const isActive = item.isActive(pathname);
        return <TouchableOpacity key={item.id} accessibilityRole="link" accessibilityState={{ selected: isActive }} activeOpacity={0.7} onPress={() => handlePress(item.id)} style={[styles.pill, isActive ? styles.pillActive : null]}>
          <Text style={[styles.pillText, isActive ? styles.pillTextActive : null]}>{item.label}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>
    {currentLabel ? <View accessibilityLabel="Breadcrumb" style={styles.breadcrumb}>
      <TouchableOpacity accessibilityRole="link" activeOpacity={0.7} onPress={handleHome} hitSlop={6} style={styles.crumbLink}>
        <Home size={13} color={colors.mutedText} /><Text style={styles.crumbText}>E-Hub</Text>
      </TouchableOpacity>
      {parentLabel && onParentPress ? <>
        <ChevronRight size={13} color={colors.mutedText} />
        <TouchableOpacity accessibilityRole="link" activeOpacity={0.7} onPress={onParentPress} hitSlop={6}><Text style={styles.crumbText}>{parentLabel}</Text></TouchableOpacity>
      </> : null}
      <ChevronRight size={13} color={colors.mutedText} />
      <Text numberOfLines={1} style={styles.crumbCurrent}>{currentLabel}</Text>
    </View> : null}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  pills: { paddingHorizontal: 12, paddingVertical: 7, gap: 4 },
  pill: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 11 },
  pillActive: { backgroundColor: colors.successSurface },
  pillText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  pillTextActive: { color: colors.successText },
  breadcrumb: { minHeight: 30, paddingHorizontal: 14, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  crumbLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumbText: { color: colors.mutedText, fontSize: 12 },
  crumbCurrent: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
});
