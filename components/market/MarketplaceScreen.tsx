import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, ChevronDown, ChevronRight, Heart, HelpCircle, Search, Share2, ShieldCheck, ShoppingBag, SlidersHorizontal, Store, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAccountCart } from '@/lib/hooks/useAccountCart';
import { useMarketplaceCatalog } from '@/lib/hooks/useMarketplaceCatalog';
import { useMarketplacePreferences } from '@/lib/hooks/useMarketplacePreferences';
import { marketplaceService } from '@/lib/services/MarketplaceService';
import type { CartLine, MarketProduct, MarketProductCondition } from '@/lib/types/reliability';
import MarketFormModal, { MarketButton } from './MarketFormModal';
import MarketProductCard from './MarketProductCard';
import ListingDiscussion from './ListingDiscussion';
import CheckoutPreparationModal from './CheckoutPreparationModal';
import SellerApplicationModal from './SellerApplicationModal';
import { MarketplaceSkeleton } from '@/components/ui/Skeleton';
import PromotionSlider from './promotion/PromotionSlider';

type MarketplaceScreenProps = { entryPoint?: 'market' | 'ehub' };
type MarketSort = 'relevance' | 'price_low' | 'price_high' | 'rating' | 'popular';
type ConditionFilter = 'all' | Exclude<MarketProductCondition, null>;
const EMPTY_PRODUCTS: readonly MarketProduct[] = Object.freeze([]);
const SORTS: { value: MarketSort; label: string }[] = [
  { value: 'relevance', label: 'Featured' }, { value: 'price_low', label: 'Price: low' },
  { value: 'price_high', label: 'Price: high' }, { value: 'rating', label: 'Rating' }, { value: 'popular', label: 'Popular' },
];
const CONDITIONS: { value: ConditionFilter; label: string }[] = [
  { value: 'all', label: 'Any condition' }, { value: 'new', label: 'New' }, { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'refurbished', label: 'Refurbished' },
];
const minimumPrice = (product: MarketProduct): number | null => {
  const prices = product.variants.filter((variant) => variant.available).map((variant) => variant.price);
  return prices.length ? Math.min(...prices) : null;
};
const priceText = (product: MarketProduct): string => {
  const variants = product.variants.filter((variant) => variant.available && variant.currency);
  const currencies = [...new Set(variants.map((variant) => variant.currency))];
  if (!variants.length) return 'Price unavailable';
  if (currencies.length !== 1) return 'Multiple currencies';
  const minimum = Math.min(...variants.map((variant) => variant.price));
  return `${variants.some((variant) => variant.price !== minimum) ? 'From ' : ''}${currencies[0]} ${minimum.toFixed(2)}`;
};

export default function MarketplaceScreen({ entryPoint = 'market' }: MarketplaceScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ product?: string; productId?: string }>();
  const { profile, getDecision } = usePageAccess();
  const ownerId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const cart = useAccountCart(ownerId);
  const preferences = useMarketplacePreferences();
  const recordViewed = preferences.recordViewed;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<MarketSort>('relevance');
  const [condition, setCondition] = useState<ConditionFilter>('all');
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const catalog = useMarketplaceCatalog(ownerId, search, category);
  const catalogProducts = catalog.data?.products ?? EMPTY_PRODUCTS;
  const [selected, setSelected] = useState<MarketProduct | null>(null);
  const [variantId, setVariantId] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => [...new Set(catalogProducts.map((product) => product.category).filter(Boolean))].sort((first, second) => first.localeCompare(second)), [catalogProducts]);
  const products = useMemo(() => {
    const minimumValue = minimum.trim() ? Number(minimum) : null;
    const maximumValue = maximum.trim() ? Number(maximum) : null;
    const filtered = catalogProducts.filter((product) => {
      const price = minimumPrice(product);
      if (condition !== 'all' && product.condition !== condition) return false;
      if (deliveryOnly && product.deliveryAvailable !== true) return false;
      if (pickupOnly && product.pickupAvailable !== true) return false;
      if (favoritesOnly && !preferences.favoriteIds.includes(product.id)) return false;
      if (minimumValue !== null && Number.isFinite(minimumValue) && (price === null || price < minimumValue)) return false;
      if (maximumValue !== null && Number.isFinite(maximumValue) && (price === null || price > maximumValue)) return false;
      return true;
    });
    return [...filtered].sort((first, second) => {
      if (sort === 'price_low') return (minimumPrice(first) ?? Number.MAX_SAFE_INTEGER) - (minimumPrice(second) ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price_high') return (minimumPrice(second) ?? -1) - (minimumPrice(first) ?? -1);
      if (sort === 'rating') return (second.rating ?? -1) - (first.rating ?? -1);
      if (sort === 'popular') return second.popularity - first.popularity;
      return 0;
    });
  }, [catalogProducts, condition, deliveryOnly, favoritesOnly, maximum, minimum, pickupOnly, preferences.favoriteIds, sort]);
  const recentProducts = useMemo(() => preferences.recentIds.map((productId) => catalogProducts.find((product) => product.id === productId)).filter((product): product is MarketProduct => Boolean(product)).slice(0, 6), [catalogProducts, preferences.recentIds]);
  const selectedVariant = selected?.variants.find((variant) => variant.id === variantId);
  const visibleLines = cart.cart.lines.filter((line) => !line.removed);
  const cartUnits = visibleLines.reduce((total, line) => total + line.quantity, 0);
  const activeFilterCount = Number(condition !== 'all') + Number(deliveryOnly) + Number(pickupOnly) + Number(favoritesOnly) + Number(Boolean(minimum.trim())) + Number(Boolean(maximum.trim()));

  useEffect(() => {
    const productId = params.product || params.productId;
    if (!productId) return;
    let active = true;
    void marketplaceService.product(ownerId, productId).then((product) => {
      if (!active) return;
      setSelected(product);
      setVariantId(product.variants.length === 1 ? product.variants[0].id : '');
      void recordViewed(product.id);
    }).catch(() => { if (active) setError('This product link is unavailable.'); });
    return () => { active = false; };
  }, [ownerId, params.product, params.productId, recordViewed]);

  const handleOpenProduct = (product: MarketProduct) => {
    setSelected(product);
    setVariantId(product.variants.length === 1 ? product.variants[0].id : '');
    void recordViewed(product.id);
  };
  const handleQuickAdd = (product: MarketProduct) => {
    const availableVariants = product.variants.filter((variant) => variant.available);
    if (!ownerId || !canMutate) { setError('Sign in to save products to your cart.'); return; }
    if (availableVariants.length !== 1) { handleOpenProduct(product); return; }
    const variant = availableVariants[0];
    const quantity = (visibleLines.find((line) => line.productId === product.id && line.variantId === variant.id)?.quantity ?? 0) + 1;
    void cart.setQuantity(product, variant, quantity).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'This item could not be added.'));
  };
  const handleQuantity = async (line: CartLine, quantity: number) => {
    if (!ownerId || !canMutate) throw new Error('Sign in to update this cart.');
    if (quantity === 0) { await cart.remove(line); return; }
    const product = await marketplaceService.product(ownerId, line.productId);
    const variant = product.variants.find((entry) => entry.id === line.variantId);
    if (!variant) throw new Error('Variant is unavailable. Remove this item or retry later.');
    await cart.setQuantity(product, variant, quantity);
  };
  const handleSupport = async () => {
    try {
      const destination = marketplaceService.supportDestination(await marketplaceService.support(ownerId));
      if (!destination.url) { router.push('/help'); return; }
      if (!(await Linking.canOpenURL(destination.url))) { setError(`Open your email or browser manually: ${destination.display}`); return; }
      await Linking.openURL(destination.url);
    } catch { setError('Support links could not be opened. Use Help from the main menu.'); }
  };
  const handleShare = (product: MarketProduct) => { void Share.share({ message: `${product.title}\nourlime://market?product=${encodeURIComponent(product.id)}` }); };
  const run = (operation: () => Promise<unknown>) => { void operation().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Action failed. Please retry.')); };
  const clearFilters = () => { setCondition('all'); setDeliveryOnly(false); setPickupOnly(false); setFavoritesOnly(false); setMinimum(''); setMaximum(''); };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={styles.headerTitle}><Text style={styles.title}>{entryPoint === 'ehub' ? 'E-Hub Market' : 'Lime Market'}</Text><Text style={styles.subtitle}>Shop Ourlime sellers</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Cart with ${cartUnits} items`} onPress={() => setCartOpen(true)} style={styles.cartHeaderButton}><ShoppingBag color={colors.text} size={22} />{cartUnits ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartUnits > 99 ? '99+' : cartUnits}</Text></View> : null}</Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={catalog.status === 'refreshing'} onRefresh={() => void catalog.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.content}>
      <PromotionSlider />
      <View style={styles.releaseNotice}><ShieldCheck color={colors.accentText} size={17} /><Text style={styles.releaseNoticeText}>Browsing and saved carts are available. Payments are unavailable.</Text></View>
      <View style={styles.searchRow}><View style={styles.searchBox}><Search color={colors.mutedText} size={20} /><TextInput value={search} onChangeText={setSearch} accessibilityLabel="Search marketplace titles" autoCapitalize="none" placeholder="Search products" placeholderTextColor={colors.mutedText} style={styles.searchInput} />{search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}><X color={colors.mutedText} size={18} /></Pressable> : null}</View><Pressable accessibilityRole="button" accessibilityLabel="Open filters" onPress={() => setFilterOpen(true)} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}><SlidersHorizontal color={activeFilterCount ? colors.onAccent : colors.text} size={21} />{activeFilterCount ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}</Pressable></View>
      {error || preferences.error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error || preferences.error}</Text><Pressable onPress={() => setError('')}><X size={18} color={colors.destructiveText} /></Pressable></View> : null}
      {categories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable onPress={() => setCategory('')} style={[styles.chip, !category && styles.chipActive]}><Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text></Pressable>{categories.map((categoryName) => <Pressable key={categoryName} onPress={() => setCategory(categoryName)} style={[styles.chip, category === categoryName && styles.chipActive]}><Text style={[styles.chipText, category === categoryName && styles.chipTextActive]}>{categoryName}</Text></Pressable>)}</ScrollView> : null}
      {recentProducts.length > 0 && !search && !category ? <View style={styles.section}><Text style={styles.sectionTitle}>Recently viewed</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>{recentProducts.map((product) => <Pressable key={product.id} onPress={() => handleOpenProduct(product)} style={styles.recentCard}>{product.images[0] ? <Image source={{ uri: product.images[0] }} style={styles.recentImage} /> : <View style={[styles.recentImage, { backgroundColor: colors.control }]} />}<View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.recentTitle}>{product.title}</Text><Text style={styles.recentPrice}>{priceText(product)}</Text></View><ChevronRight size={18} color={colors.mutedText} /></Pressable>)}</ScrollView></View> : null}
      <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{category || (favoritesOnly ? 'Saved products' : 'Marketplace')}</Text><Text style={styles.resultText}>{products.length} {products.length === 1 ? 'listing' : 'listings'} loaded</Text></View><Pressable onPress={() => setFilterOpen(true)} style={styles.sortButton}><Text style={styles.sortText}>{SORTS.find((entry) => entry.value === sort)?.label}</Text><ChevronDown color={colors.mutedText} size={16} /></Pressable></View>
      {catalog.error ? <Pressable onPress={() => void catalog.refresh()} style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{catalog.error.message} Tap to retry.</Text></Pressable> : null}
      {catalog.status === 'hydrating' && !catalogProducts.length ? <MarketplaceSkeleton /> : !products.length && !catalog.error ? <View style={styles.empty}><ShoppingBag color={colors.mutedText} size={42} /><Text style={styles.emptyTitle}>No listings found</Text><Text style={styles.emptyText}>Try another title, category, or filter.</Text>{activeFilterCount ? <MarketButton label="Clear filters" onPress={clearFilters} /> : null}</View> : <View style={styles.grid}>{products.map((product) => <MarketProductCard key={product.id} product={product} favorite={preferences.favoriteIds.includes(product.id)} onOpen={handleOpenProduct} onToggleFavorite={(productId) => void preferences.toggleFavorite(productId)} onQuickAdd={handleQuickAdd} />)}</View>}
      {catalog.data?.cursor ? <MarketButton label={catalog.status === 'refreshing' ? 'Loading listings…' : 'Load more listings'} disabled={catalog.status === 'refreshing'} onPress={() => void catalog.loadMore()} /> : null}
      <View style={styles.services}><Pressable onPress={() => ownerId && canMutate ? setSellerOpen(true) : router.push('/(auth)/login')} style={styles.serviceRow}><Store color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>Sell on Ourlime</Text><Text style={styles.serviceText}>{ownerId ? 'Manage your seller application' : 'Sign in to apply as a seller'}</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable><Pressable onPress={() => void handleSupport()} style={styles.serviceRow}><HelpCircle color={colors.accentText} size={21} /><View style={{ flex: 1 }}><Text style={styles.serviceTitle}>Marketplace support</Text><Text style={styles.serviceText}>Get help with listings and saved carts</Text></View><ChevronRight color={colors.mutedText} size={20} /></Pressable></View>
    </ScrollView>

    {filterOpen ? <MarketFormModal visible title="Filter and sort" onClose={() => setFilterOpen(false)}><Text style={styles.modalLabel}>Sort by</Text><View style={styles.optionWrap}>{SORTS.map((entry) => <Pressable key={entry.value} onPress={() => setSort(entry.value)} style={[styles.option, sort === entry.value && styles.optionActive]}><Text style={[styles.optionText, sort === entry.value && styles.optionTextActive]}>{entry.label}</Text></Pressable>)}</View><Text style={styles.modalLabel}>Condition</Text><View style={styles.optionWrap}>{CONDITIONS.map((entry) => <Pressable key={entry.value} onPress={() => setCondition(entry.value)} style={[styles.option, condition === entry.value && styles.optionActive]}><Text style={[styles.optionText, condition === entry.value && styles.optionTextActive]}>{entry.label}</Text></Pressable>)}</View><Text style={styles.modalLabel}>Price range</Text><View style={styles.priceInputs}><TextInput value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" placeholder="Minimum" placeholderTextColor={colors.mutedText} style={styles.priceInput} /><TextInput value={maximum} onChangeText={setMaximum} keyboardType="decimal-pad" placeholder="Maximum" placeholderTextColor={colors.mutedText} style={styles.priceInput} /></View><ToggleRow label="Delivery available" selected={deliveryOnly} onPress={() => setDeliveryOnly((value) => !value)} colors={colors} /><ToggleRow label="Pickup available" selected={pickupOnly} onPress={() => setPickupOnly((value) => !value)} colors={colors} /><ToggleRow label="Favorites only" selected={favoritesOnly} onPress={() => setFavoritesOnly((value) => !value)} colors={colors} /><MarketButton label="Show results" onPress={() => setFilterOpen(false)} /><Pressable onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearText}>Clear all filters</Text></Pressable></MarketFormModal> : null}

    {selected ? <MarketFormModal visible title={selected.title} onClose={() => setSelected(null)}><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>{selected.images.length ? selected.images.map((uri) => <Image key={uri} source={{ uri }} resizeMode="cover" style={styles.detailImage} />) : <View style={[styles.detailImage, styles.imagePlaceholder]}><ShoppingBag color={colors.mutedText} size={46} /></View>}</ScrollView><View style={styles.detailHeading}><View style={{ flex: 1 }}><Text style={styles.detailCategory}>{selected.category || 'Marketplace'}</Text><Text style={styles.detailPrice}>{priceText(selected)}</Text></View><Pressable accessibilityLabel="Favorite product" onPress={() => void preferences.toggleFavorite(selected.id)} style={styles.roundButton}><Heart size={21} color={preferences.favoriteIds.includes(selected.id) ? '#dc2626' : colors.text} fill={preferences.favoriteIds.includes(selected.id) ? '#dc2626' : 'transparent'} /></Pressable><Pressable accessibilityLabel="Share product" onPress={() => handleShare(selected)} style={styles.roundButton}><Share2 size={21} color={colors.text} /></Pressable></View>{selected.shortDescription ? <Text style={styles.detailLead}>{selected.shortDescription}</Text> : null}<View style={styles.attributeRow}>{selected.condition ? <Attribute label={selected.condition.replace('_', ' ')} colors={colors} /> : null}{selected.brand ? <Attribute label={selected.brand} colors={colors} /> : null}{selected.deliveryAvailable ? <Attribute label="Delivery" colors={colors} /> : null}{selected.pickupAvailable ? <Attribute label="Pickup" colors={colors} /> : null}</View><Text style={styles.modalLabel}>Choose a variant</Text>{selected.variants.length ? <View style={styles.variantList}>{selected.variants.map((variant) => <Pressable key={variant.id} accessibilityRole="radio" accessibilityState={{ checked: variantId === variant.id, disabled: !variant.available }} onPress={() => variant.available && setVariantId(variant.id)} style={[styles.variant, variantId === variant.id && styles.variantActive, !variant.available && styles.variantDisabled]}><View style={{ flex: 1 }}><Text style={styles.variantName}>{variant.label}</Text><Text style={styles.variantMeta}>{variant.currency ? `${variant.currency} ${variant.price.toFixed(2)}` : 'Price unavailable'} · {variant.stock} available</Text></View>{variant.colorCode ? <View style={[styles.colorDot, { backgroundColor: variant.colorCode }]} /> : null}</Pressable>)}</View> : <Text style={styles.emptyText}>No purchasable variants are available.</Text>}<MarketButton label={!ownerId ? 'Sign in to add to cart' : selectedVariant ? 'Add selected variant to cart' : 'Select an available variant'} disabled={Boolean(ownerId) && (!canMutate || !selectedVariant?.available)} onPress={() => { if (!ownerId) { setSelected(null); router.push('/(auth)/login'); return; } if (selectedVariant) run(() => cart.setQuantity(selected, selectedVariant, (visibleLines.find((line) => line.productId === selected.id && line.variantId === selectedVariant.id)?.quantity ?? 0) + 1)); }} /><View style={styles.sellerCard}><Store color={colors.accentText} size={24} /><View style={{ flex: 1 }}><View style={styles.sellerNameRow}><Text style={styles.sellerName}>{selected.sellerName}</Text>{selected.sellerVerified ? <BadgeCheck color={colors.accent} fill={colors.successSurface} size={18} /> : null}</View><Text style={styles.serviceText}>{selected.sellerVerified ? 'Approved marketplace seller' : 'Marketplace seller'}</Text></View></View><Text style={styles.modalLabel}>About this item</Text><Text style={styles.detailBody}>{selected.description || 'The seller has not provided a longer description.'}</Text>{selected.returnsAllowed !== null ? <View style={styles.infoRow}><ShieldCheck color={colors.icon} size={19} /><Text style={styles.infoText}>{selected.returnsAllowed ? selected.returnPolicy || 'Returns are accepted; ask the seller for terms.' : 'Returns are not offered for this listing.'}</Text></View> : null}{selected.warranty ? <View style={styles.infoRow}><ShieldCheck color={colors.icon} size={19} /><Text style={styles.infoText}>{selected.warranty}</Text></View> : null}{ownerId ? <ListingDiscussion ownerId={ownerId} productId={selected.id} sellerId={selected.sellerId} canMutate={canMutate} /> : <View style={styles.noticeCard}><Text style={styles.noticeText}>Sign in to join the product discussion.</Text></View>}</MarketFormModal> : null}

    {cartOpen ? <MarketFormModal visible title="Saved cart" onClose={() => setCartOpen(false)}><View style={styles.noticeCard}><Text style={styles.noticeText}>{ownerId ? `${cart.status.replaceAll('_', ' ')}. Items do not reserve stock.` : 'Sign in to save and sync a cart.'}</Text></View>{cart.error ? <Text style={styles.errorText}>{cart.error}</Text> : null}{visibleLines.length ? visibleLines.map((line) => <View key={line.id} style={styles.cartLine}>{line.image ? <Image source={{ uri: line.image }} style={styles.cartImage} /> : <View style={[styles.cartImage, { backgroundColor: colors.control }]} />}<View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={styles.cartTitle}>{line.title}</Text><Text style={styles.cartMeta}>{line.variantLabel}</Text><Text style={styles.cartPrice}>{line.currency} {(line.price * line.quantity).toFixed(2)}</Text><View style={styles.quantityRow}><Pressable accessibilityLabel="Decrease quantity" onPress={() => run(() => handleQuantity(line, line.quantity - 1))} style={styles.quantityButton}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{line.quantity}</Text><Pressable accessibilityLabel="Increase quantity" onPress={() => run(() => handleQuantity(line, line.quantity + 1))} style={styles.quantityButton}><Text style={styles.quantityText}>+</Text></Pressable><Pressable onPress={() => run(() => handleQuantity(line, 0))} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable></View></View></View>) : <View style={styles.empty}><ShoppingBag color={colors.mutedText} size={40} /><Text style={styles.emptyTitle}>Your cart is empty</Text><Text style={styles.emptyText}>Products you add will stay here until you remove them.</Text></View>}{cart.cart.conflicts.map((conflict) => <View key={conflict.mutation.id} style={styles.conflictCard}><Text style={styles.noticeText}>{conflict.mutation.line.title}: device quantity {conflict.mutation.line.quantity}; account quantity {conflict.remote.quantity}.</Text><MarketButton label="Keep device quantity" onPress={() => run(() => cart.resolve(conflict.mutation.lineId, 'local'))} /><MarketButton label="Keep account quantity" onPress={() => run(() => cart.resolve(conflict.mutation.lineId, 'remote'))} /></View>)}{ownerId ? <><MarketButton label="Save Cart / Retry sync" disabled={!canMutate} onPress={() => void cart.flush()} /><MarketButton label="Prepare checkout · payments unavailable" disabled={!canMutate || !visibleLines.length || Boolean(cart.cart.conflicts.length)} onPress={() => { setCartOpen(false); setCheckoutOpen(true); }} /></> : <MarketButton label="Sign in to save a cart" onPress={() => { setCartOpen(false); router.push('/(auth)/login'); }} />}</MarketFormModal> : null}
    {checkoutOpen && ownerId ? <CheckoutPreparationModal ownerId={ownerId} lines={visibleLines} onClose={() => setCheckoutOpen(false)} onAcceptPrice={(line) => handleQuantity(line, line.quantity)} /> : null}
    {sellerOpen ? <SellerApplicationModal onClose={() => setSellerOpen(false)} /> : null}
  </SafeAreaView>;
}

type ToggleRowProps = { label: string; selected: boolean; onPress: () => void; colors: AppThemeColors };
function ToggleRow({ label, selected, onPress, colors }: ToggleRowProps) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.successSurface : colors.surface }}><Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text><View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: selected ? colors.accent : colors.control, alignItems: 'center', justifyContent: 'center' }}>{selected ? <Text style={{ color: colors.onAccent, fontWeight: '900' }}>✓</Text> : null}</View></Pressable>; }
type AttributeProps = { label: string; colors: AppThemeColors };
function Attribute({ label, colors }: AttributeProps) { return <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{label}</Text></View>; }

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.text, fontSize: 32, lineHeight: 35 }, headerTitle: { flex: 1 }, title: { color: colors.text, fontSize: 21, fontWeight: '900' }, subtitle: { color: colors.mutedText, fontSize: 11, marginTop: 1 }, cartHeaderButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }, cartBadge: { position: 'absolute', right: -2, top: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#dc2626' }, cartBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 36, gap: 16 }, releaseNotice: { padding: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent }, releaseNoticeText: { flex: 1, color: colors.accentText, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10 }, searchBox: { flex: 1, minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, color: colors.text, fontSize: 15 }, filterButton: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent }, filterCount: { position: 'absolute', right: -3, top: -5, minWidth: 19, height: 19, borderRadius: 10, textAlign: 'center', color: '#ffffff', backgroundColor: '#dc2626', fontSize: 10, fontWeight: '900', lineHeight: 19 },
  chips: { gap: 8, paddingRight: 14 }, chip: { minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.accent, borderColor: colors.accent }, chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.onAccent }, section: { gap: 10 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, resultText: { color: colors.mutedText, fontSize: 11, marginTop: 2 }, sortButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, sortText: { color: colors.secondaryText, fontSize: 11, fontWeight: '700' }, recentRow: { gap: 10 }, recentCard: { width: 235, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, recentImage: { width: 48, height: 48, borderRadius: 10 }, recentTitle: { color: colors.text, fontSize: 12, fontWeight: '800' }, recentPrice: { color: colors.accentText, fontSize: 11, fontWeight: '700', marginTop: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  errorCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.destructiveSurface }, errorText: { flex: 1, color: colors.destructiveText, lineHeight: 18 }, empty: { paddingVertical: 38, paddingHorizontal: 18, alignItems: 'center', gap: 9 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, emptyText: { color: colors.mutedText, textAlign: 'center', lineHeight: 19 }, services: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, serviceRow: { minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, serviceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, serviceText: { color: colors.mutedText, fontSize: 11, lineHeight: 16, marginTop: 2 },
  modalLabel: { color: colors.text, fontSize: 16, fontWeight: '900' }, optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 42, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, optionActive: { backgroundColor: colors.successSurface, borderColor: colors.accent }, optionText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' }, optionTextActive: { color: colors.accentText }, priceInputs: { flexDirection: 'row', gap: 10 }, priceInput: { flex: 1, minHeight: 48, paddingHorizontal: 13, color: colors.text, borderRadius: 12, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }, clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, clearText: { color: colors.accentText, fontWeight: '800' },
  gallery: { marginHorizontal: -20 }, detailImage: { width: 360, maxWidth: 420, height: 310, backgroundColor: colors.control }, imagePlaceholder: { alignItems: 'center', justifyContent: 'center' }, detailHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, detailCategory: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, detailPrice: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 4 }, roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control }, detailLead: { color: colors.secondaryText, fontSize: 15, lineHeight: 22 }, attributeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, variantList: { gap: 8 }, variant: { minHeight: 62, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }, variantActive: { borderColor: colors.accent, backgroundColor: colors.successSurface }, variantDisabled: { opacity: 0.48 }, variantName: { color: colors.text, fontSize: 14, fontWeight: '800' }, variantMeta: { color: colors.mutedText, fontSize: 11, marginTop: 3 }, colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border }, sellerCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, sellerName: { color: colors.text, fontSize: 15, fontWeight: '900' }, detailBody: { color: colors.secondaryText, fontSize: 14, lineHeight: 22 }, infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, infoText: { flex: 1, color: colors.secondaryText, lineHeight: 19 }, noticeCard: { padding: 12, borderRadius: 13, backgroundColor: colors.warningSurface }, noticeText: { color: colors.warningText, lineHeight: 18 },
  cartLine: { padding: 10, flexDirection: 'row', gap: 11, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, cartImage: { width: 78, height: 78, borderRadius: 11 }, cartTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, cartMeta: { color: colors.mutedText, fontSize: 11 }, cartPrice: { color: colors.accentText, fontSize: 13, fontWeight: '900' }, quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }, quantityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.control }, quantityText: { color: colors.text, fontSize: 20, fontWeight: '700' }, quantityValue: { minWidth: 24, color: colors.text, textAlign: 'center', fontWeight: '900' }, removeButton: { minHeight: 34, paddingHorizontal: 7, justifyContent: 'center' }, removeText: { color: colors.destructiveText, fontSize: 11, fontWeight: '800' }, conflictCard: { padding: 12, gap: 9, borderRadius: 14, backgroundColor: colors.warningSurface },
});
