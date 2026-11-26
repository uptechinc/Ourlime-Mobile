import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heart, Minus, Package, Plus, Send, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CachedImage from '@/components/ui/CachedImage';
import BumpOnIncrease from '@/components/ui/BumpOnIncrease';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { EHUB_ACTION_GREEN, EHubNotice, formatEHubPrice } from '@/components/ehub/EHubParts';
import { EHUB_COMPARE_LIMIT, EHubCompareTable, type EHubStoreRating } from '@/components/ehub/EHubCompare';
import EHubOrderRequestForm from '@/components/ehub/EHubOrderRequestForm';
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';

export const EHUB_CART_NOTICE = 'Payments, escrow, platform-managed refunds, and guaranteed fulfilment are not active. An order request asks the seller to confirm stock, price and delivery; nothing is paid or reserved.';

type HeaderActionsProps = { onOpenCart: () => void; onOpenSaved?: () => void };

/** The website's header cart and saved buttons, each with its count badge. */
export function EHubHeaderActions({ onOpenCart, onOpenSaved }: HeaderActionsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cartCount, favorites } = useEHubCommerce();
  return <View style={styles.headerActions}>
    {onOpenSaved ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${favorites.length} saved E-Hub products`} onPress={onOpenSaved} style={styles.headerButton}>
      <Heart size={21} color={favorites.length ? '#f43f5e' : colors.icon} fill={favorites.length ? '#f43f5e' : 'transparent'} />
      {favorites.length ? <View style={[styles.badge, styles.badgeRose]}><Text style={styles.badgeText}>{favorites.length > 99 ? '99+' : favorites.length}</Text></View> : null}
    </Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Open E-Hub cart with ${cartCount} items`} onPress={onOpenCart} style={styles.headerButton}>
      <ShoppingCart size={21} color={colors.icon} />
      <BumpOnIncrease value={cartCount} style={cartCount ? styles.badge : styles.badgeHidden}>{cartCount ? <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text> : null}</BumpOnIncrease>
    </Pressable>
  </View>;
}

type CartSheetProps = { visible: boolean; onClose: () => void; onOpenProduct: (productId: string) => void };

/**
 * The website's CartDrawer. Lines are grouped by storefront; each group can be sent to its seller as an order request
 * (pickup or delivery, optionally with one of the seller's couriers). Nothing is paid or reserved. Quantities stop at
 * the seller's listed stock.
 */
export function EHubCartSheet({ visible, onClose, onOpenProduct }: CartSheetProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { cart, cartTotal, cartGroups, removeFromCart, removeManyFromCart, updateQuantity } = useEHubCommerce();
  const [requestSellerId, setRequestSellerId] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const requestGroup = cartGroups.find((group) => group.sellerId === requestSellerId) ?? null;

  // Each time the cart opens it starts on the list, without the last notice.
  useEffect(() => { if (visible) { setRequestSellerId(null); setSentNotice(null); } }, [visible]);

  const handleOpenEnquiries = () => { onClose(); router.push('/ehub/enquiries?mode=sent' as Href); };
  const handleSent = (sellerName: string, itemIds: string[]) => {
    removeManyFromCart(itemIds);
    setRequestSellerId(null);
    setSentNotice(`Order request sent to ${sellerName}. The seller will reply in your enquiries to confirm stock, price and delivery.`);
  };

  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={requestGroup ? () => setRequestSellerId(null) : onClose}>
    <KeyboardSafeView style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
      <ModalBackdrop onPress={onClose} accessibilityLabel="Close cart" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
      <ModalMotionSurface variant="sheet" style={{ maxHeight: '88%' }}>
        <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close the cart" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}><Text accessibilityRole="header" numberOfLines={1} style={styles.sheetTitle}>E-Hub cart</Text><Text style={styles.muted}>Send each seller an order request. No payment is taken.</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close cart" onPress={onClose} hitSlop={4} style={styles.closeButton}><X size={19} color={colors.icon} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {requestGroup ? <EHubOrderRequestForm key={requestGroup.sellerId} group={requestGroup} onBack={() => setRequestSellerId(null)} onClose={onClose}
              onSent={() => handleSent(requestGroup.sellerName, requestGroup.items.map((item) => item.id))} /> : <>
              {sentNotice ? <EHubNotice tone="success" text={sentNotice} actionLabel="View my enquiries" onAction={handleOpenEnquiries} /> : null}
              {cart.length === 0 ? <View style={styles.emptyCart}><ShoppingCart size={40} color={colors.mutedText} /><Text style={styles.emptyCartText}>Your E-Hub cart is empty</Text></View>
                : cartGroups.map((group) => <View key={group.sellerId} style={styles.sellerGroup}>
                  <View style={styles.sellerHeader}>
                    <View style={styles.flex}><Text numberOfLines={1} style={styles.sellerName}>{group.sellerName}</Text><Text numberOfLines={1} style={styles.muted}>{group.items.length} {group.items.length === 1 ? 'item' : 'items'} · {formatEHubPrice(group.subtotal)}</Text></View>
                  </View>
                  {group.items.map((item) => {
                    const options = [item.selectedVariant, item.selectedSize, item.selectedColour].filter(Boolean).join(' · ');
                    return <View key={item.id} style={styles.cartItem}>
                      <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title}`} onPress={() => { onClose(); onOpenProduct(item.productId); }} style={styles.cartImage}>
                        {item.imageUrl ? <CachedImage uri={item.imageUrl} style={styles.fill} accessibilityLabel={item.title} /> : <Package size={26} color={colors.mutedText} />}
                      </Pressable>
                      <View style={styles.flex}>
                        <Text numberOfLines={2} style={styles.cartTitle}>{item.title}</Text>
                        {options ? <Text numberOfLines={1} style={styles.options}>{options}</Text> : null}
                        <Text style={styles.cartPrice}>{formatEHubPrice(item.price)}</Text>
                        <View style={styles.quantityRow}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Decrease quantity of ${item.title}`} onPress={() => updateQuantity(item.id, item.quantity - 1)} hitSlop={2} style={styles.stepper}><Minus size={15} color={colors.text} /></Pressable>
                          <Text accessibilityLabel={`Quantity ${item.quantity}`} style={styles.quantity}>{item.quantity}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Increase quantity of ${item.title}`} accessibilityState={{ disabled: item.quantity >= item.availableQuantity }} disabled={item.quantity >= item.availableQuantity} onPress={() => updateQuantity(item.id, item.quantity + 1)} hitSlop={2} style={[styles.stepper, item.quantity >= item.availableQuantity && styles.disabled]}><Plus size={15} color={colors.text} /></Pressable>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => removeFromCart(item.id)} hitSlop={2} style={styles.removeButton}><Trash2 size={17} color={colors.destructiveText} /></Pressable>
                        </View>
                      </View>
                    </View>;
                  })}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Send an order request to ${group.sellerName}`} onPress={() => { setSentNotice(null); setRequestSellerId(group.sellerId); }} style={styles.requestButton}>
                    <Send size={16} color="#ffffff" /><Text numberOfLines={1} style={styles.requestButtonText}>Send order request</Text>
                  </Pressable>
                </View>)}
            </>}
          </ScrollView>
          {cart.length && !requestGroup ? <View style={styles.sheetFooter}>
            <View style={styles.totalRow}><Text numberOfLines={1} style={[styles.totalLabel, styles.flex]}>Estimated total</Text><Text numberOfLines={1} style={styles.totalText}>{formatEHubPrice(cartTotal)}</Text></View>
            <View style={styles.amberNote}><Text style={styles.amberText}>{EHUB_CART_NOTICE}</Text></View>
          </View> : null}
        </SwipeDismissSurface>
      </ModalMotionSurface>
    </KeyboardSafeView>
  </Modal>;
}

type ComparePanelProps = {
  products: EHubCatalogProduct[];
  onClear: () => void;
  onOpenProduct: (productId: string) => void;
  getStoreRating?: (product: EHubCatalogProduct) => EHubStoreRating | null;
};

/**
 * An inline "Compare products (n/2)" panel: the picks, then the side-by-side table once two are picked. The E-Hub
 * home now uses the floating EHubCompareBar and EHubCompareSheet instead; this stays for inline use.
 */
export function EHubComparePanel({ products, onClear, onOpenProduct, getStoreRating }: ComparePanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!products.length) return null;
  return <View style={styles.compare}>
    <View style={styles.compareTop}>
      <View style={styles.flex}><Text numberOfLines={1} style={styles.compareTitle}>Compare products ({products.length}/{EHUB_COMPARE_LIMIT})</Text><Text numberOfLines={1} style={styles.compareHint}>{products.length < EHUB_COMPARE_LIMIT ? 'Tick Compare on one more product.' : 'Side by side below.'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear comparison" onPress={onClear} style={styles.clearButton}><Text style={styles.clearText}>Clear</Text></Pressable>
    </View>
    {products.length >= EHUB_COMPARE_LIMIT ? <EHubCompareTable products={products} getStoreRating={getStoreRating} onOpenProduct={onOpenProduct} /> : null}
  </View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    fill: { width: '100%', height: '100%' },
    disabled: { opacity: 0.4 },
    muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    badgeHidden: { position: 'absolute' },
    badge: { position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: EHUB_ACTION_GREEN },
    badgeRose: { backgroundColor: '#f43f5e' },
    badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    // flexShrink keeps the sheet inside its 88% cap so its ScrollView scrolls to the end (the order request's Send button
    // sat below the screen edge without it).
    sheet: { flexShrink: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
    sheetBody: { padding: 16, gap: 12 },
    emptyCart: { paddingVertical: 56, alignItems: 'center', gap: 10 },
    emptyCartText: { color: colors.secondaryText, fontSize: 15, fontWeight: '800' },
    sellerGroup: { padding: 12, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
    sellerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sellerName: { color: colors.text, fontSize: 15, fontWeight: '900' },
    requestButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: EHUB_ACTION_GREEN },
    requestButtonText: { flexShrink: 1, color: '#ffffff', fontSize: 14, fontWeight: '800' },
    cartItem: { padding: 12, backgroundColor: colors.surface, flexDirection: 'row', gap: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    cartImage: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control },
    cartTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    options: { marginTop: 2, color: colors.mutedText, fontSize: 12 },
    cartPrice: { marginTop: 4, color: colors.text, fontSize: 16, fontWeight: '800' },
    quantityRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepper: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    quantity: { minWidth: 24, textAlign: 'center', color: colors.text, fontSize: 15, fontWeight: '900' },
    removeButton: { marginLeft: 'auto', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.destructiveSurface },
    sheetFooter: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    totalLabel: { color: colors.secondaryText, fontSize: 14, fontWeight: '700' },
    totalText: { color: colors.text, fontSize: 16, fontWeight: '900' },
    amberNote: { padding: 12, borderRadius: 12, backgroundColor: colors.warningSurface },
    amberText: { color: colors.warningText, fontSize: 12, lineHeight: 18 },
    compare: { padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
    compareTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    compareTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    compareHint: { color: colors.successText, fontSize: 12 },
    clearButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    clearText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  });
}
