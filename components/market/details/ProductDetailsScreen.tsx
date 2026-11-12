import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ArrowRight, BadgeCheck, ChevronRight, Flag, Globe, Mail, MapPin, Phone, RotateCcw, Share2, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAccountCart } from '@/lib/hooks/useAccountCart';
import { useMarketplacePreferences } from '@/lib/hooks/useMarketplacePreferences';
import { useMarketProductDetail } from '@/lib/hooks/useMarketProductDetail';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { marketListingDetailService } from '@/lib/services/MarketListingDetailService';
import type { MarketContactItem, MarketProduct, MarketVariant } from '@/lib/types/reliability';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import { ProductDetailsSkeleton } from '../MarketSkeletons';
import ReportPostModal from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ReportPostModal';
import ListingDiscussion from '../ListingDiscussion';
import MarketProductCard from '../MarketProductCard';
import QuantityStepper from '../QuantityStepper';
import MarketCartModal from '../cart/MarketCartModal';
import ProductReviewsSection from '../reviews/ProductReviewsSection';
import ProductGallery from './ProductGallery';

type ProductDetailsScreenProps = { productId: string };
type PickerOption = { id: string; name: string; code: string | null };

const CONTACT_ICONS = { phone: Phone, email: Mail, website: Globe } as const;

/** Distinct colour / size options of the listing's variants, in variant order. */
function optionsOf(variants: MarketVariant[], kind: 'color' | 'size'): PickerOption[] {
  const options = new Map<string, PickerOption>();
  variants.forEach((variant) => {
    const id = kind === 'color' ? variant.colorVariantId : variant.sizeVariantId;
    const name = kind === 'color' ? variant.colorName : variant.sizeName;
    if (id && name && !options.has(id)) options.set(id, { id, name, code: kind === 'color' ? variant.colorCode : null });
  });
  return [...options.values()];
}

/** Web ProductDetailsContent activeVariant: colour + size, either one, or the first variant. */
function resolveVariant(variants: MarketVariant[], colorId: string, sizeId: string, flatId: string): MarketVariant | null {
  if (!variants.length) return null;
  if (flatId) return variants.find((variant) => variant.id === flatId) ?? null;
  if (colorId && sizeId) return variants.find((variant) => variant.colorVariantId === colorId && variant.sizeVariantId === sizeId) ?? null;
  if (colorId) return variants.find((variant) => variant.colorVariantId === colorId) ?? null;
  if (sizeId) return variants.find((variant) => variant.sizeVariantId === sizeId) ?? null;
  return variants[0];
}

export default function ProductDetailsScreen({ productId }: ProductDetailsScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile, getDecision } = usePageAccess();
  const ownerId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const cart = useAccountCart(ownerId);
  const preferences = useMarketplacePreferences();
  const recordViewed = preferences.recordViewed;
  const detail = useMarketProductDetail(ownerId, productId);
  const product = detail.product;
  const [colorId, setColorId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [flatId, setFlatId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const variants = useMemo(() => product?.variants ?? [], [product]);
  const colorOptions = useMemo(() => optionsOf(variants, 'color'), [variants]);
  const sizeOptions = useMemo(() => optionsOf(variants, 'size'), [variants]);
  const usesFlatList = variants.length > 1 && !colorOptions.length && !sizeOptions.length;

  useEffect(() => {
    if (!product) return;
    void recordViewed(product.id);
    const first = product.variants.find((variant) => variant.available) ?? product.variants[0];
    setColorId(first?.colorVariantId ?? '');
    setSizeId(first?.sizeVariantId ?? '');
    setFlatId(product.variants.length > 1 && !optionsOf(product.variants, 'color').length && !optionsOf(product.variants, 'size').length ? first?.id ?? '' : '');
    setQuantity(1);
  }, [product, recordViewed]);

  const activeVariant = resolveVariant(variants, colorId, sizeId, flatId);
  const availableStock = activeVariant?.available ? activeVariant.stock : 0;
  const isOutOfStock = !product?.available || availableStock <= 0;
  const visibleLines = cart.cart.lines.filter((line) => !line.removed);
  const cartUnits = visibleLines.reduce((total, line) => total + line.quantity, 0);
  const inCart = activeVariant ? visibleLines.find((line) => line.productId === productId && line.variantId === activeVariant.id)?.quantity ?? 0 : 0;

  useEffect(() => { setQuantity((current) => Math.max(1, Math.min(current, Math.max(1, availableStock)))); }, [availableStock]);

  const addToCart = async (): Promise<boolean> => {
    if (!product) return false;
    if (!ownerId) { router.push('/(auth)/login'); return false; }
    if (!canMutate) { setMessage({ tone: 'error', text: 'Your account cannot change the cart right now.' }); return false; }
    if (!activeVariant || isOutOfStock) { setMessage({ tone: 'error', text: 'This product is out of stock.' }); return false; }
    setBusy(true); setMessage(null);
    try {
      await cart.setQuantity(product, activeVariant, Math.min(availableStock, 99, inCart + quantity));
      setMessage({ tone: 'success', text: `Added ${quantity} to your cart.` });
      return true;
    } catch (failure: unknown) {
      setMessage({ tone: 'error', text: failure instanceof Error ? failure.message : 'This item could not be added.' });
      return false;
    } finally { setBusy(false); }
  };
  const handleBuyNow = async () => { if (await addToCart()) router.push('/market/checkout' as Href); };
  const handleShare = () => { if (product) void Share.share({ message: `${product.title}\n${deepLinkService.getMarketProductShareUrl(product.id)}` }); };
  const openContact = (contact: MarketContactItem) => {
    const url = contact.type === 'phone' ? `tel:${contact.value.replace(/[^\d+]/g, '')}` : contact.type === 'email' ? `mailto:${contact.value}` : /^https?:\/\//i.test(contact.value) ? contact.value : `https://${contact.value}`;
    void Linking.openURL(url).catch(() => setMessage({ tone: 'error', text: `Open ${contact.value} manually.` }));
  };

  const header = <View style={styles.header}>
    <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/market')} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
    <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.headerTitle}>{product?.title ?? 'Listing'}</Text><Text numberOfLines={1} style={styles.headerSubtitle}>{product?.category || 'Lime Market'}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Cart with ${cartUnits} items`} onPress={() => setCartOpen(true)} style={styles.cartButton}><ShoppingBag color={colors.text} size={22} />{cartUnits ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartUnits > 99 ? '99+' : cartUnits}</Text></View> : null}</Pressable>
  </View>;

  if (!product) {
    return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      {header}
      {detail.productError ? <View style={styles.empty}><ShoppingBag color={colors.mutedText} size={42} /><Text style={styles.emptyTitle}>Listing unavailable</Text><Text style={styles.emptyText}>{detail.productError}</Text><Pressable onPress={() => router.replace('/market')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Back to Market</Text></Pressable></View>
        : <ProductDetailsSkeleton />}
    </SafeAreaView>;
  }

  const unitPrice = activeVariant?.price ?? product.salePrice ?? product.originalPrice ?? 0;
  const currency = activeVariant?.currency ?? '';
  const seller = detail.seller;
  const sellerName = seller?.name ?? product.sellerName;
  const isVerifiedShop = (seller?.sellerType ?? product.sellerType) === 'business' || product.sellerVerified;
  const contacts = marketListingDetailService.mergeContacts(product.contactInfo ?? [], seller?.contact ?? {});
  const ratingCount = product.ratingCount || detail.reviews.length;
  const rating = ratingCount > 0 ? product.rating ?? 0 : 0;
  const badges = [
    ...(product.isOnSale && product.originalPrice !== null && product.originalPrice > unitPrice ? [`Save ${formatMarketPrice(currency, product.originalPrice - unitPrice)}`] : []),
    ...(product.condition ? [product.condition.replace(/_/g, ' ')] : []),
  ];
  const shippingCost = product.shippingCost ?? 0;
  const sku = activeVariant?.sku ?? product.sku;
  const specs: [string, string][] = [['Condition', product.condition?.replace(/_/g, ' ') ?? 'New']];
  if (product.brand) specs.push(['Brand', product.brand]);
  if (sku) specs.push(['SKU', sku]);
  if (product.warranty) specs.push(['Warranty', product.warranty]);
  if (product.dimensions) specs.push(['Dimensions', `${[product.dimensions.length, product.dimensions.width, product.dimensions.height].map((value) => value ?? '–').join(' × ')}${product.dimensions.unit ? ` ${product.dimensions.unit}` : ''}`]);
  if (product.weight) specs.push(['Weight', `${product.weight.value ?? ''}${product.weight.unit ? ` ${product.weight.unit}` : ''}`]);
  specs.push(['Listed Date', product.createdAtMs ? new Date(product.createdAtMs).toLocaleDateString() : 'Recent']);
  const sellerImage = seller?.profileImage ?? product.sellerProfileImage ?? null;
  // Web breadcrumb / "View All": `/market?categories=<category>`.
  const openCategory = () => { if (product.category) router.push(`/market?categories=${encodeURIComponent(product.category)}` as Href); };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    {header}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.breadcrumb} accessibilityRole="header">
        <Pressable accessibilityRole="link" accessibilityLabel="Marketplace" onPress={() => router.push('/market' as Href)} hitSlop={8}><Text style={styles.breadcrumbLink}>Marketplace</Text></Pressable>
        {product.category ? <><ChevronRight size={12} color={colors.mutedText} />
          <Pressable accessibilityRole="link" accessibilityLabel={`More in ${product.category}`} onPress={openCategory} hitSlop={8}><Text style={styles.breadcrumbLink}>{product.category}</Text></Pressable></> : null}
        <ChevronRight size={12} color={colors.mutedText} />
        <Text numberOfLines={1} style={styles.breadcrumbCurrent}>{product.title}</Text>
      </View>
      <ProductGallery title={product.title} media={product.images} favorite={preferences.favoriteIds.includes(product.id)} onToggleFavorite={() => void preferences.toggleFavorite(product.id)} badges={badges} />

      <View style={{ gap: 8 }}>
        <View style={styles.rowBetween}>
          <Pressable accessibilityRole="link" accessibilityLabel={`Browse ${product.category || 'Marketplace'}`} onPress={product.category ? openCategory : () => router.push('/market' as Href)} style={styles.categoryChip}><Text style={styles.categoryText}>{product.category || 'Marketplace'}</Text></Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Share listing" onPress={handleShare} style={styles.roundButton}><Share2 size={19} color={colors.text} /></Pressable>
            {ownerId ? <Pressable accessibilityRole="button" accessibilityLabel="Report listing" onPress={() => setReportOpen(true)} style={styles.roundButton}><Flag size={19} color={colors.destructiveText} /></Pressable> : null}
          </View>
        </View>
        <Text style={styles.title}>{product.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {rating > 0 ? <Text style={styles.meta}>★ {rating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})</Text> : <Text style={styles.meta}>No reviews yet</Text>}
          <Text style={styles.meta}>• ID: #{product.id.slice(0, 8)}</Text>
        </View>
      </View>

      <View style={styles.priceCard}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Text style={styles.price}>{formatMarketPrice(currency, unitPrice)}</Text>
          {product.originalPrice !== null && product.originalPrice > unitPrice ? <Text style={styles.originalPrice}>{formatMarketPrice(currency, product.originalPrice)}</Text> : null}
        </View>
        <View style={[styles.stockBadge, { backgroundColor: isOutOfStock ? colors.destructiveSurface : colors.successSurface }]}>
          <Text style={{ color: isOutOfStock ? colors.destructiveText : colors.accentText, fontSize: 12, fontWeight: '800' }}>{!product.available ? product.unavailableReason ?? 'Unavailable' : isOutOfStock ? 'Out of Stock' : `In Stock (${availableStock} available)`}</Text>
        </View>
      </View>

      {product.shortDescription ? <Text style={styles.lead}>{product.shortDescription}</Text> : null}

      {colorOptions.length ? <View style={{ gap: 8 }}>
        <Text style={styles.label}>Color: <Text style={{ color: colors.text }}>{colorOptions.find((option) => option.id === colorId)?.name ?? ''}</Text></Text>
        <View style={styles.optionWrap}>{colorOptions.map((option) => {
          const selected = option.id === colorId;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setColorId(option.id)} style={[styles.option, selected && styles.optionActive]}>
            <View style={[styles.swatch, { backgroundColor: option.code ?? option.name.toLowerCase() }]} />
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.name}</Text>
          </Pressable>;
        })}</View>
      </View> : null}
      {sizeOptions.length ? <View style={{ gap: 8 }}>
        <Text style={styles.label}>Size: <Text style={{ color: colors.text }}>{sizeOptions.find((option) => option.id === sizeId)?.name ?? ''}</Text></Text>
        <View style={styles.optionWrap}>{sizeOptions.map((option) => {
          const selected = option.id === sizeId;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setSizeId(option.id)} style={[styles.option, selected && styles.optionActive]}>
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.name}</Text>
          </Pressable>;
        })}</View>
      </View> : null}
      {usesFlatList ? <View style={{ gap: 8 }}>
        <Text style={styles.label}>Option</Text>
        <View style={styles.optionWrap}>{variants.map((variant) => {
          const selected = variant.id === flatId;
          return <Pressable key={variant.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !variant.available }} onPress={() => setFlatId(variant.id)} style={[styles.option, selected && styles.optionActive, !variant.available && { opacity: 0.5 }]}>
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>{variant.label}</Text>
          </Pressable>;
        })}</View>
      </View> : null}
      {(colorOptions.length || sizeOptions.length) && !activeVariant ? <Text style={{ color: colors.destructiveText }}>This combination is not available. Choose another colour or size.</Text> : null}

      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Quantity</Text>
        <QuantityStepper value={quantity} canDecrease={quantity > 1 && !isOutOfStock} canIncrease={quantity < Math.min(availableStock, 99) && !isOutOfStock} onDecrease={() => setQuantity((value) => Math.max(1, value - 1))} onIncrease={() => setQuantity((value) => Math.min(availableStock, 99, value + 1))} />
        {inCart ? <Text style={styles.meta}>{inCart} already in your cart.</Text> : null}
        {message ? <Text accessibilityRole="alert" style={{ color: message.tone === 'error' ? colors.destructiveText : colors.accentText, fontWeight: '700' }}>{message.text}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy || (Boolean(ownerId) && isOutOfStock)} onPress={() => void addToCart()} style={[styles.secondaryButton, (busy || (Boolean(ownerId) && isOutOfStock)) && { opacity: 0.5 }]}>
          <ShoppingBag size={18} color={colors.text} /><Text style={styles.secondaryButtonText}>{!ownerId ? 'Sign in to add to cart' : busy ? 'Adding…' : 'Add to Cart'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || isOutOfStock} onPress={() => void handleBuyNow()} style={[styles.primaryButton, (busy || isOutOfStock) && { opacity: 0.5 }]}>
          <Text style={styles.primaryButtonText}>Buy Now</Text><ArrowRight size={18} color={colors.onAccent} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.infoTile}>
          <Truck size={18} color={colors.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>{product.deliveryAvailable === false ? 'Pickup Only' : 'Delivery'}</Text>
            <Text style={styles.infoText}>{product.deliveryAvailable === false ? 'Collect from seller directly' : `Est. ${product.estimatedShippingDays || 3} days (${shippingCost === 0 ? 'Free' : formatMarketPrice(currency, shippingCost)})`}</Text>
          </View>
        </View>
        <View style={styles.infoTile}>
          <RotateCcw size={18} color="#3b82f6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>{product.returnsAllowed ? 'Returns Policy' : 'Final Sale'}</Text>
            <Text style={styles.infoText}>{product.returnsAllowed ? product.returnPolicy || 'Standard 14-day return' : 'No returns accepted'}</Text>
          </View>
        </View>
      </View>
      {product.pickupAvailable ? <View style={styles.inlineRow}><MapPin size={16} color={colors.accentText} /><Text style={styles.infoText}>Direct pickup is available from the seller.</Text></View> : null}
      {product.refundPolicy ? <View style={styles.inlineRow}><ShieldCheck size={16} color={colors.icon} /><Text style={styles.infoText}>Refund policy: {product.refundPolicy}</Text></View> : null}

      <View style={styles.sellerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {sellerImage ? <Image source={{ uri: sellerImage }} style={styles.sellerImage} /> : <View style={[styles.sellerImage, { alignItems: 'center', justifyContent: 'center' }]}><Store color={colors.accentText} size={22} /></View>}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.sellerName}>{sellerName}</Text>
              {isVerifiedShop ? <View style={styles.verifiedChip}><BadgeCheck size={12} color={colors.accentText} /><Text style={styles.verifiedText}>Verified Shop</Text></View> : null}
            </View>
            <Text style={styles.infoText}>{seller?.location ?? 'Trinidad & Tobago'}</Text>
          </View>
        </View>
        {seller?.description ? <Text style={styles.infoText}>{seller.description}</Text> : null}
        {contacts.length ? <View style={{ gap: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {contacts.map((contact) => {
            const Icon = CONTACT_ICONS[contact.type];
            return <Pressable key={contact.type} accessibilityRole="link" onPress={() => openContact(contact)} style={styles.contactRow}><Icon size={15} color={colors.accentText} /><Text style={styles.contactText}>{contact.value}</Text></Pressable>;
          })}
        </View> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>Product Description</Text>
        <Text style={styles.body}>{product.description || product.shortDescription || 'The seller has not provided a longer description.'}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>Specifications</Text>
        <View style={styles.specCard}>{specs.map(([label, value], index) => <View key={label} style={[styles.specRow, index < specs.length - 1 && styles.specDivider]}><Text style={styles.specLabel}>{label}</Text><Text style={styles.specValue}>{value}</Text></View>)}</View>
      </View>
      {product.tags.length ? <View style={styles.optionWrap}>{product.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>#{tag}</Text></View>)}</View> : null}

      <ProductReviewsSection productId={product.id} productTitle={product.title} reviews={detail.reviews} loading={detail.reviewsLoading} error={detail.reviewsError}
        averageRating={product.rating} ratingCount={product.ratingCount} canWrite={Boolean(ownerId) && canMutate && ownerId !== product.sellerId}
        onRetry={detail.reloadReviews} onReviewAdded={detail.reloadReviews} />

      {ownerId ? <ListingDiscussion ownerId={ownerId} productId={product.id} sellerId={product.sellerId} canMutate={canMutate} /> : <View style={styles.notice}><Text style={styles.noticeText}>Sign in to join the product discussion.</Text></View>}

      {detail.related.length ? <View style={{ gap: 10 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1}>More in {product.category}</Text>
          {product.category ? <Pressable accessibilityRole="link" accessibilityLabel={`View all in ${product.category}`} onPress={openCategory} hitSlop={8}><Text style={styles.breadcrumbLink}>View All</Text></Pressable> : null}
        </View>
        <View style={styles.grid}>{detail.related.map((related: MarketProduct) => <MarketProductCard key={related.id} product={related} favorite={preferences.favoriteIds.includes(related.id)}
          onOpen={(entry) => router.push(`/market/${encodeURIComponent(entry.id)}` as Href)} onToggleFavorite={(id) => void preferences.toggleFavorite(id)} onQuickAdd={(entry) => router.push(`/market/${encodeURIComponent(entry.id)}` as Href)} />)}</View>
      </View> : null}
    </ScrollView>
    {cartOpen ? <MarketCartModal ownerId={ownerId} canMutate={canMutate} cart={cart} onClose={() => setCartOpen(false)} /> : null}
    {reportOpen ? <ReportPostModal visible onClose={() => setReportOpen(false)} target={{
      // market_product: the website's listing report type; moderation actions apply to the `products` listing.
      contentType: 'market_product', targetId: product.id, reportedUserId: product.sellerId || undefined,
      routePath: `/market/${product.id}`, previewText: product.title, label: 'Listing',
    }} /> : null}
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, headerSubtitle: { color: colors.mutedText, fontSize: 11 },
  cartButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  cartBadge: { position: 'absolute', right: -2, top: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#dc2626' }, cartBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 40, gap: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent }, categoryText: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 30 }, meta: { color: colors.mutedText, fontSize: 12 },
  priceCard: { padding: 15, gap: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  price: { color: colors.text, fontSize: 28, fontWeight: '900' }, originalPrice: { color: colors.mutedText, fontSize: 15, textDecorationLine: 'line-through' },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  lead: { color: colors.secondaryText, fontSize: 15, lineHeight: 22 }, label: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.successSurface }, optionText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' }, optionTextActive: { color: colors.accentText },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.accent }, primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 2, borderColor: colors.text }, secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  infoTile: { flex: 1, padding: 12, flexDirection: 'row', gap: 9, borderRadius: 16, backgroundColor: colors.surface },
  infoTitle: { color: colors.text, fontSize: 12, fontWeight: '900' }, infoText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sellerCard: { padding: 14, gap: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sellerImage: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.control }, sellerName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface }, verifiedText: { color: colors.accentText, fontSize: 10, fontWeight: '800' },
  contactRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 }, contactText: { color: colors.accentText, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  breadcrumbLink: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  breadcrumbCurrent: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, body: { color: colors.secondaryText, fontSize: 14, lineHeight: 22 },
  specCard: { paddingHorizontal: 13, borderRadius: 16, backgroundColor: colors.surface }, specRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  specDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, specLabel: { color: colors.mutedText, fontSize: 12 }, specValue: { color: colors.text, fontSize: 12, fontWeight: '800', textTransform: 'capitalize', flexShrink: 1, textAlign: 'right' },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.control }, tagText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  notice: { padding: 12, borderRadius: 13, backgroundColor: colors.warningSurface }, noticeText: { color: colors.warningText },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 }, emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, emptyText: { color: colors.mutedText, textAlign: 'center' },
});
