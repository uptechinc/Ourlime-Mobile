import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Building2, Check, Heart, MapPin, Package, Send, Share2, ShieldCheck, ShoppingCart, Star, Store, Truck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubProduct } from '@/lib/hooks/useEHub';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import { getEHubCurrentPrice, normalizeEHubSalePrice } from '@/lib/services/EHubCommerceService';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { EHubCartSheet, EHubHeaderActions } from '@/components/ehub/EHubCommerceParts';
import { EHubEmptyState, EHubNotice, EHubProductCard, formatEHubPrice, useEHubLayout } from '@/components/ehub/EHubParts';
import { EHubProductDetailSkeleton } from '@/components/ehub/EHubSkeletons';
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';

type OptionGroupProps = { label: string; values: string[]; selectedValue: string; onSelect: (value: string) => void };

/** The website's /ehub/products/[productId]: gallery, price and stock, options, seller card, policies, related products. */
export default function EHubProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const resource = useEHubProduct(productId);
  const detail = resource.data;
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { addToCart, addRecentlyViewed, isFavorite, toggleFavorite } = useEHubCommerce();
  const images = useMemo(() => detail ? [...new Set([detail.product.imageUrl, ...detail.product.imageUrls].filter((image): image is string => Boolean(image)))] : [], [detail]);

  useEffect(() => { setSelectedImage(images[0] ?? null); }, [images]);

  // Recorded like the website (newest first, at most 10); not shown anywhere yet.
  const viewedProduct = detail?.product ?? null;
  useEffect(() => {
    if (!viewedProduct) return;
    addRecentlyViewed({ id: viewedProduct.id, title: viewedProduct.title, imageUrl: viewedProduct.imageUrl ?? '', price: getEHubCurrentPrice(viewedProduct.price, viewedProduct.salePrice), category: viewedProduct.category });
  }, [addRecentlyViewed, viewedProduct]);

  const handleOpenProduct = (nextProductId: string) => router.push(`/ehub/products/${encodeURIComponent(nextProductId)}` as Href);
  const handleEnquire = () => {
    if (!detail) return;
    const options = [selectedVariant, selectedSize, selectedColour].filter(Boolean).join(', ');
    const productLabel = options ? `${detail.product.title} (${options})` : detail.product.title;
    router.push(`/ehub/providers/${encodeURIComponent(detail.store.businessId)}?product=${encodeURIComponent(productLabel)}` as Href);
  };
  const handleAddToCart = () => {
    if (!detail || detail.product.inventory <= 0) return;
    const { product, store } = detail;
    const isAdded = addToCart({
      productId: product.id, title: product.title, imageUrl: product.imageUrl ?? '', price: getEHubCurrentPrice(product.price, product.salePrice),
      originalPrice: normalizeEHubSalePrice(product.salePrice, product.price) !== null ? product.price : null, quantity: 1,
      availableQuantity: product.inventory, sellerId: product.storeId, sellerName: store.storeName, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, selectedVariant: selectedVariant || null, selectedSize: selectedSize || null, selectedColour: selectedColour || null,
    });
    if (!isAdded) return;
    setNotice('Saved in your E-Hub preparation cart. Checkout and payment are not available yet.');
    setIsCartOpen(true);
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

  const header = <PageHeader title={detail?.product.title ?? 'Product'} onBackPress={() => router.back()} rightComponent={<EHubHeaderActions onOpenCart={() => setIsCartOpen(true)} />} />;
  if (resource.isLoading && !detail) {
    return <View style={styles.screen}>{header}<EHubProductDetailSkeleton /></View>;
  }
  if (!detail) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {resource.error ? <EHubNotice tone="error" text={resource.error} actionLabel="Try again" onAction={() => void resource.refresh()} />
        : <EHubEmptyState icon={<Package size={46} color={colors.mutedText} />} title="Product unavailable" body="This product is unavailable, unpublished, or no longer offered by an active E-Hub store." actionLabel="Browse E-Hub products" onAction={() => router.replace('/ehub' as Href)} />}
    </View></View>;
  }

  const { product, store } = detail;
  const isAvailable = product.inventory > 0;
  const isSaved = isFavorite(product.id);
  const currentPrice = getEHubCurrentPrice(product.price, product.salePrice);
  const isOnSale = normalizeEHubSalePrice(product.salePrice, product.price) !== null;
  const galleryWidth = layout.isWide ? Math.floor((layout.innerWidth - 24) * 0.52) : layout.innerWidth;
  const thumbnailSize = Math.floor((galleryWidth - 30) / 6);
  const detailItems: { label: string; value: string }[] = [
    ...(product.sku ? [{ label: 'SKU', value: product.sku }] : []),
    { label: 'Status', value: isAvailable ? 'Available' : 'Out of stock' },
    ...(product.deliveryAvailable ? [{ label: 'Delivery', value: 'Seller indicates delivery is available' }] : []),
    ...(product.pickupAvailable ? [{ label: 'Pickup', value: 'Seller indicates pickup is available' }] : []),
    ...(product.warrantyInformation ? [{ label: 'Warranty', value: product.warrantyInformation }] : []),
  ];

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={resource.isRefreshing} onRefresh={() => void resource.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.body, { width: layout.contentWidth }]}>
          <View style={[styles.top, layout.isWide && styles.topWide]}>
            <View style={{ width: galleryWidth, gap: 10 }}>
              <View style={[styles.mainImage, { height: galleryWidth }]}>
                {selectedImage ? <CachedImage uri={selectedImage} style={styles.fill} contentFit="contain" accessibilityLabel={product.title} /> : <View style={styles.noImage}><Package size={60} color={colors.mutedText} /><Text style={styles.muted}>No product image provided</Text></View>}
              </View>
              {images.length > 1 ? <View style={styles.thumbnails}>{images.map((image) => <Pressable key={image} accessibilityRole="button" accessibilityLabel="View product image" onPress={() => setSelectedImage(image)} style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }, selectedImage === image && styles.thumbnailActive]}><CachedImage uri={image} style={styles.fill} /></Pressable>)}</View> : null}
            </View>

            <View style={[styles.card, layout.isWide && styles.flex]}>
              <View style={styles.badges}><View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{product.category}</Text></View><View style={styles.plainBadge}><Text style={styles.plainBadgeText}>Published E-Hub product</Text></View></View>
              <Text style={styles.title}>{product.title}</Text>
              {product.brand ? <Text style={styles.muted}>Brand: {product.brand}</Text> : null}
              <View style={styles.priceRow}><Text style={styles.price}>{formatEHubPrice(currentPrice)}</Text>{isOnSale ? <Text style={styles.oldPrice}>{formatEHubPrice(product.price)}</Text> : null}</View>
              <View style={styles.row}><View style={[styles.stockDot, { backgroundColor: isAvailable ? colors.accent : colors.destructive }]} /><Text style={[styles.stockText, { color: isAvailable ? colors.accentText : colors.destructiveText }]}>{isAvailable ? `${product.inventory} available` : 'Currently out of stock'}</Text></View>
              {product.variants.length ? <OptionGroup label="Variant" values={product.variants} selectedValue={selectedVariant} onSelect={setSelectedVariant} /> : null}
              {product.sizes.length ? <OptionGroup label="Size" values={product.sizes} selectedValue={selectedSize} onSelect={setSelectedSize} /> : null}
              {product.colours.length ? <OptionGroup label="Colour" values={product.colours} selectedValue={selectedColour} onSelect={setSelectedColour} /> : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={handleAddToCart} style={[styles.primaryButton, styles.flex, !isAvailable && styles.disabled]}><ShoppingCart size={17} color="#ffffff" /><Text numberOfLines={1} style={styles.primaryText}>Add to E-Hub cart</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: isSaved }} onPress={() => toggleFavorite(product.id, product.title)} style={[styles.secondaryButton, styles.flex, isSaved && styles.savedButton]}><Heart size={17} color={isSaved ? '#e11d48' : colors.text} fill={isSaved ? '#e11d48' : 'transparent'} /><Text style={[styles.secondaryText, isSaved && styles.savedText]}>{isSaved ? 'Saved' : 'Save product'}</Text></Pressable>
              </View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={handleEnquire} style={[styles.secondaryButton, styles.flex]}><Send size={17} color={colors.text} /><Text style={styles.secondaryText}>Send enquiry</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Share product" onPress={handleShare} style={[styles.secondaryButton, styles.flex]}><Share2 size={17} color={colors.text} /><Text style={styles.secondaryText}>Share</Text></Pressable>
              </View>
              <EHubNotice tone="warning" text="The E-Hub cart is a preparation list only. Checkout, payment, escrow, platform-managed refunds, and delivery guarantees are not active." />
              {notice ? <EHubNotice tone="success" text={notice} /> : null}
            </View>
          </View>

          <View style={[styles.top, layout.isWide && styles.topWide]}>
            <View style={[styles.flex, styles.stack]}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Product details</Text>
                <Text style={styles.description}>{product.description}</Text>
                <View style={styles.detailGrid}>{detailItems.map((item) => <View key={item.label} style={[styles.detailItem, layout.isTablet && styles.detailItemHalf]}><Text style={styles.detailLabel}>{item.label}</Text><Text style={styles.detailValue}>{item.value}</Text></View>)}</View>
              </View>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Policies and buyer information</Text>
                <Text style={styles.description}>{store.sellerPolicies ? <><Text style={styles.strong}>Seller policies: </Text>{store.sellerPolicies}</> : 'The seller has not added general policies.'}</Text>
                <Text style={styles.description}>{store.returnPolicy ? <><Text style={styles.strong}>Return/refund expectations: </Text>{store.returnPolicy}</> : 'No seller return or refund policy is currently listed.'}</Text>
                <Pressable accessibilityRole="link" onPress={() => router.push(getEHubTermsRoute('buyer') as Href)} hitSlop={6}><Text style={styles.link}>Read E-Hub buyer terms and payment limitations</Text></Pressable>
              </View>
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel={`View ${store.storeName}`} onPress={() => router.push(`/ehub/providers/${encodeURIComponent(store.businessId)}` as Href)} style={[styles.card, layout.isWide && styles.sellerWide]}>
              <View style={styles.sellerTop}>
                <View style={styles.sellerLogo}>{store.logoUrl ? <CachedImage uri={store.logoUrl} style={styles.fill} accessibilityLabel={`${store.storeName} logo`} /> : <Building2 size={26} color={colors.mutedText} />}</View>
                <View style={styles.flex}>
                  <Text numberOfLines={2} style={styles.sellerName}>{store.storeName}</Text>
                  {store.isVerified ? <View style={styles.row}><ShieldCheck size={15} color={colors.accentText} /><Text style={styles.verified}>Verified seller identity</Text></View> : null}
                </View>
              </View>
              {store.description ? <Text numberOfLines={4} style={styles.description}>{store.description}</Text> : null}
              {store.location ? <View style={styles.row}><MapPin size={14} color={colors.mutedText} /><Text style={styles.muted}>{store.location}</Text></View> : null}
              {store.rating !== null ? <View style={styles.row}><Star size={14} color="#f59e0b" fill="#f59e0b" /><Text style={styles.muted}>{store.rating.toFixed(1)} from {store.reviewCount} eligible reviews</Text></View> : null}
              <View style={styles.storefrontButton}><Store size={16} color={colors.canvas} /><Text style={styles.storefrontText}>View seller storefront</Text></View>
            </Pressable>
          </View>

          <ProductCollection title="More from this seller" products={detail.moreFromSeller} onOpen={handleOpenProduct} />
          <ProductCollection title="Related E-Hub products" products={detail.relatedProducts} onOpen={handleOpenProduct} />
        </View>
      </ScrollView>
      <EHubCartSheet visible={isCartOpen} onClose={() => setIsCartOpen(false)} onOpenProduct={handleOpenProduct} />
    </View>
  );
}

function OptionGroup({ label, values, selectedValue, onSelect }: OptionGroupProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, 0), [colors]);
  return <View style={styles.optionGroup}>
    <Text style={styles.detailLabel}>{label}</Text>
    <View style={styles.optionRow}>{values.map((value) => {
      const isSelected = selectedValue === value;
      return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => onSelect(isSelected ? '' : value)} style={[styles.option, isSelected && styles.optionSelected]}>
        {isSelected ? <Check size={14} color={colors.accentText} /> : null}<Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{value}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function ProductCollection({ title, products, onOpen }: { title: string; products: EHubCatalogProduct[]; onOpen: (productId: string) => void }) {
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, 0), [colors]);
  if (!products.length) return null;
  const columns = layout.isTablet ? 4 : 2;
  return <View style={styles.stack}>
    <View style={styles.row}><Truck size={19} color={colors.accent} /><Text style={styles.sectionTitle}>{title}</Text></View>
    <View style={[styles.grid, { gap: layout.gap }]}>{products.map((product) => <EHubProductCard key={product.id} product={product} width={layout.columnWidth(columns)} onOpen={onOpen} isCompact />)}</View>
  </View>;
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  // No alignItems here: it shrank the full-width page header to its content. The body centres itself instead.
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { gap: 14 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  body: { maxWidth: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 22 },
  top: { gap: 18 },
  topWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  mainImage: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  noImage: { alignItems: 'center', gap: 8 },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbnail: { overflow: 'hidden', borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  thumbnailActive: { borderColor: colors.accent },
  card: { padding: 18, gap: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface },
  categoryBadgeText: { color: colors.successText, fontSize: 11, fontWeight: '900' },
  plainBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control },
  plainBadgeText: { color: colors.secondaryText, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 27, lineHeight: 32, fontWeight: '900' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
  price: { color: colors.accentText, fontSize: 28, fontWeight: '900' },
  oldPrice: { color: colors.mutedText, fontSize: 17, fontWeight: '700', textDecorationLine: 'line-through' },
  stockDot: { width: 10, height: 10, borderRadius: 5 },
  stockText: { fontSize: 13, fontWeight: '800' },
  optionGroup: { gap: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 40, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  optionText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  optionTextSelected: { color: colors.successText },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#059669' },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  savedButton: { borderColor: '#fecdd3', backgroundColor: colors.destructiveSurface },
  savedText: { color: '#e11d48' },
  disabled: { opacity: 0.45 },
  storefrontButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.text },
  storefrontText: { color: colors.canvas, fontSize: 14, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  description: { color: colors.secondaryText, fontSize: 14, lineHeight: 22 },
  strong: { color: colors.text, fontWeight: '900' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  detailItem: { width: '100%', gap: 3 },
  detailItemHalf: { width: '47%' },
  detailLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  detailValue: { color: colors.secondaryText, fontSize: 14, fontWeight: '700' },
  link: { color: colors.accentText, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' },
  sellerWide: { width: 340 },
  sellerTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  sellerLogo: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 18, backgroundColor: colors.control },
  sellerName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  verified: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
