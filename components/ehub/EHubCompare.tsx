import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Check, Package, ShoppingCart, Star, X } from 'lucide-react-native';
import Animated, { FadeOutDown, SlideInDown, useReducedMotion, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CachedImage from '@/components/ui/CachedImage';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubCurrentPrice, normalizeEHubSalePrice } from '@/lib/services/EHubCommerceService';
import { EHUB_ACTION_GREEN, formatEHubPrice, getEHubStockStatus } from '@/components/ehub/EHubParts';
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';

/** How many products can be compared at once (two columns fit a phone side by side). */
export const EHUB_COMPARE_LIMIT = 2;

export type EHubStoreRating = { rating: number | null; reviewCount: number };

type CompareBarProps = {
  products: EHubCatalogProduct[];
  bottomInset: number;
  onOpen: () => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
};

/**
 * Pinned to the bottom of the E-Hub home while anything is ticked for comparison, so ticking "Compare" on a card has
 * a visible result wherever the person is on the page: thumbnails of the picks, "Compare (1/2)" with what to do next,
 * and a "View" button once two are picked (Baymard: a persistent compare tray).
 */
export function EHubCompareBar({ products, bottomInset, onOpen, onRemove, onClear }: CompareBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  if (!products.length) return null;
  const isReady = products.length >= EHUB_COMPARE_LIMIT;
  return <Animated.View entering={reduceMotion ? FadeIn.duration(120) : SlideInDown.duration(260)} exiting={reduceMotion ? FadeOut.duration(100) : FadeOutDown.duration(200)} style={[styles.bar, { bottom: Math.max(bottomInset, 8) + 8 }]} accessibilityLiveRegion="polite">
    <View style={styles.barThumbs}>
      {Array.from({ length: EHUB_COMPARE_LIMIT }, (_, slotIndex) => {
        const product = products[slotIndex];
        if (!product) return <View key={`empty-${slotIndex}`} style={[styles.barThumb, styles.barThumbEmpty]}><Text style={styles.barThumbPlus}>+</Text></View>;
        return <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Remove ${product.title} from comparison`} onPress={() => onRemove(product.id)} style={styles.barThumb}>
          {product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} /> : <Package size={18} color={colors.mutedText} />}
          <View style={styles.barThumbRemove}><X size={10} color="#ffffff" strokeWidth={3} /></View>
        </Pressable>;
      })}
    </View>
    <View style={styles.flex}>
      <Text numberOfLines={1} style={styles.barTitle}>Compare ({products.length}/{EHUB_COMPARE_LIMIT})</Text>
      <Text numberOfLines={1} style={styles.barHint}>{isReady ? 'Ready to compare' : 'Tick one more product'}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Clear comparison" onPress={onClear} style={styles.barClear}><X size={18} color={colors.icon} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={isReady ? 'View comparison' : 'Pick one more product to compare'} accessibilityState={{ disabled: !isReady }} disabled={!isReady} onPress={onOpen} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.barView, !isReady && styles.barViewDisabled]}>
      <Text numberOfLines={1} style={[styles.barViewText, !isReady && styles.barViewTextDisabled]}>View</Text>
    </Pressable>
  </Animated.View>;
}

type CompareTableProps = {
  products: EHubCatalogProduct[];
  getStoreRating?: (product: EHubCatalogProduct) => EHubStoreRating | null;
  onOpenProduct: (productId: string) => void;
  /** Called after "Add to cart" put a product in the cart. */
  onAddedToCart?: () => void;
};

type CompareRow = { label: string; render: (product: EHubCatalogProduct) => ReactNode };

/**
 * Two products side by side, one row per attribute (price, store, stock, delivery, pickup, store rating, brand,
 * category, warranty), each value with its label so it reads well in a screen reader too. The lower price is marked.
 */
export function EHubCompareTable({ products, getStoreRating, onOpenProduct, onAddedToCart }: CompareTableProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cart, addToCart } = useEHubCommerce();
  const prices = products.map((product) => getEHubCurrentPrice(product.price, product.salePrice));
  const lowestPrice = Math.min(...prices);
  const hasPriceDifference = new Set(prices).size > 1;

  const renderYesNo = (isYes: boolean) => <View style={styles.yesNo}>
    {isYes ? <Check size={14} color={colors.successText} strokeWidth={3} /> : <X size={14} color={colors.mutedText} strokeWidth={3} />}
    <Text style={[styles.value, !isYes && styles.valueMuted]}>{isYes ? 'Yes' : 'No'}</Text>
  </View>;

  const rows: CompareRow[] = [
    { label: 'Price', render: (product) => {
      const price = getEHubCurrentPrice(product.price, product.salePrice);
      const isOnSale = normalizeEHubSalePrice(product.salePrice, product.price) !== null;
      return <View style={styles.priceCell}>
        <Text style={[styles.priceValue, isOnSale && { color: colors.destructiveText }]}>{formatEHubPrice(price)}</Text>
        {isOnSale ? <Text style={styles.oldPrice}>{formatEHubPrice(product.price)}</Text> : null}
        {hasPriceDifference && price === lowestPrice ? <View style={styles.lowestTag}><Text style={styles.lowestTagText}>Lower price</Text></View> : null}
      </View>;
    } },
    { label: 'Store', render: (product) => <Text numberOfLines={2} style={styles.value}>{product.storeName}</Text> },
    { label: 'Stock', render: (product) => {
      const stock = getEHubStockStatus(product.inventory);
      const color = stock.tone === 'out' ? colors.destructiveText : stock.tone === 'low' ? colors.warningText : colors.successText;
      return <Text style={[styles.value, styles.strong, { color }]}>{stock.label}</Text>;
    } },
    { label: 'Delivery', render: (product) => renderYesNo(product.deliveryAvailable) },
    { label: 'Pickup', render: (product) => renderYesNo(product.pickupAvailable) },
    { label: 'Store rating', render: (product) => {
      const storeRating = getStoreRating?.(product) ?? null;
      if (!storeRating || storeRating.rating === null) return <Text style={[styles.value, styles.valueMuted]}>No ratings yet</Text>;
      return <View style={styles.yesNo}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={[styles.value, styles.strong]}>{storeRating.rating.toFixed(1)}</Text><Text style={[styles.value, styles.valueMuted]}>({storeRating.reviewCount})</Text></View>;
    } },
    { label: 'Brand', render: (product) => <Text numberOfLines={2} style={[styles.value, !product.brand && styles.valueMuted]}>{product.brand || 'Not listed'}</Text> },
    { label: 'Category', render: (product) => <Text numberOfLines={2} style={[styles.value, !product.category && styles.valueMuted]}>{product.category || 'Not listed'}</Text> },
    { label: 'Warranty', render: (product) => <Text numberOfLines={3} style={[styles.value, !product.warrantyInformation && styles.valueMuted]}>{product.warrantyInformation || 'Not listed'}</Text> },
  ];

  const handleAdd = (product: EHubCatalogProduct) => {
    const isOnSale = normalizeEHubSalePrice(product.salePrice, product.price) !== null;
    const isAdded = addToCart({
      productId: product.id, title: product.title, imageUrl: product.imageUrl ?? '', price: getEHubCurrentPrice(product.price, product.salePrice),
      originalPrice: isOnSale ? product.price : null, quantity: 1, availableQuantity: product.inventory,
      sellerId: product.storeId, sellerName: product.storeName, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, selectedVariant: null, selectedSize: null, selectedColour: null,
    });
    if (isAdded) onAddedToCart?.();
  };

  return <View style={styles.table}>
    <View style={styles.tableRow}>
      {products.map((product) => <Pressable key={product.id} accessibilityRole="link" accessibilityLabel={`View ${product.title}`} onPress={() => onOpenProduct(product.id)} style={styles.headCell}>
        <View style={styles.headImage}>{product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} accessibilityLabel={product.title} /> : <Package size={28} color={colors.mutedText} />}</View>
        <Text numberOfLines={2} style={styles.headTitle}>{product.title}</Text>
      </Pressable>)}
    </View>
    {rows.map((row) => <View key={row.label} style={styles.attributeBlock}>
      <Text style={styles.attributeLabel}>{row.label}</Text>
      <View style={styles.tableRow}>
        {products.map((product) => <View key={product.id} style={styles.cell}>{row.render(product)}</View>)}
      </View>
    </View>)}
    <View style={[styles.tableRow, styles.actionsRow]}>
      {products.map((product) => {
        const isInCart = cart.some((item) => item.productId === product.id);
        const isAvailable = product.inventory > 0;
        return <View key={product.id} style={styles.actionCell}>
          <Pressable accessibilityRole="button" accessibilityLabel={!isAvailable ? `${product.title} is out of stock` : isInCart ? `${product.title} is in your cart` : `Add ${product.title} to cart`} accessibilityState={{ disabled: !isAvailable || isInCart }} disabled={!isAvailable || isInCart} onPress={() => handleAdd(product)} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.addButton, (isInCart || !isAvailable) && styles.addButtonQuiet]}>
            {isInCart ? <Check size={16} color={colors.successText} /> : <ShoppingCart size={16} color={isAvailable ? '#ffffff' : colors.disabledText} />}
            <Text numberOfLines={1} style={[styles.addButtonText, (isInCart || !isAvailable) && styles.addButtonTextQuiet]}>{!isAvailable ? 'Sold out' : isInCart ? 'In cart' : 'Add'}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={`View details of ${product.title}`} onPress={() => onOpenProduct(product.id)} style={styles.detailsLink}>
            <Text numberOfLines={1} style={styles.detailsLinkText}>Details</Text><ArrowRight size={14} color={colors.accentText} />
          </Pressable>
        </View>;
      })}
    </View>
  </View>;
}

type CompareSheetProps = CompareTableProps & { visible: boolean; onClose: () => void; onClear: () => void };

/** The comparison as a bottom sheet over the E-Hub home, opened from the compare bar. */
export function EHubCompareSheet({ visible, onClose, onClear, products, getStoreRating, onOpenProduct, onAddedToCart }: CompareSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const handleOpenProduct = (productId: string) => { onClose(); onOpenProduct(productId); };
  const handleClear = () => { onClear(); onClose(); };
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
      <ModalBackdrop onPress={onClose} accessibilityLabel="Close comparison" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
      <ModalMotionSurface variant="sheet" style={{ maxHeight: '90%' }}>
        <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close the comparison" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" numberOfLines={1} style={[styles.sheetTitle, styles.flex]}>Compare products</Text>
            <Pressable accessibilityRole="button" onPress={handleClear} style={styles.sheetClear}><Text numberOfLines={1} style={styles.sheetClearText}>Clear</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close comparison" onPress={onClose} style={styles.sheetClose}><X size={19} color={colors.icon} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {products.length >= EHUB_COMPARE_LIMIT
              ? <EHubCompareTable products={products} getStoreRating={getStoreRating} onOpenProduct={handleOpenProduct} onAddedToCart={onAddedToCart} />
              : <Text style={styles.value}>Tick Compare on two products to see them side by side.</Text>}
            <Text style={styles.footnote}>Details are as listed by each seller. Confirm price, stock and delivery with the seller before you buy.</Text>
          </ScrollView>
        </SwipeDismissSurface>
      </ModalMotionSurface>
    </View>
  </Modal>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    fill: { width: '100%', height: '100%' },
    bar: { position: 'absolute', left: 12, right: 12, minHeight: 64, paddingLeft: 8, paddingRight: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.accent, shadowColor: '#020617', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    barThumbs: { flexDirection: 'row', gap: 4 },
    barThumb: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, backgroundColor: colors.control },
    barThumbEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.mutedText, backgroundColor: 'transparent' },
    barThumbPlus: { color: colors.mutedText, fontSize: 18, fontWeight: '700' },
    barThumbRemove: { position: 'absolute', top: 2, right: 2, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(2,6,23,0.75)' },
    barTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    barHint: { color: colors.mutedText, fontSize: 12 },
    barClear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    barView: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: EHUB_ACTION_GREEN },
    barViewDisabled: { backgroundColor: colors.disabled },
    barViewText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    barViewTextDisabled: { color: colors.disabledText },
    sheet: { flexShrink: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    sheetClear: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    sheetClearText: { color: colors.destructiveText, fontSize: 14, fontWeight: '700' },
    sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetBody: { padding: 16, gap: 16 },
    footnote: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
    table: { gap: 0 },
    tableRow: { flexDirection: 'row', gap: 12 },
    headCell: { flex: 1, minWidth: 0, gap: 8, paddingBottom: 12 },
    headImage: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control },
    headTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    attributeBlock: { paddingVertical: 8, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    attributeLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    cell: { flex: 1, minWidth: 0 },
    value: { flexShrink: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
    valueMuted: { color: colors.mutedText },
    strong: { fontWeight: '700' },
    yesNo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    priceCell: { alignItems: 'flex-start', gap: 2 },
    priceValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
    oldPrice: { color: colors.mutedText, fontSize: 12, textDecorationLine: 'line-through' },
    lowestTag: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface },
    lowestTagText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
    actionsRow: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    actionCell: { flex: 1, minWidth: 0, gap: 4 },
    addButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: EHUB_ACTION_GREEN },
    addButtonQuiet: { backgroundColor: colors.control },
    addButtonText: { flexShrink: 1, color: '#ffffff', fontSize: 14, fontWeight: '800' },
    addButtonTextQuiet: { color: colors.secondaryText },
    detailsLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    detailsLinkText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  });
}
