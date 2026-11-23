import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { BriefcaseBusiness, ChevronRight, Home, Inbox, ShoppingBag, Store, TrendingUp } from 'lucide-react-native';
import { useLocalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { EHubScrollView } from '@/components/ehub/EHubScrollView';

type EHubNavItemId = 'shop' | 'professionals' | 'storefronts' | 'enquiries' | 'sell';
type EHubNavItem = { id: EHubNavItemId; label: string; icon: typeof ShoppingBag; isActive: (pathname: string, kind: string) => boolean };

/**
 * One section bar for every E-Hub screen, the home included. Shop is the home catalog (and product pages);
 * Professionals and Storefronts are Discover filtered by kind; My enquiries is the sent/received inbox; Sell is
 * Seller Center.
 */
const NAVIGATION_ITEMS: EHubNavItem[] = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag, isActive: (pathname) => pathname === '/ehub' || pathname.startsWith('/ehub/products') },
  { id: 'professionals', label: 'Professionals', icon: BriefcaseBusiness, isActive: (pathname, kind) => pathname.startsWith('/ehub/discover') && kind === 'professional' },
  { id: 'storefronts', label: 'Storefronts', icon: Store, isActive: (pathname, kind) => pathname.startsWith('/ehub/discover') && kind === 'business' },
  { id: 'enquiries', label: 'My enquiries', icon: Inbox, isActive: (pathname) => pathname.startsWith('/ehub/enquiries') },
  { id: 'sell', label: 'Sell', icon: TrendingUp, isActive: (pathname) => pathname.startsWith('/ehub/seller') || pathname.startsWith('/ehub/business-account') },
];

type EHubSectionNavProps = {
  /** The breadcrumb's last item (the website's currentLabel); no breadcrumb when left out. */
  currentLabel?: string;
  parentLabel?: string;
  onParentPress?: () => void;
  /** Lights up a section whose route alone doesn't say it (e.g. a provider profile reached from Professionals). */
  activeOverride?: EHubNavItemId;
};

/** Section pills (and the breadcrumb) shown under the header on every E-Hub screen. */
export default function EHubSectionNav({ currentLabel, parentLabel, onParentPress, activeOverride }: EHubSectionNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = typeof params.kind === 'string' ? params.kind : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);

  // Brings the active section into view on narrow screens (My enquiries and Sell sit past the right edge).
  const handleActiveLayout = (event: LayoutChangeEvent) => {
    const { x } = event.nativeEvent.layout;
    if (x > 120) scrollRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: false });
  };

  const handleHome = () => router.dismissTo('/ehub' as Href);

  const openDiscover = (nextKind: 'professional' | 'business') => {
    if (pathname.startsWith('/ehub/discover')) router.setParams({ kind: nextKind });
    else router.push(`/ehub/discover?kind=${nextKind}` as Href);
  };

  const handlePress = (id: EHubNavItemId) => {
    // Shop jumps to the home catalog (the website's /ehub#featured-products); jump changes on every tap.
    if (id === 'shop') {
      if (pathname === '/ehub') router.setParams({ section: 'products', jump: String(Date.now()) });
      else router.dismissTo(`/ehub?section=products&jump=${Date.now()}` as Href);
      return;
    }
    if (id === 'professionals') { openDiscover('professional'); return; }
    if (id === 'storefronts') { openDiscover('business'); return; }
    if (id === 'enquiries') { if (!pathname.startsWith('/ehub/enquiries')) router.push('/ehub/enquiries?mode=sent' as Href); return; }
    if (!pathname.startsWith('/ehub/seller')) router.push('/ehub/seller' as Href);
  };

  return <View style={styles.container}>
    <EHubScrollView scrollRef={scrollRef} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pills} accessibilityLabel="E-Hub sections">
      {NAVIGATION_ITEMS.map((item) => {
        const isActive = activeOverride ? activeOverride === item.id : item.isActive(pathname, kind);
        const Icon = item.icon;
        return <TouchableOpacity key={item.id} accessibilityRole="link" accessibilityState={{ selected: isActive }} activeOpacity={0.7} onPress={() => handlePress(item.id)} onLayout={isActive ? handleActiveLayout : undefined} style={[styles.pill, isActive ? styles.pillActive : null]}>
          <Icon size={15} color={isActive ? colors.successText : colors.mutedText} />
          <Text style={[styles.pillText, isActive ? styles.pillTextActive : null]}>{item.label}</Text>
        </TouchableOpacity>;
      })}
    </EHubScrollView>
    {currentLabel ? <View accessibilityLabel="Breadcrumb" style={styles.breadcrumb}>
      <TouchableOpacity accessibilityRole="link" activeOpacity={0.7} onPress={handleHome} hitSlop={8} style={styles.crumbLink}>
        <Home size={13} color={colors.mutedText} /><Text style={styles.crumbText}>E-Hub</Text>
      </TouchableOpacity>
      {parentLabel && onParentPress ? <>
        <ChevronRight size={13} color={colors.mutedText} />
        <TouchableOpacity accessibilityRole="link" activeOpacity={0.7} onPress={onParentPress} hitSlop={8}><Text style={styles.crumbText}>{parentLabel}</Text></TouchableOpacity>
      </> : null}
      <ChevronRight size={13} color={colors.mutedText} />
      <Text numberOfLines={1} style={styles.crumbCurrent}>{currentLabel}</Text>
    </View> : null}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  pills: { paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  pill: { minHeight: 40, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: colors.successSurface, borderColor: colors.accent },
  pillText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  pillTextActive: { color: colors.successText },
  breadcrumb: { minHeight: 32, paddingHorizontal: 14, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  crumbLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumbText: { color: colors.mutedText, fontSize: 12 },
  crumbCurrent: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
});
