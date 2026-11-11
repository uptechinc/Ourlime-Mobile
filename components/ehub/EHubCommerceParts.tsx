import { useMemo } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heart, Minus, Package, Plus, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CachedImage from '@/components/ui/CachedImage';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubCurrentPrice } from '@/lib/services/EHubCommerceService';
import { formatEHubPrice } from '@/components/ehub/EHubParts';
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';

export const EHUB_CART_NOTICE = 'Payments, escrow, platform-managed refunds, and guaranteed fulfilment are not active. Contact each seller to confirm arrangements.';

type HeaderActionsProps = { onOpenCart: () => void; onOpenSaved?: () => void };

/** The website's header cart and saved buttons, each with its count badge. */
export function EHubHeaderActions({ onOpenCart, onOpenSaved }: HeaderActionsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cartCount, favorites } = useEHubCommerce();
  return <View style={styles.headerActions}>
    {onOpenSaved ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${favorites.length} saved E-Hub products`} onPress={onOpenSaved} hitSlop={4} style={styles.headerButton}>
      <Heart size={21} color={favorites.length ? '#f43f5e' : colors.icon} fill={favorites.length ? '#f43f5e' : 'transparent'} />
      {favorites.length ? <View style={[styles.badge, styles.badgeRose]}><Text style={styles.badgeText}>{favorites.length}</Text></View> : null}
    </Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Open E-Hub cart with ${cartCount} items`} onPress={onOpenCart} hitSlop={4} style={styles.headerButton}>
      <ShoppingCart size={21} color={colors.icon} />
      {cartCount ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}
    </Pressable>
  </View>;
}

type CartSheetProps = { visible: boolean; onClose: () => void; onOpenProduct: (productId: string) => void };

/** The website's CartDrawer: a preparation list, not checkout. Quantities stop at the seller's listed stock. */
export function EHubCartSheet({ visible, onClose, onOpenProduct }: CartSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { cart, cartTotal, removeFromCart, updateQuantity } = useEHubCommerce();
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
      <ModalBackdrop onPress={onClose} accessibilityLabel="Close cart" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
      <ModalMotionSurface variant="sheet" style={{ maxHeight: '88%' }}>
        <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close the cart" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}><Text style={styles.sheetTitle}>E-Hub cart</Text><Text style={styles.muted}>A preparation list—not checkout.</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close cart" onPress={onClose} hitSlop={10} style={styles.closeButton}><X size={19} color={colors.icon} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {cart.length === 0 ? <View style={styles.emptyCart}><ShoppingCart size={40} color={colors.mutedText} /><Text style={styles.emptyCartText}>Your E-Hub cart is empty</Text></View>
              : cart.map((item) => {
                const options = [item.selectedVariant, item.selectedSize, item.selectedColour].filter(Boolean).join(' · ');
                return <View key={item.id} style={styles.cartItem}>
                  <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title}`} onPress={() => { onClose(); onOpenProduct(item.productId); }} style={styles.cartImage}>
                    {item.imageUrl ? <CachedImage uri={item.imageUrl} style={styles.fill} accessibilityLabel={item.title} /> : <Package size={26} color={colors.mutedText} />}
                  </Pressable>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.cartTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.muted}>{item.sellerName}</Text>
                    {options ? <Text numberOfLines={1} style={styles.options}>{options}</Text> : null}
                    <Text style={styles.cartPrice}>{formatEHubPrice(item.price)}</Text>
                    <View style={styles.quantityRow}>
                      <Text style={styles.muted}>Qty</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease quantity of ${item.title}`} onPress={() => updateQuantity(item.id, item.quantity - 1)} hitSlop={6} style={styles.stepper}><Minus size={15} color={colors.text} /></Pressable>
                      <Text accessibilityLabel={`Quantity ${item.quantity}`} style={styles.quantity}>{item.quantity}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Increase quantity of ${item.title}`} accessibilityState={{ disabled: item.quantity >= item.availableQuantity }} disabled={item.quantity >= item.availableQuantity} onPress={() => updateQuantity(item.id, item.quantity + 1)} hitSlop={6} style={[styles.stepper, item.quantity >= item.availableQuantity && styles.disabled]}><Plus size={15} color={colors.text} /></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => removeFromCart(item.id)} hitSlop={6} style={styles.removeButton}><Trash2 size={17} color={colors.destructiveText} /></Pressable>
                    </View>
                  </View>
                </View>;
              })}
          </ScrollView>
          {cart.length ? <View style={styles.sheetFooter}>
            <View style={styles.totalRow}><Text style={styles.totalText}>Estimated product total</Text><Text style={styles.totalText}>{formatEHubPrice(cartTotal)}</Text></View>
            <View style={styles.amberNote}><Text style={styles.amberText}>{EHUB_CART_NOTICE}</Text></View>
          </View> : null}
        </SwipeDismissSurface>
      </ModalMotionSurface>
    </View>
  </Modal>;
}

type ComparePanelProps = { products: EHubCatalogProduct[]; onClear: () => void; onOpenProduct: (productId: string) => void };

/** The website's "Compare products (n/2)" panel: price and stock side by side once two products are picked. */
export function EHubComparePanel({ products, onClear, onOpenProduct }: ComparePanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!products.length) return null;
  return <View style={styles.compare}>
    <View style={styles.compareTop}>
      <View style={styles.flex}><Text style={styles.compareTitle}>Compare products ({products.length}/2)</Text><Text style={styles.compareHint}>Select up to two products.</Text></View>
      <Pressable accessibilityRole="button" onPress={onClear} hitSlop={6} style={styles.clearButton}><Text style={styles.clearText}>Clear</Text></Pressable>
    </View>
    {products.length === 2 ? <View style={styles.compareGrid}>{products.map((product) => <Pressable key={product.id} accessibilityRole="link" accessibilityLabel={`View ${product.title}`} onPress={() => onOpenProduct(product.id)} style={styles.compareItem}>
      <Text numberOfLines={1} style={styles.compareItemTitle}>{product.title}</Text>
      <Text style={styles.compareItemMeta}>{formatEHubPrice(getEHubCurrentPrice(product.price, product.salePrice))} · {product.inventory > 0 ? `${product.inventory} available` : 'Out of stock'}</Text>
    </Pressable>)}</View> : null}
  </View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    fill: { width: '100%', height: '100%' },
    disabled: { opacity: 0.4 },
    muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#059669' },
    badgeRose: { backgroundColor: '#f43f5e' },
    badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    sheetTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
    sheetBody: { padding: 16, gap: 12 },
    emptyCart: { paddingVertical: 56, alignItems: 'center', gap: 10 },
    emptyCartText: { color: colors.secondaryText, fontSize: 15, fontWeight: '800' },
    cartItem: { padding: 12, flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
    cartImage: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14, backgroundColor: colors.control },
    cartTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    options: { marginTop: 2, color: colors.mutedText, fontSize: 11 },
    cartPrice: { marginTop: 3, color: colors.accentText, fontSize: 14, fontWeight: '900' },
    quantityRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepper: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    quantity: { minWidth: 22, textAlign: 'center', color: colors.text, fontSize: 15, fontWeight: '900' },
    removeButton: { marginLeft: 'auto', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.destructiveSurface },
    sheetFooter: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    totalText: { color: colors.text, fontSize: 15, fontWeight: '900' },
    amberNote: { padding: 12, borderRadius: 14, backgroundColor: colors.warningSurface },
    amberText: { color: colors.warningText, fontSize: 12, lineHeight: 18 },
    compare: { padding: 14, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
    compareTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    compareTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    compareHint: { color: colors.successText, fontSize: 12 },
    clearButton: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
    clearText: { color: colors.text, fontSize: 13, fontWeight: '800' },
    compareGrid: { flexDirection: 'row', gap: 10 },
    compareItem: { flex: 1, minWidth: 0, padding: 12, gap: 4, borderRadius: 14, backgroundColor: colors.surface },
    compareItemTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
    compareItemMeta: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  });
}
