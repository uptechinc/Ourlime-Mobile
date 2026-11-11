import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Bookmark, ChevronDown, ChevronRight, HelpCircle, LayoutGrid, List, Package, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Store, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAccountCart } from '@/lib/hooks/useAccountCart';
import { useMarketplaceCatalog } from '@/lib/hooks/useMarketplaceCatalog';
import { useMarketplacePreferences } from '@/lib/hooks/useMarketplacePreferences';
import { useMarketSavedSearches } from '@/lib/hooks/useMarketSavedSearches';
import { marketplaceService } from '@/lib/services/MarketplaceService';
import { marketplaceResourceService } from '@/lib/services/MarketplaceResourceService';
import { EMPTY_MARKET_FILTERS, marketCatalogFilterService, type MarketFilters, type MarketSort } from '@/lib/services/MarketCatalogFilterService';
import { useMarketplaceStore } from '@/lib/store/useMarketplaceStore';
import type { MarketProduct } from '@/lib/types/reliability';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import { MarketButton } from './MarketFormModal';
import MarketProductCard from './MarketProductCard';
import SellerApplicationModal from './SellerApplicationModal';
import MarketCartModal from './cart/MarketCartModal';
import ProductFilter, { MARKET_SORT_OPTIONS } from './filters/ProductFilter';
import { MarketplaceSkeleton } from '@/components/ui/Skeleton';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import PromotionSlider from './promotion/PromotionSlider';

type MarketplaceScreenProps = { entryPoint?: 'market' | 'ehub' };
const EMPTY_PRODUCTS: readonly MarketProduct[] = Object.freeze([]);
/** Web PromotionSlider hrefs: /market?sortBy=newest | popularity | newest | price-low-high. */
const PROMOTION_SORTS: Record<string, MarketSort> = { summer: 'newest', 'best-sellers': 'popularity', 'new-arrivals': 'newest', offers: 'price-low-high' };
const ALL_CATALOG_KEY = marketplaceResourceService.key('', '');

const priceText = (product: MarketProduct): string => {
  const variants = product.variants.filter((variant) => variant.available);
  const currencies = [...new Set(variants.map((variant) => variant.currency))];
  if (!variants.length) return 'Price unavailable';
  if (currencies.length !== 1) return 'Multiple currencies';
  const minimum = Math.min(...variants.map((variant) => variant.price));
  return `${variants.some((variant) => variant.price !== minimum) ? 'From ' : ''}${formatMarketPrice(currencies[0], minimum)}`;
};

export default function MarketplaceScreen({ entryPoint = 'market' }: MarketplaceScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ product?: string; productId?: string; id?: string }>();
  const { profile, getDecision } = usePageAccess();
  const ownerId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const cart = useAccountCart(ownerId);
  const preferences = useMarketplacePreferences();
  const savedSearches = useMarketSavedSearches();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_MARKET_FILTERS);
  const [sort, setSort] = useState<MarketSort>('default');
  // Title-prefix query runs on the server; the full catalog already loaded is also searched across description,
  // category, tags and seller name (web filterProducts searches those fields).
  const catalog = useMarketplaceCatalog(ownerId, search, '');
  const loadedAll = useMarketplaceStore((state) => state.catalogs[ALL_CATALOG_KEY]?.data?.products) ?? EMPTY_PRODUCTS;
  const catalogProducts = catalog.data?.products ?? EMPTY_PRODUCTS;
  const isCatalogLoading = !catalog.error && !catalogProducts.length && (catalog.data === null || catalog.status === 'hydrating' || catalog.status === 'refreshing');
  const [cartOpen, setCartOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState('');

  const searchPool = useMemo(() => {
    if (!search.trim()) return catalogProducts;
    const merged = new Map(catalogProducts.map((product) => [product.id, product]));
    loadedAll.forEach((product) => { if (!merged.has(product.id) && marketCatalogFilterService.matchesSearch(product, search)) merged.set(product.id, product); });
    return [...merged.values()];
  }, [catalogProducts, loadedAll, search]);
  const facets = useMemo(() => marketCatalogFilterService.facets(search.trim() ? searchPool : catalogProducts), [catalogProducts, search, searchPool]);
  const products = useMemo(() => marketCatalogFilterService.apply(searchPool, filters, search, preferences.favoriteIds, sort), [filters, preferences.favoriteIds, search, searchPool, sort]);
  const recentProducts = useMemo(() => preferences.recentIds.map((productId) => catalogProducts.find((product) => product.id === productId)).filter((product): product is MarketProduct => Boolean(product)).slice(0, 6), [catalogProducts, preferences.recentIds]);
  const visibleLines = cart.cart.lines.filter((line) => !line.removed);
  const cartUnits = visibleLines.reduce((total, line) => total + line.quantity, 0);
  const activeFilterCount = marketCatalogFilterService.activeCount(filters);

  // Old `/market?product=` links (E-Hub, notifications, shares) open the product route.
  useEffect(() => {
    const productId = params.product || params.productId || params.id;
    if (productId) router.replace(`/market/${encodeURIComponent(productId)}` as Href);
  }, [params.id, params.product, params.productId, router]);

  const openProduct = (product: MarketProduct) => router.push(`/market/${encodeURIComponent(product.id)}` as Href);
  const handleQuickAdd = (product: MarketProduct) => {
    const availableVariants = product.variants.filter((variant) => variant.available);
    if (!ownerId || !canMutate) { setError('Sign in to save products to your cart.'); return; }
    if (availableVariants.length !== 1) { openProduct(product); return; }
    const variant = availableVariants[0];
    const quantity = (visibleLines.find((line) => line.productId === product.id && line.variantId === variant.id)?.quantity ?? 0) + 1;
    void cart.setQuantity(product, variant, quantity).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'This item could not be added.'));
  };
  const handleSupport = async () => {
    try {
      const destination = marketplaceService.supportDestination(await marketplaceService.support(ownerId));
      if (!destination.url) { router.push('/help'); return; }
      if (!(await Linking.canOpenURL(destination.url))) { setError(`Open your email or browser manually: ${destination.display}`); return; }
      await Linking.openURL(destination.url);
    } catch { setError('Support links could not be opened. Use Help from the main menu.'); }
  };
  const handleSaveSearch = () => { void savedSearches.save(search, filters.categories).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Search could not be saved.')); };
  const toggleCategory = (category: string) => setFilters((current) => ({ ...current, categories: category ? (current.categories.includes(category) ? current.categories.filter((entry) => entry !== category) : [...current.categories, category]) : [] }));

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={styles.headerTitle}><Text style={styles.title}>{entryPoint === 'ehub' ? 'E-Hub Market' : 'Lime Market'}</Text><Text style={styles.subtitle}>Shop Ourlime sellers</Text></View>
      {ownerId ? <Pressable accessibilityRole="button" accessibilityLabel="My orders" onPress={() => router.push('/market/orders' as Href)} style={styles.cartHeaderButton}><Package color={colors.text} size={21} /></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Cart with ${cartUnits} items`} onPress={() => setCartOpen(true)} style={styles.cartHeaderButton}><ShoppingBag color={colors.text} size={22} />{cartUnits ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartUnits > 99 ? '99+' : cartUnits}</Text></View> : null}</Pressable>
    </View>
    <KeyboardSafeView style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={catalog.status === 'refreshing'} onRefresh={() => void catalog.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.content}>
        <PromotionSlider onSelect={(promotionId) => setSort(PROMOTION_SORTS[promotionId] ?? 'default')} />
        <View style={styles.releaseNotice}><ShieldCheck color={colors.accentText} size={17} /><Text style={styles.releaseNoticeText}>Browsing and saved carts are available. Payments are unavailable.</Text></View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}><Search color={colors.mutedText} size={20} /><TextInput value={search} onChangeText={setSearch} accessibilityLabel="Search marketplace" autoCapitalize="none" returnKeyType="search" placeholder="Search products, sellers, tags" placeholderTextColor={colors.mutedText} style={styles.searchInput} />{search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}><X color={colors.mutedText} size={18} /></Pressable> : null}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open filters" onPress={() => setFilterOpen(true)} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}><SlidersHorizontal color={activeFilterCount ? colors.onAccent : colors.text} size={21} />{activeFilterCount ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}</Pressable>
        </View>
        {error || preferences.error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error || preferences.error}</Text><Pressable accessibilityLabel="Dismiss" onPress={() => setError('')}><X size={18} color={colors.destructiveText} /></Pressable></View> : null}
        {savedSearches.searches.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Text style={styles.savedLabel}>Saved:</Text>
          {savedSearches.searches.map((entry) => <View key={entry.id} style={styles.savedChip}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Apply saved search ${entry.label}`} onPress={() => { setSearch(entry.query); setFilters((current) => ({ ...current, categories: entry.categories })); }} style={{ minHeight: 40, justifyContent: 'center', paddingLeft: 12 }}><Text style={styles.chipText}>{entry.label}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove saved search" onPress={() => void savedSearches.remove(entry.id)} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}><X size={14} color={colors.mutedText} /></Pressable>
          </View>)}
        </ScrollView> : null}
        {facets.categories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable onPress={() => toggleCategory('')} style={[styles.chip, !filters.categories.length && styles.chipActive]}><Text style={[styles.chipText, !filters.categories.length && styles.chipTextActive]}>All</Text></Pressable>{facets.categories.map((categoryName) => { const active = filters.categories.includes(categoryName); return <Pressable key={categoryName} onPress={() => toggleCategory(categoryName)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryName}</Text></Pressable>; })}</ScrollView> : null}
        {recentProducts.length > 0 && !search && !filters.categories.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Recently viewed</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>{recentProducts.map((product) => <Pressable key={product.id} onPress={() => openProduct(product)} style={styles.recentCard}>{product.images[0] ? <Image source={{ uri: product.images[0] }} style={styles.recentImage} /> : <View style={[styles.recentImage, { backgroundColor: colors.control }]} />}<View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.recentTitle}>{product.title}</Text><Text style={styles.recentPrice}>{priceText(product)}</Text></View><ChevronRight size={18} color={colors.mutedText} /></Pressable>)}</ScrollView></View> : null}
        <View style={styles.sectionHeading}>
          <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{filters.categories.length === 1 ? filters.categories[0] : filters.favoritesOnly ? 'Saved products' : 'Marketplace'}</Text><Text style={styles.resultText}>{isCatalogLoading ? 'Loading listings…' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}</Text></View>
          {search.trim() || filters.categories.length ? <Pressable accessibilityRole="button" accessibilityLabel="Save this search" onPress={handleSaveSearch} style={styles.squareButton}><Bookmark color={colors.text} size={18} /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={savedSearches.viewMode === 'grid' ? 'Show as list' : 'Show as grid'} onPress={() => void savedSearches.setViewMode(savedSearches.viewMode === 'grid' ? 'list' : 'grid')} style={styles.squareButton}>{savedSearches.viewMode === 'grid' ? <List color={colors.text} size={18} /> : <LayoutGrid color={colors.text} size={18} />}</Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort" onPress={() => setFilterOpen(true)} style={styles.sortButton}><Text style={styles.sortText}>{MARKET_SORT_OPTIONS.find((entry) => entry.value === sort)?.label}</Text><ChevronDown color={colors.mutedText} size={16} /></Pressable>
        </View>
        {catalog.error ? <Pressable onPress={() => void catalog.refresh()} style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{catalog.error.message} Tap to retry.</Text></Pressable> : null}
        {isCatalogLoading ? <MarketplaceSkeleton /> : !products.length && !catalog.error ? <View style={styles.empty}><ShoppingBag color={colors.mutedText} size={42} /><Text style={styles.emptyTitle}>No listings found</Text><Text style={styles.emptyText}>Try another search, category, or filter.</Text>{activeFilterCount ? <MarketButton label="Clear filters" onPress={() => setFilters(EMPTY_MARKET_FILTERS)} /> : null}</View>
          : <View style={styles.grid}>{products.map((product) => <MarketProductCard key={product.id} layout={savedSearches.viewMode} product={product} favorite={preferences.favoriteIds.includes(product.id)} onOpen={openProduct} onToggleFavorite={(productId) => void preferences.toggleFavorite(productId)} onQuickAdd={handleQuickAdd} />)}</View>}
        {catalog.data?.cursor ? <MarketButton label={catalog.status === 'refreshing' ? 'Loading listings…' : 'Load more listings'} disabled={catalog.status === 'refreshing'} onPress={() => void catalog.loadMore()} /> : null}
        <View style={styles.services}>
          <Pressable onPress={() => ownerId && canMutate ? setSellerOpen(true) : router.push('/(auth)/login')} style={styles.serviceRow}><Store color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>Sell on Ourlime</Text><Text style={styles.serviceText}>{ownerId ? 'Manage your seller application' : 'Sign in to apply as a seller'}</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable>
          {ownerId ? <Pressable onPress={() => router.push('/market/seller' as Href)} style={styles.serviceRow}><ShoppingBag color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>My listings</Text><Text style={styles.serviceText}>Add products, manage listings and fulfil orders</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable> : null}
          {ownerId ? <Pressable onPress={() => router.push('/market/orders' as Href)} style={styles.serviceRow}><Package color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>My orders</Text><Text style={styles.serviceText}>Track shipments, confirm delivery and write reviews</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable> : null}
          <Pressable onPress={() => void handleSupport()} style={styles.serviceRow}><HelpCircle color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>Marketplace support</Text><Text style={styles.serviceText}>Get help with listings and saved carts</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable>
        </View>
      </ScrollView>
    </KeyboardSafeView>

    {filterOpen ? <ProductFilter filters={filters} sort={sort} categories={facets.categories} colors={facets.colors} sizes={facets.sizes} onChange={setFilters} onSortChange={setSort} onClose={() => setFilterOpen(false)} /> : null}
    {cartOpen ? <MarketCartModal ownerId={ownerId} canMutate={canMutate} cart={cart} onClose={() => setCartOpen(false)} /> : null}
    {sellerOpen ? <SellerApplicationModal onClose={() => setSellerOpen(false)} /> : null}
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.text, fontSize: 32, lineHeight: 35 }, headerTitle: { flex: 1 }, title: { color: colors.text, fontSize: 21, fontWeight: '900' }, subtitle: { color: colors.mutedText, fontSize: 11, marginTop: 1 }, cartHeaderButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }, cartBadge: { position: 'absolute', right: -2, top: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#dc2626' }, cartBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 36, gap: 16 }, releaseNotice: { padding: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent }, releaseNoticeText: { flex: 1, color: colors.accentText, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10 }, searchBox: { flex: 1, minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, color: colors.text, fontSize: 15 }, filterButton: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent }, filterCount: { position: 'absolute', right: -3, top: -5, minWidth: 19, height: 19, borderRadius: 10, textAlign: 'center', color: '#ffffff', backgroundColor: '#dc2626', fontSize: 10, fontWeight: '900', lineHeight: 19 },
  chips: { gap: 8, paddingRight: 14, alignItems: 'center' }, chip: { minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.accent, borderColor: colors.accent }, chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.onAccent },
  savedLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '800' }, savedChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent },
  section: { gap: 10 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, resultText: { color: colors.mutedText, fontSize: 11, marginTop: 2 }, squareButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, sortButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 140 }, sortText: { color: colors.secondaryText, fontSize: 11, fontWeight: '700', flexShrink: 1 }, recentRow: { gap: 10 }, recentCard: { width: 235, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, recentImage: { width: 48, height: 48, borderRadius: 10 }, recentTitle: { color: colors.text, fontSize: 12, fontWeight: '800' }, recentPrice: { color: colors.accentText, fontSize: 11, fontWeight: '700', marginTop: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  errorCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.destructiveSurface }, errorText: { flex: 1, color: colors.destructiveText, lineHeight: 18 }, empty: { paddingVertical: 38, paddingHorizontal: 18, alignItems: 'center', gap: 9 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, emptyText: { color: colors.mutedText, textAlign: 'center', lineHeight: 19 }, services: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, serviceRow: { minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, serviceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, serviceText: { color: colors.mutedText, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
