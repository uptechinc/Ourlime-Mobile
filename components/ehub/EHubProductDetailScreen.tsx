import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BadgeCheck, ChevronRight, Info, Package, RotateCcw, ShieldCheck, Star, Store, Truck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubProduct } from '@/lib/hooks/useEHub';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import { getEHubCurrentPrice, normalizeEHubSalePrice } from '@/lib/services/EHubCommerceService';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { useAddedFlash } from '@/lib/hooks/useAddedFlash';
import { EHubCartSheet } from '@/components/ehub/EHubCommerceParts';
import { EHubEmptyState, EHubNotice, formatEHubPrice, useEHubLayout } from '@/components/ehub/EHubParts';
import { EHubProductDetailSkeleton } from '@/components/ehub/EHubSkeletons';
import SellerCouriersPanel from '@/components/market/couriers/SellerCouriersPanel';
import ProductGallery from '@/components/ehub/productDetail/ProductGallery';
import { PRODUCT_TOP_BAR_HEIGHT, ProductBottomBar, ProductTopBar } from '@/components/ehub/productDetail/ProductDetailBars';
import {
  PRODUCT_DETAIL_GUTTER, ProductDetailSection, ProductExpandableText, ProductInfoRow, ProductOptionPicker, ProductQuantityStepper,
  ProductRail, ProductSellerCard, ProductSpecList, describeProductStock, getDiscountPercent, type ProductSpec,
} from '@/components/ehub/productDetail/ProductDetailParts';

/** Wide screens (960+) put the gallery and the buying column side by side, capped at this width. */
const WIDE_MAXIMUM_WIDTH = 1080;
const MAXIMUM_GALLERY_HEIGHT = 560;

/**
 * The website's /ehub/products/[productId], laid out like a native shopping app: a full-bleed photo gallery under a
 * floating header, then store, title, rating, price and stock, option chips and quantity, delivery and pickup, the
 * seller, description, details, policies and related products, with a sticky price + "Add to cart" bar.
 */
export default function EHubProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resource = useEHubProduct(productId);
  const detail = resource.data;
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPastGallery, setIsPastGallery] = useState(false);
  const { addToCart, addRecentlyViewed } = useEHubCommerce();
  // Adding confirms in place (button, badge, toast with "View cart") instead of covering the product with the cart.
  const added = useAddedFlash();
  const images = useMemo(() => detail ? [...new Set([detail.product.imageUrl, ...detail.product.imageUrls].filter((image): image is string => Boolean(image)))] : [], [detail]);

  // Recorded like the website (newest first, at most 10); not shown anywhere yet.
  const viewedProduct = detail?.product ?? null;
  useEffect(() => {
    if (!viewedProduct) return;
    addRecentlyViewed({ id: viewedProduct.id, title: viewedProduct.title, imageUrl: viewedProduct.imageUrl ?? '', price: getEHubCurrentPrice(viewedProduct.price, viewedProduct.salePrice), category: viewedProduct.category });
  }, [addRecentlyViewed, viewedProduct]);

  // Keep the quantity inside the stock after a refresh lowers it.
  const inventory = detail?.product.inventory ?? 0;
  useEffect(() => { setQuantity((current) => Math.max(1, Math.min(current, inventory))); }, [inventory]);

  const isWide = layout.isWide;
  const headerHeight = insets.top + PRODUCT_TOP_BAR_HEIGHT;
  const galleryWidth = isWide ? Math.floor((Math.min(layout.width, WIDE_MAXIMUM_WIDTH) - PRODUCT_DETAIL_GUTTER * 3) * 0.52) : layout.width;
  const galleryHeight = isWide ? galleryWidth : Math.min(layout.width, MAXIMUM_GALLERY_HEIGHT);
  const isHeaderSolid = isWide || isPastGallery || !detail;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isWide) return;
    const isPast = event.nativeEvent.contentOffset.y > galleryHeight - headerHeight - 8;
    if (isPast !== isPastGallery) setIsPastGallery(isPast);
  };

  const providerId = detail ? detail.store.providerId || detail.store.businessId : '';
  const handleOpenProduct = (nextProductId: string) => router.push(`/ehub/products/${encodeURIComponent(nextProductId)}` as Href);
  const handleViewStore = () => { if (providerId) router.push(`/ehub/providers/${encodeURIComponent(providerId)}` as Href); };
  const handleOpenShop = () => router.dismissTo(`/ehub?section=products&jump=${Date.now()}` as Href);
  const handleEnquire = () => {
    if (!detail) return;
    const options = [selectedVariant, selectedSize, selectedColour].filter(Boolean).join(', ');
    const productLabel = options ? `${detail.product.title} (${options})` : detail.product.title;
    router.push(`/ehub/providers/${encodeURIComponent(providerId)}?product=${encodeURIComponent(productLabel)}` as Href);
  };
  const handleAddToCart = () => {
    if (!detail || detail.product.inventory <= 0) return;
    const { product, store } = detail;
    const isAdded = addToCart({
      productId: product.id, title: product.title, imageUrl: product.imageUrl ?? '', price: getEHubCurrentPrice(product.price, product.salePrice),
      originalPrice: normalizeEHubSalePrice(product.salePrice, product.price) !== null ? product.price : null, quantity,
      availableQuantity: product.inventory, sellerId: product.storeId, sellerName: store.storeName, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, selectedVariant: selectedVariant || null, selectedSize: selectedSize || null, selectedColour: selectedColour || null,
    }, { onViewCart: () => setIsCartOpen(true) });
    if (isAdded) added.flash();
  };
  const handleShare = () => {
    if (!detail) return;
    const url = `https://ourlime.com/ehub/products/${encodeURIComponent(detail.product.id)}`;
    // Only the link: WhatsApp and other apps build the preview (name, price, photo) from the product page's metadata.
    const content = Platform.OS === 'ios' ? { title: detail.product.title, url } : { title: detail.product.title, message: url };
    void Share.share(content).catch((error: unknown) => {
      console.error('[EHubProductDetailScreen.handleShare] Error:', error instanceof Error ? error.message : 'Share failed');
    });
  };

  const statusBar = <StatusBar style={isHeaderSolid ? (isDark ? 'light' : 'dark') : 'light'} />;
  const cartSheet = <EHubCartSheet visible={isCartOpen} onClose={() => setIsCartOpen(false)} onOpenProduct={handleOpenProduct} />;

  if (!detail) {
    const plainHeader = <ProductTopBar title="Product" isSolid isFloating={false} onBack={() => router.back()} onOpenCart={() => setIsCartOpen(true)} />;
    return <View style={styles.screen}>
      {statusBar}{plainHeader}
      {resource.isLoading ? <EHubProductDetailSkeleton /> : <View style={styles.stateBody}>
        {resource.error ? <EHubNotice tone="error" text={resource.error} actionLabel="Try again" onAction={() => void resource.refresh()} />
          : <EHubEmptyState icon={<Package size={46} color={colors.mutedText} />} title="Product unavailable" body="This product is unavailable, unpublished, or no longer offered by an active E-Hub store." actionLabel="Browse E-Hub products" onAction={() => router.replace('/ehub' as Href)} />}
      </View>}
      {cartSheet}
    </View>;
  }

  const { product, store } = detail;
  const isAvailable = product.inventory > 0;
  const currentPrice = getEHubCurrentPrice(product.price, product.salePrice);
  const originalPrice = normalizeEHubSalePrice(product.salePrice, product.price) !== null ? product.price : null;
  const discountPercent = originalPrice !== null ? getDiscountPercent(currentPrice, originalPrice) : null;
  const stock = describeProductStock(product.inventory);
  const stockColor = stock.tone === 'positive' ? colors.accentText : stock.tone === 'low' ? colors.warningText : colors.destructiveText;
  const stockDotColor = stock.tone === 'positive' ? colors.accent : stock.tone === 'low' ? '#f59e0b' : colors.destructive;
  const hasRating = store.rating !== null && store.reviewCount > 0;
  const specs: ProductSpec[] = [
    { label: 'Category', value: product.category },
    ...(product.brand ? [{ label: 'Brand', value: product.brand }] : []),
    ...(product.variants.length ? [{ label: 'Variants', value: product.variants.join(', ') }] : []),
    ...(product.sku ? [{ label: 'SKU', value: product.sku }] : []),
    ...(product.warrantyInformation ? [{ label: 'Warranty', value: product.warrantyInformation }] : []),
  ];
  const railCardWidth = layout.isTablet ? 200 : Math.floor((layout.width - PRODUCT_DETAIL_GUTTER * 2 - 12) / 2.3);

  const summary = <View style={[styles.summary, isWide && styles.wideCard]}>
    <View style={styles.breadcrumb}>
      <Pressable accessibilityRole="link" accessibilityLabel="Back to the E-Hub shop" onPress={handleOpenShop} hitSlop={8} style={styles.crumbButton}><Text style={styles.crumbLink}>Shop</Text></Pressable>
      <ChevronRight size={14} color={colors.mutedText} />
      <Text numberOfLines={1} style={styles.crumbText}>{product.category}</Text>
    </View>
    <Pressable accessibilityRole="link" accessibilityLabel={`Sold by ${store.storeName}${store.isVerified ? ', verified' : ''}. View store`} onPress={handleViewStore} hitSlop={4} style={styles.storeLink}>
      <Store size={15} color={colors.accentText} />
      <Text numberOfLines={1} style={styles.storeLinkText}>{store.storeName}</Text>
      {store.isVerified ? <BadgeCheck size={15} color={colors.accentText} /> : null}
    </Pressable>
    <Text accessibilityRole="header" style={styles.title}>{product.title}</Text>
    {hasRating ? <Pressable accessibilityRole="link" accessibilityLabel={`Seller rated ${store.rating?.toFixed(1)} out of 5 from ${store.reviewCount} reviews. View store`} onPress={handleViewStore} style={styles.ratingRow}>
      <Star size={15} color="#f59e0b" fill="#f59e0b" />
      <Text style={styles.ratingValue}>{store.rating?.toFixed(1)}</Text>
      <Text style={styles.ratingCount}>({store.reviewCount} seller {store.reviewCount === 1 ? 'review' : 'reviews'})</Text>
    </Pressable> : null}
    <View style={styles.priceRow}>
      <Text style={styles.price}>{formatEHubPrice(currentPrice)}</Text>
      {originalPrice !== null ? <Text accessibilityLabel={`was ${formatEHubPrice(originalPrice)}`} style={styles.oldPrice}>{formatEHubPrice(originalPrice)}</Text> : null}
      {discountPercent !== null ? <View style={styles.discountBadge}><Text style={styles.discountText}>{discountPercent}% off</Text></View> : null}
    </View>
    <View style={styles.stockRow}>
      <View style={[styles.stockDot, { backgroundColor: stockDotColor }]} />
      <Text style={[styles.stockText, { color: stockColor }]}>{stock.label}</Text>
      {stock.detail ? <Text style={styles.stockDetail}>· {stock.detail}</Text> : null}
    </View>

    {product.variants.length || product.sizes.length || product.colours.length || isAvailable ? <View style={styles.options}>
      {product.variants.length ? <ProductOptionPicker label="Variant" values={product.variants} selectedValue={selectedVariant} isDisabled={!isAvailable} onSelect={setSelectedVariant} /> : null}
      {product.sizes.length ? <ProductOptionPicker label="Size" values={product.sizes} selectedValue={selectedSize} isDisabled={!isAvailable} onSelect={setSelectedSize} /> : null}
      {product.colours.length ? <ProductOptionPicker label="Colour" values={product.colours} selectedValue={selectedColour} isDisabled={!isAvailable} onSelect={setSelectedColour} /> : null}
      {isAvailable ? <ProductQuantityStepper quantity={quantity} maximum={product.inventory} onChange={setQuantity} /> : null}
    </View> : null}
  </View>;

  const fulfilment = <ProductDetailSection title="Delivery and pickup">
    <ProductInfoRow icon={<Truck size={18} color={product.deliveryAvailable ? colors.accentText : colors.mutedText} />} isMuted={!product.deliveryAvailable}
      title={product.deliveryAvailable ? 'Delivery available' : 'No delivery'}
      body={product.deliveryAvailable ? 'By the seller or one of their couriers. The seller confirms the fee.' : 'This seller does not deliver this item.'} />
    <ProductInfoRow icon={<Store size={18} color={product.pickupAvailable ? colors.accentText : colors.mutedText} />} isMuted={!product.pickupAvailable}
      title={product.pickupAvailable ? (store.location ? `Pickup in ${store.location}` : 'Pickup available') : 'No pickup'}
      body={product.pickupAvailable ? 'Arrange a time with the seller after your order request.' : 'This item is not offered for pickup.'} />
    {product.warrantyInformation ? <ProductInfoRow icon={<ShieldCheck size={18} color={colors.accentText} />} title="Warranty" body={product.warrantyInformation} /> : null}
    <ProductInfoRow icon={<RotateCcw size={18} color={store.returnPolicy ? colors.accentText : colors.mutedText} />} isMuted={!store.returnPolicy}
      title={store.returnPolicy ? 'Returns accepted by this seller' : 'No return policy listed'} body={store.returnPolicy ? 'See Policies and returns below.' : null} />
    {product.deliveryAvailable ? <SellerCouriersPanel sellerId={product.storeId} /> : null}
    <View style={styles.requestNote}>
      <Info size={16} color={colors.warningText} />
      <Text style={styles.requestNoteText}>E-Hub sends the seller an order request: no payment is taken in the app. The seller confirms stock, price and delivery.</Text>
    </View>
  </ProductDetailSection>;

  return (
    <View style={styles.screen}>
      {statusBar}
      {isWide ? <ProductTopBar title={product.title} isSolid isFloating={false} saveTarget={{ type: 'ehub_product', itemId: product.id, snapshot: { title: product.title, thumbnail: product.imageUrl ?? null } }} onBack={() => router.back()} onShare={handleShare} onOpenCart={() => setIsCartOpen(true)} /> : null}
      <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={32}
        refreshControl={<RefreshControl refreshing={resource.isRefreshing} onRefresh={() => void resource.refresh()} tintColor={colors.accent} progressViewOffset={isWide ? 0 : headerHeight} />}
        contentContainerStyle={styles.scrollContent}>
        <View style={isWide ? [styles.wideBody, { width: Math.min(layout.width, WIDE_MAXIMUM_WIDTH) }] : null}>
          {isWide ? <View style={styles.wideTop}>
            <ProductGallery images={images} title={product.title} width={galleryWidth} height={galleryHeight} isFullBleed={false} />
            <View style={styles.wideColumn}>{summary}<View style={styles.wideCard}>{fulfilment}</View></View>
          </View> : <>
            <ProductGallery images={images} title={product.title} width={galleryWidth} height={galleryHeight} isFullBleed topScrimHeight={headerHeight + 16} />
            {summary}
            <View style={styles.sectionGap} />
            {fulfilment}
          </>}

          <View style={styles.sectionGap} />
          <View style={isWide ? styles.wideCard : null}>
            <ProductDetailSection title="Sold by"><ProductSellerCard store={store} onViewStore={handleViewStore} onMessage={handleEnquire} /></ProductDetailSection>
          </View>
          <View style={styles.sectionGap} />
          <View style={isWide ? styles.wideCard : null}>
            <ProductDetailSection title="Description">
              {product.description ? <ProductExpandableText text={product.description} /> : <Text style={styles.mutedText}>The seller has not added a description.</Text>}
              <Text style={styles.subheading}>Details</Text>
              <ProductSpecList specs={specs} />
            </ProductDetailSection>
          </View>
          <View style={styles.sectionGap} />
          <View style={isWide ? styles.wideCard : null}>
            <ProductDetailSection title="Policies and returns" isCollapsible isInitiallyOpen={false}>
              <Text style={styles.policyText}>{store.sellerPolicies ? <><Text style={styles.strong}>Seller policies: </Text>{store.sellerPolicies}</> : 'The seller has not added general policies.'}</Text>
              <Text style={styles.policyText}>{store.returnPolicy ? <><Text style={styles.strong}>Return/refund expectations: </Text>{store.returnPolicy}</> : 'No seller return or refund policy is currently listed.'}</Text>
              <Pressable accessibilityRole="link" onPress={() => router.push(getEHubTermsRoute('buyer') as Href)} style={styles.termsLink}><Text style={styles.link}>Read E-Hub buyer terms and payment limitations</Text></Pressable>
            </ProductDetailSection>
          </View>

          <ProductRail title="More from this seller" products={detail.moreFromSeller} cardWidth={railCardWidth} onOpen={handleOpenProduct} />
          <ProductRail title="You may also like" products={detail.relatedProducts} cardWidth={railCardWidth} onOpen={handleOpenProduct} />
        </View>
      </ScrollView>
      {isWide ? null : <ProductTopBar title={product.title} isSolid={isHeaderSolid} isFloating saveTarget={{ type: 'ehub_product', itemId: product.id, snapshot: { title: product.title, thumbnail: product.imageUrl ?? null } }} onBack={() => router.back()} onShare={handleShare} onOpenCart={() => setIsCartOpen(true)} />}
      <ProductBottomBar price={currentPrice} originalPrice={originalPrice} isAvailable={isAvailable} isAdded={added.isFlashing} onAddToCart={handleAddToCart} onMessage={handleEnquire} />
      {cartSheet}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  stateBody: { padding: PRODUCT_DETAIL_GUTTER },
  sectionGap: { height: 8 },
  summary: { paddingHorizontal: PRODUCT_DETAIL_GUTTER, paddingTop: 12, paddingBottom: 16, gap: 8, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  crumbButton: { minHeight: 32, justifyContent: 'center' },
  crumbLink: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
  crumbText: { flexShrink: 1, color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  storeLink: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeLinkText: { flexShrink: 1, color: colors.accentText, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  ratingRow: { alignSelf: 'flex-start', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  ratingCount: { color: colors.accentText, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  priceRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  price: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '900' },
  oldPrice: { color: colors.mutedText, fontSize: 16, fontWeight: '600', textDecorationLine: 'line-through' },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.destructiveSurface },
  discountText: { color: colors.destructiveText, fontSize: 12, fontWeight: '800' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockText: { fontSize: 14, fontWeight: '800' },
  stockDetail: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  options: { marginTop: 8, paddingTop: 16, gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  requestNote: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  requestNoteText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 19 },
  mutedText: { color: colors.mutedText, fontSize: 14, lineHeight: 21 },
  subheading: { marginTop: 4, color: colors.text, fontSize: 15, fontWeight: '800' },
  policyText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  strong: { color: colors.text, fontWeight: '800' },
  termsLink: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.accentText, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  wideBody: { alignSelf: 'center', paddingHorizontal: PRODUCT_DETAIL_GUTTER, paddingTop: 16 },
  wideTop: { flexDirection: 'row', alignItems: 'flex-start', gap: PRODUCT_DETAIL_GUTTER },
  wideColumn: { flex: 1, minWidth: 0, gap: 8 },
  wideCard: { overflow: 'hidden', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
});
