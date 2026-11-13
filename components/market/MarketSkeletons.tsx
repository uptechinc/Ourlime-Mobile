import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useMarketSavedSearches } from '@/lib/hooks/useMarketSavedSearches';

/**
 * Market loading skeletons. Each one mirrors the real screen's JSX and StyleSheet values
 * (MarketplaceScreen, MarketProductCard, ProductDetailsScreen, MarketOrdersScreen) so the
 * placeholder occupies exactly the space the loaded page will.
 */

type SkeletonLineProps = {
  /** Font size of the text this line stands in for. */
  fontSize: number;
  /** Explicit lineHeight of that text; defaults to the platform line box (~1.33 × font size). */
  lineHeight?: number;
  width: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
};

/** One text line: a row as tall as the real line box with a bar sized to the glyphs. */
export function SkeletonLine({ fontSize, lineHeight, width, style }: SkeletonLineProps): ReactNode {
  return <View style={[{ height: lineHeight ?? Math.round(fontSize * 1.33), justifyContent: 'center' }, style]}>
    <SkeletonText width={width} height={Math.max(6, Math.round(fontSize * 0.78))} borderRadius={4} />
  </View>;
}

/** Placeholder for a lucide icon of the given size. */
export function SkeletonIcon({ size, style }: { size: number; style?: StyleProp<ViewStyle> }): ReactNode {
  return <SkeletonBox width={size} height={size} borderRadius={Math.round(size / 4)} style={style} />;
}

/** Text-glyph back chevron (‹, fontSize 32, lineHeight 35) inside its 44 × 44 touch target. */
export function SkeletonBackButton(): ReactNode {
  return <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <SkeletonBox width={11} height={22} borderRadius={4} />
  </View>;
}

// ---------------------------------------------------------------------------------------------
// MarketProductCard
// ---------------------------------------------------------------------------------------------

type MarketProductCardSkeletonProps = { layout?: 'grid' | 'list' };

/** MarketProductCard placeholder: 158 px image tile (grid) or 132 px image column (list), same body rows. */
export function MarketProductCardSkeleton({ layout = 'grid' }: MarketProductCardSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createCardStyles(colors), [colors]);
  const isList = layout === 'list';
  return <View style={isList ? styles.listCard : styles.card}>
    <View style={isList ? styles.listImageFrame : styles.imageFrame}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <View style={styles.favoriteButton}><SkeletonIcon size={19} /></View>
      <View style={[styles.favoriteButton, styles.shareButton]}><SkeletonIcon size={17} /></View>
    </View>
    <View style={isList ? styles.listBody : styles.body}>
      <SkeletonLine fontSize={10} width="45%" />
      <View style={styles.title}>
        <SkeletonLine fontSize={14} lineHeight={19} width="95%" />
        <SkeletonLine fontSize={14} lineHeight={19} width="60%" />
      </View>
      <SkeletonLine fontSize={11} width="55%" />
      <SkeletonLine fontSize={11} width="40%" />
      <View style={styles.fulfilmentRow}><SkeletonIcon size={14} /><SkeletonIcon size={14} /><SkeletonLine fontSize={10} width={34} /></View>
      <View style={styles.footer}>
        <View style={{ flex: 1 }}><SkeletonLine fontSize={13} width="70%" /></View>
        <SkeletonBox width={38} height={38} borderRadius={12} />
      </View>
    </View>
  </View>;
}

const createCardStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, maxWidth: '49%', minWidth: 150, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  imageFrame: { height: 158, backgroundColor: colors.control },
  listCard: { width: '100%', flexDirection: 'row', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  listImageFrame: { width: 132, minHeight: 150, backgroundColor: colors.control },
  listBody: { flex: 1, padding: 11, gap: 5 },
  body: { padding: 11, gap: 5 },
  favoriteButton: { position: 'absolute', right: 9, top: 9, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  shareButton: { top: 55 },
  title: { minHeight: 38 },
  fulfilmentRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
});

type MarketCatalogSkeletonProps = { layout?: 'grid' | 'list'; count?: number };

/** The product grid (`styles.grid`: row wrap, gap 10) while the catalog loads, in the page's grid or list mode. */
export function MarketCatalogSkeleton({ layout = 'grid', count }: MarketCatalogSkeletonProps): ReactNode {
  const total = count ?? (layout === 'list' ? 3 : 4);
  return <View accessibilityLabel="Loading listings" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {Array.from({ length: total }, (_, cardIndex) => <MarketProductCardSkeleton key={cardIndex} layout={layout} />)}
  </View>;
}

const CATEGORY_CHIP_TEXT_WIDTHS = [18, 64, 78, 52, 88, 60] as const;

/** Category chip row (minHeight 40, radius 20, surface + border) shown where the real chips will appear. */
export function MarketCategoryChipsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
    {CATEGORY_CHIP_TEXT_WIDTHS.map((textWidth, chipIndex) => <View key={chipIndex} style={{ minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <SkeletonLine fontSize={12} width={textWidth} />
    </View>)}
  </View>;
}

// ---------------------------------------------------------------------------------------------
// Market home (full page, for the route-level PageAccessBoundary)
// ---------------------------------------------------------------------------------------------

type MarketplacePageSkeletonProps = {
  /** Signed-in visitors also see the My orders header button and the My listings / My orders service rows. */
  signedIn?: boolean;
};

/**
 * The whole Market home page while page access (or the screen) loads: header with title, subtitle,
 * orders and cart buttons; promotion slider; release notice; search + filter; category chips;
 * Marketplace heading with view toggle and sort; product grid (or list, per the saved view mode);
 * with the shortcut tiles (sell, listings, orders, pets, support) at the top. Rendered inside its own SafeAreaView with the real screen's edges.
 */
export function MarketplacePageSkeleton({ signedIn = true }: MarketplacePageSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createPageStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { viewMode } = useMarketSavedSearches();
  const promotionWidth = Math.min(Math.max(width - 52, 260), 420);
  const shortcutCount = signedIn ? 5 : 3;

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>
      <SkeletonBackButton />
      <View style={{ flex: 1 }}>
        <SkeletonLine fontSize={21} width={128} />
        <SkeletonLine fontSize={11} width={108} style={{ marginTop: 1 }} />
      </View>
      {signedIn ? <View style={styles.headerButton}><SkeletonIcon size={21} /></View> : null}
      <View style={styles.headerButton}><SkeletonIcon size={22} /></View>
    </View>
    <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.shortcutTrack}>
        {Array.from({ length: shortcutCount }, (_, shortcutIndex) => <View key={shortcutIndex} style={styles.shortcut}>
          <SkeletonBox width={34} height={34} borderRadius={11} style={{ marginBottom: 4 }} />
          <SkeletonLine fontSize={13} width="80%" />
          <SkeletonLine fontSize={11} lineHeight={15} width="95%" />
          <SkeletonLine fontSize={11} lineHeight={15} width="55%" />
        </View>)}
      </View>
      <View style={styles.promotionTrack}>
        {[0, 1].map((promotionIndex) => <SkeletonBox key={promotionIndex} width={promotionWidth} height={132} borderRadius={20} />)}
      </View>
      <View style={styles.releaseNotice}>
        <SkeletonIcon size={17} />
        <View style={{ flex: 1 }}>
          {/* The one-sentence notice (11px) fits on one line on phones about 400dp wide and wraps on narrower ones. */}
          <SkeletonLine fontSize={11} lineHeight={16} width={width >= 400 ? '92%' : '100%'} />
          {width < 400 ? <SkeletonLine fontSize={11} lineHeight={16} width="22%" /> : null}
        </View>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}><SkeletonIcon size={20} /><SkeletonLine fontSize={15} width="68%" /></View>
        <View style={styles.filterButton}><SkeletonIcon size={21} /></View>
      </View>
      <MarketCategoryChipsSkeleton />
      <View style={styles.sectionHeading}>
        <View style={{ flex: 1 }}>
          <SkeletonLine fontSize={19} width={118} />
          <SkeletonLine fontSize={11} width={74} style={{ marginTop: 2 }} />
        </View>
        <View style={styles.squareButton}><SkeletonIcon size={18} /></View>
        <View style={styles.sortButton}><SkeletonLine fontSize={11} width={48} /><SkeletonIcon size={16} /></View>
      </View>
      <MarketCatalogSkeleton layout={viewMode} />
    </ScrollView>
  </SafeAreaView>;
}

const createPageStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  headerButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  content: { padding: 14, paddingBottom: 36, gap: 16 },
  promotionTrack: { marginHorizontal: -14, paddingHorizontal: 14, flexDirection: 'row', gap: 12, overflow: 'hidden' },
  releaseNotice: { padding: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBox: { flex: 1, minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterButton: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  squareButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 140 },
  shortcutTrack: { marginRight: -14, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  shortcut: { width: 128, padding: 12, gap: 4, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});

// ---------------------------------------------------------------------------------------------
// Product details body (rendered under the real ProductDetailsScreen header)
// ---------------------------------------------------------------------------------------------

/** ProductDetailsScreen body: gallery, category + share/report, title, price card, quantity and buttons, info tiles, seller card, description, specs. */
export function ProductDetailsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDetailStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const galleryHeight = Math.min(width, 560) * 0.9;
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={[styles.gallery, { height: galleryHeight }]}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <View style={styles.galleryFavorite}><SkeletonIcon size={21} /></View>
    </View>

    <View style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <View style={styles.categoryChip}><SkeletonLine fontSize={11} width={74} /></View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.roundButton}><SkeletonIcon size={19} /></View>
          <View style={styles.roundButton}><SkeletonIcon size={19} /></View>
        </View>
      </View>
      <View>
        <SkeletonLine fontSize={24} lineHeight={30} width="92%" />
        <SkeletonLine fontSize={24} lineHeight={30} width="55%" />
      </View>
      <SkeletonLine fontSize={12} width="58%" />
    </View>

    <View style={styles.priceCard}>
      <SkeletonLine fontSize={28} width={130} />
      <SkeletonBox width={160} height={26} borderRadius={999} />
    </View>

    <View style={{ gap: 10 }}>
      <SkeletonLine fontSize={12} width={68} />
      <View style={styles.stepper}>
        <SkeletonBox width={44} height={44} borderRadius={12} />
        <View style={{ minWidth: 30, alignItems: 'center' }}><SkeletonLine fontSize={15} width={12} /></View>
        <SkeletonBox width={44} height={44} borderRadius={12} />
      </View>
      <View style={styles.secondaryButton}><SkeletonIcon size={18} /><SkeletonLine fontSize={15} width={96} /></View>
      <SkeletonBox height={52} borderRadius={14} />
    </View>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[0, 1].map((tileIndex) => <View key={tileIndex} style={styles.infoTile}>
        <SkeletonIcon size={18} />
        <View style={{ flex: 1 }}>
          <SkeletonLine fontSize={12} width="70%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="100%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="60%" />
        </View>
      </View>)}
    </View>

    <View style={styles.sellerCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SkeletonBox width={48} height={48} borderRadius={13} />
        <View style={{ flex: 1, gap: 3 }}>
          <SkeletonLine fontSize={15} width="55%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="40%" />
        </View>
      </View>
    </View>

    <View style={{ gap: 8 }}>
      <SkeletonLine fontSize={18} width={170} />
      <View>
        <SkeletonLine fontSize={14} lineHeight={22} width="100%" />
        <SkeletonLine fontSize={14} lineHeight={22} width="96%" />
        <SkeletonLine fontSize={14} lineHeight={22} width="70%" />
      </View>
    </View>

    <View style={{ gap: 8 }}>
      <SkeletonLine fontSize={18} width={130} />
      <View style={styles.specCard}>
        {[0, 1, 2].map((specIndex) => <View key={specIndex} style={[styles.specRow, specIndex < 2 && styles.specDivider]}>
          <SkeletonLine fontSize={12} width={70} />
          <SkeletonLine fontSize={12} width={90} />
        </View>)}
      </View>
    </View>
  </ScrollView>;
}

const createDetailStyles = (colors: AppThemeColors) => StyleSheet.create({
  content: { padding: 14, paddingBottom: 40, gap: 18 },
  gallery: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border },
  galleryFavorite: { position: 'absolute', right: 12, top: 12, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  priceCard: { padding: 15, gap: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: 3, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryButton: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 2, borderColor: colors.text },
  infoTile: { flex: 1, padding: 12, flexDirection: 'row', gap: 9, borderRadius: 16, backgroundColor: colors.surface },
  sellerCard: { padding: 14, gap: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  specCard: { paddingHorizontal: 13, borderRadius: 16, backgroundColor: colors.surface },
  specRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  specDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

// ---------------------------------------------------------------------------------------------
// Product reviews (inside ProductReviewsSection while reviews load)
// ---------------------------------------------------------------------------------------------

/** Review cards (padding 13, radius 16, surface + border): avatar, name, date, stars, comment. */
export function ProductReviewsSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  return <View accessibilityLabel="Loading reviews" style={{ gap: 12 }}>
    {Array.from({ length: count }, (_, reviewIndex) => <View key={reviewIndex} style={{ padding: 13, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <SkeletonCircle size={30} />
          <View style={{ flex: 1, gap: 2 }}><SkeletonLine fontSize={13} width="45%" /></View>
        </View>
        <SkeletonLine fontSize={11} width={62} />
      </View>
      <SkeletonBox width={78} height={13} borderRadius={4} />
      <View>
        <SkeletonLine fontSize={14} lineHeight={19} width="100%" />
        <SkeletonLine fontSize={14} lineHeight={19} width="65%" />
      </View>
    </View>)}
  </View>;
}

// ---------------------------------------------------------------------------------------------
// Buyer orders (MarketOrdersScreen)
// ---------------------------------------------------------------------------------------------

/** MarketOrdersScreen order cards: order number block + status badge, item row with 60 px thumbnail, fulfilment line. */
export function MarketOrdersSkeleton({ count = 3 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createOrderStyles(colors), [colors]);
  return <View accessibilityLabel="Loading orders" style={{ gap: 14 }}>
    {Array.from({ length: count }, (_, orderIndex) => <View key={orderIndex} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <SkeletonLine fontSize={10} width={86} />
          <SkeletonLine fontSize={14} width="52%" />
          <SkeletonLine fontSize={12} width="64%" />
        </View>
        <SkeletonBox width={96} height={25} borderRadius={999} />
      </View>
      <View style={styles.itemRow}>
        <SkeletonBox width={60} height={60} borderRadius={10} />
        <View style={{ flex: 1, gap: 2 }}>
          <SkeletonLine fontSize={14} width="80%" />
          <SkeletonLine fontSize={12} width="92%" />
          <SkeletonLine fontSize={14} width="30%" />
        </View>
      </View>
      <SkeletonLine fontSize={12} width="50%" />
    </View>)}
  </View>;
}

const createOrderStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 14, gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemRow: { flexDirection: 'row', gap: 10 },
});
