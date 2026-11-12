import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { CheckCircle2, FileText, Lock, MapPin, ShieldCheck, Truck } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAccountCart } from '@/lib/hooks/useAccountCart';
import { marketplaceService, type CheckoutLineReview, type MarketCheckoutTotals } from '@/lib/services/MarketplaceService';
import { marketOrderService, type MarketDeliveryMethod, type MarketPlacedOrder } from '@/lib/services/MarketOrderService';
import type { CartLine, MarketShippingAddress } from '@/lib/types/reliability';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import { MarketButton, MarketField } from '../MarketFormModal';
import MarketPickupContact from './MarketPickupContact';

const EMPTY_ADDRESS: MarketShippingAddress = { fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'Trinidad and Tobago' };
const ACKNOWLEDGMENT = 'I have reviewed the product description, condition, price, seller information, shipping or pickup method, return policy, and total charges. I understand that seller identity verification does not mean Ourlime endorses the seller or guarantees the product. I will use the approved payment process and report suspicious requests, misleading listings, counterfeit products, or unsafe activity.';
const SAFETY_TIPS = ['Confirm shipping, pickup, and return terms before checkout.', 'Never pay outside approved checkout or share passwords.', 'Inspect items promptly upon receipt and report issues right away.'];

/** Web app/market/checkout/page.tsx: delivery method, pickup contacts or shipping address, Buyer Acknowledgment v1.0, totals. */
export default function MarketCheckoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile, getDecision } = usePageAccess();
  const ownerId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const cart = useAccountCart(ownerId);
  const visibleLines = useMemo(() => cart.cart.lines.filter((line) => !line.removed), [cart.cart.lines]);
  const [enriched, setEnriched] = useState<Map<string, CartLine>>(new Map());
  const [deliveryMethod, setDeliveryMethod] = useState<MarketDeliveryMethod>('shipping');
  const [address, setAddress] = useState<MarketShippingAddress>(EMPTY_ADDRESS);
  const [accepted, setAccepted] = useState(false);
  const [reviews, setReviews] = useState<CheckoutLineReview[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Web success screen is a printable receipt: buyer, date, delivery method, address, items and the totals breakdown.
  const [completed, setCompleted] = useState<CompletedReceipt | null>(null);
  const addressEdited = useRef(false);
  const linesRef = useRef(visibleLines);
  linesRef.current = visibleLines;
  const productKey = [...new Set(visibleLines.map((line) => line.productId))].sort().join('|');

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void marketplaceService.contact(ownerId).then((saved) => {
      if (!active || !saved || addressEdited.current) return;
      setAddress((current) => ({ ...current, fullName: saved.name, phone: saved.phone, addressLine1: saved.address, city: saved.city }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId || !productKey) return;
    let active = true;
    void marketplaceService.enrichLines(ownerId, linesRef.current).then((lines) => { if (active) setEnriched(new Map(lines.map((line) => [line.productId, line]))); });
    return () => { active = false; };
  }, [ownerId, productKey]);

  const lines = visibleLines.map((line) => {
    const details = enriched.get(line.productId);
    return details ? { ...line, sellerId: details.sellerId, sellerName: details.sellerName, shippingCost: details.shippingCost, deliveryAvailable: details.deliveryAvailable, pickupAvailable: details.pickupAvailable } : line;
  });
  const groups = marketplaceService.sellerGroups(lines);
  const totals = marketplaceService.totals(lines, deliveryMethod);
  const currency = lines.length && lines.every((line) => line.currency === lines[0].currency) ? lines[0].currency : '';
  const blocking = reviews?.filter((item) => item.reason || item.priceChanged) ?? [];

  const handleCheckItems = async () => {
    if (!ownerId || checking) return;
    setChecking(true); setCheckoutError(null);
    try { setReviews(await marketplaceService.review(ownerId, linesRef.current)); }
    catch (failure: unknown) { setCheckoutError(failure instanceof Error ? failure.message : 'Items could not be rechecked. Retry.'); }
    finally { setChecking(false); }
  };
  // Recheck when the set of products changes; quantity edits are rechecked by the button and when placing the order.
  const checkItemsRef = useRef(handleCheckItems);
  checkItemsRef.current = handleCheckItems;
  useEffect(() => { if (ownerId && productKey) void checkItemsRef.current(); }, [ownerId, productKey]);

  const handleAcceptPrice = async (line: CartLine) => {
    if (!ownerId) return;
    try {
      const product = await marketplaceService.product(ownerId, line.productId);
      const variant = product.variants.find((entry) => entry.id === line.variantId);
      if (!variant) throw new Error('Variant is unavailable. Remove this item or retry later.');
      await cart.setQuantity(product, variant, line.quantity);
      setReviews(null);
      void handleCheckItems();
    } catch (failure: unknown) { setCheckoutError(failure instanceof Error ? failure.message : 'Price acceptance failed. Retry.'); }
  };

  const handlePlaceOrder = async () => {
    if (submitting) return;
    setSubmitting(true); setCheckoutError(null);
    try {
      const checked = await marketplaceService.review(ownerId ?? '', linesRef.current);
      setReviews(checked);
      if (checked.some((item) => item.reason || item.priceChanged)) throw new Error('Some items changed. Review them above before placing your order.');
      const order = await marketOrderService.placeOrder({ lines, deliveryMethod, shippingAddress: address, acknowledged: accepted });
      setCompleted({ order, lines, totals, currency, deliveryMethod, address: deliveryMethod === 'shipping' ? address : null, placedAtMs: Date.now() });
      for (const line of linesRef.current) await cart.remove(line).catch(() => undefined);
    } catch (failure: unknown) {
      setCheckoutError(failure instanceof Error ? failure.message : 'Checkout failed');
    } finally { setSubmitting(false); }
  };

  const header = <View style={styles.header}>
    <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/market')} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
    <View style={{ flex: 1 }}><Text style={styles.headerTitle}>{completed ? 'Order sent' : 'Checkout'}</Text><Text style={styles.headerSubtitle}>Verify items, delivery preferences, and acknowledgment</Text></View>
  </View>;

  if (!ownerId) {
    return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>{header}
      <View style={styles.centerCard}><Lock size={40} color={colors.mutedText} /><Text style={styles.sectionTitle}>Sign in to Checkout</Text><Text style={styles.muted}>To place an order and track your purchases, please sign in to your Ourlime account.</Text><MarketButton label="Sign In" onPress={() => router.push('/(auth)/login')} /></View>
    </SafeAreaView>;
  }

  if (completed) {
    return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>{header}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.centerCard}><CheckCircle2 size={40} color={colors.accentText} /><Text style={styles.sectionTitle}>Order sent</Text>{completed.order.orderNumber ? <Text style={styles.muted}>Order Reference: <Text style={styles.cardSubtitle}>{completed.order.orderNumber}</Text></Text> : null}</View>
        <View style={styles.card}>
          {completed.address?.fullName ? <TotalRow label="Buyer" value={completed.address.fullName} colors={colors} /> : null}
          <TotalRow label="Date" value={new Date(completed.placedAtMs).toLocaleDateString()} colors={colors} />
          <TotalRow label="Delivery Method" value={completed.deliveryMethod === 'shipping' ? 'Shipping' : 'Pickup'} colors={colors} />
          {completed.address ? <TotalRow label="Address" value={`${completed.address.addressLine1}, ${completed.address.city}`} colors={colors} /> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Purchased Items</Text>
          {completed.lines.map((line) => <View key={line.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {line.image ? <Image source={{ uri: line.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.control }]} />}
            <View style={{ flex: 1 }}><Text numberOfLines={2} style={styles.cardSubtitle}>{line.title}</Text><Text style={styles.muted}>Qty: {line.quantity} • {formatMarketPrice(line.currency, line.price)} each</Text></View>
            <Text style={styles.cardSubtitle}>{formatMarketPrice(line.currency, line.price * line.quantity)}</Text>
          </View>)}
        </View>
        <View style={styles.card}>
          <TotalRow label="Subtotal" value={formatMarketPrice(completed.currency, completed.totals.subtotal)} colors={colors} />
          <TotalRow label="Shipping" value={formatMarketPrice(completed.currency, completed.totals.shipping)} colors={colors} />
          <TotalRow label="Tax" value={formatMarketPrice(completed.currency, completed.totals.tax)} colors={colors} />
          <TotalRow label="Total Paid" value={formatMarketPrice(completed.currency, completed.totals.total)} colors={colors} strong />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Share receipt" onPress={() => void Share.share({ message: receiptText(completed) }).catch(() => undefined)} style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
          <FileText size={18} color={colors.text} /><Text style={styles.cardSubtitle}>Share Receipt</Text>
        </Pressable>
        <MarketButton label="View Order History" onPress={() => router.replace('/market/orders' as Href)} />
      </ScrollView>
    </SafeAreaView>;
  }

  const setField = (key: keyof MarketShippingAddress) => (value: string) => { addressEdited.current = true; setAddress((current) => ({ ...current, [key]: value })); };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    {header}
    <KeyboardSafeView style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!lines.length ? <View style={styles.centerCard}><Text style={styles.sectionTitle}>Your cart is empty</Text><MarketButton label="Back to Market" onPress={() => router.replace('/market')} /></View> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Method</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
            <ChoiceCard selected={deliveryMethod === 'shipping'} onSelect={() => setDeliveryMethod('shipping')} title="Standard shipping" description="Delivered to your address" icon={<Truck size={20} color={deliveryMethod === 'shipping' ? colors.accentText : colors.mutedText} />} colors={colors} />
            <ChoiceCard selected={deliveryMethod === 'pickup'} onSelect={() => setDeliveryMethod('pickup')} title="Direct pickup" description="Collect from seller" icon={<MapPin size={20} color={deliveryMethod === 'pickup' ? colors.accentText : colors.mutedText} />} colors={colors} />
          </View>
          {deliveryMethod === 'pickup' ? <View accessibilityLabel="Pickup seller contacts" style={styles.pickupBox}>
            <Text style={styles.cardSubtitle}>Pickup seller contacts</Text>
            {groups.map((group) => <View key={group.sellerId} style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{group.sellerName}</Text>
              {[...new Map(group.lines.map((line) => [line.productId, line])).values()].map((line) => <MarketPickupContact key={line.productId} ownerId={ownerId} productId={line.productId} productTitle={line.title} />)}
            </View>)}
          </View> : null}
        </View>

        {deliveryMethod === 'shipping' ? <View style={styles.card}>
          <Text style={styles.cardTitle}>Shipping Address</Text>
          <MarketField label="Full name *" value={address.fullName} onChangeText={setField('fullName')} />
          <MarketField label="Phone number *" value={address.phone} onChangeText={setField('phone')} keyboardType="phone-pad" />
          <MarketField label="Street address *" value={address.addressLine1} onChangeText={setField('addressLine1')} />
          <MarketField label="Address line 2" value={address.addressLine2} onChangeText={setField('addressLine2')} />
          <MarketField label="City / town *" value={address.city} onChangeText={setField('city')} />
          <MarketField label="State / region" value={address.state} onChangeText={setField('state')} />
          <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Country</Text><View style={[styles.readOnly]}><Text style={{ color: colors.mutedText }}>{address.country}</Text></View></View>
        </View> : null}

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ShieldCheck size={20} color={colors.accentText} /><Text style={styles.cardTitle}>Buyer Acknowledgment & Safety</Text></View>
          <View style={styles.ackBox}><Text style={styles.body}>{ACKNOWLEDGMENT}</Text></View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)} style={styles.checkRow}>
            <View style={[styles.checkbox, accepted && { backgroundColor: colors.accent, borderColor: colors.accent }]}>{accepted ? <Text style={{ color: colors.onAccent, fontWeight: '900' }}>✓</Text> : null}</View>
            <Text style={[styles.body, { flex: 1 }]}>I have read, understood, and agree to the Buyer Acknowledgment, Marketplace Policy, and Terms of Service. *</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Safety guidance for buyers:</Text>
          {SAFETY_TIPS.map((tip) => <Text key={tip} style={styles.muted}>• {tip}</Text>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary ({lines.length} {lines.length === 1 ? 'item' : 'items'})</Text>
          {lines.map((line) => {
            const review = reviews?.find((item) => item.line.id === line.id);
            return <View key={line.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {line.image ? <Image source={{ uri: line.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.control }]} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '800' }}>{line.title}</Text>
                  <Text style={styles.muted}>Qty: {line.quantity}{line.variantLabel && line.variantLabel !== 'Standard' ? ` · ${line.variantLabel}` : ''}</Text>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{formatMarketPrice(line.currency, line.price * line.quantity)}</Text>
                </View>
              </View>
              {review?.reason ? <Text style={{ color: colors.destructiveText }}>{review.reason}</Text> : null}
              {review && !review.reason && review.priceChanged ? <View style={{ gap: 6 }}><Text style={{ color: colors.warningText }}>Price changed to {formatMarketPrice(line.currency, review.currentPrice ?? 0)}. Acceptance required.</Text><MarketButton label="Accept updated price" onPress={() => void handleAcceptPrice(line)} /></View> : null}
            </View>;
          })}
          <Pressable accessibilityRole="button" disabled={checking} onPress={() => void handleCheckItems()} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontWeight: '800' }}>{checking ? 'Checking price and stock…' : reviews ? (blocking.length ? `${blocking.length} item(s) need attention · Recheck` : 'Price and stock checked · Recheck') : 'Check price and stock'}</Text></Pressable>
          <View style={styles.divider} />
          <TotalRow label="Subtotal" value={formatMarketPrice(currency, totals.subtotal)} colors={colors} />
          <TotalRow label="Shipping" value={deliveryMethod === 'shipping' ? (totals.shipping === 0 ? 'Free' : formatMarketPrice(currency, totals.shipping)) : `${formatMarketPrice(currency, 0)} (Pickup)`} colors={colors} />
          <TotalRow label="Estimated Tax (5%)" value={formatMarketPrice(currency, totals.tax)} colors={colors} />
          <TotalRow label="Total Amount" value={formatMarketPrice(currency, totals.total)} colors={colors} strong />
        </View>

        {checkoutError ? <Text accessibilityRole="alert" style={styles.errorBox}>{checkoutError}</Text> : null}
        <MarketButton label={submitting ? 'Placing order…' : 'Place Order & Pay'} disabled={submitting || !lines.length || !canMutate || Boolean(cart.cart.conflicts.length)} onPress={() => void handlePlaceOrder()} />
        <Text style={[styles.muted, { textAlign: 'center' }]}>Stock is not reserved until an order is placed.</Text>
      </ScrollView>
    </KeyboardSafeView>
  </SafeAreaView>;
}

type ChoiceCardProps = { selected: boolean; onSelect: () => void; title: string; description: string; icon: ReactNode; colors: AppThemeColors };
function ChoiceCard({ selected, onSelect, title, description, icon, colors }: ChoiceCardProps) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onSelect} style={{ flex: 1, minHeight: 96, padding: 12, gap: 6, borderRadius: 14, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.successSurface : colors.surface }}>
    {icon}
    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>{title}</Text>
    <Text style={{ color: colors.mutedText, fontSize: 11 }}>{description}</Text>
  </Pressable>;
}

type TotalRowProps = { label: string; value: string; colors: AppThemeColors; strong?: boolean };
type CompletedReceipt = { order: MarketPlacedOrder; lines: CartLine[]; totals: MarketCheckoutTotals; currency: string; deliveryMethod: MarketDeliveryMethod; address: MarketShippingAddress | null; placedAtMs: number };

/** Plain-text receipt for the share sheet (the phone counterpart of the web's Print Receipt). */
function receiptText(receipt: CompletedReceipt): string {
  return [
    `Ourlime order ${receipt.order.orderNumber || receipt.order.orderId}`,
    `Date: ${new Date(receipt.placedAtMs).toLocaleDateString()}`,
    `Delivery: ${receipt.deliveryMethod === 'shipping' ? 'Shipping' : 'Pickup'}`,
    ...(receipt.address ? [`Address: ${receipt.address.addressLine1}, ${receipt.address.city}`] : []),
    '',
    ...receipt.lines.map((line) => `${line.title} × ${line.quantity}: ${formatMarketPrice(line.currency, line.price * line.quantity)}`),
    '',
    `Subtotal: ${formatMarketPrice(receipt.currency, receipt.totals.subtotal)}`,
    `Shipping: ${formatMarketPrice(receipt.currency, receipt.totals.shipping)}`,
    `Tax: ${formatMarketPrice(receipt.currency, receipt.totals.tax)}`,
    `Total paid: ${formatMarketPrice(receipt.currency, receipt.totals.total)}`,
  ].join('\n');
}

function TotalRow({ label, value, colors, strong }: TotalRowProps) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text style={{ color: strong ? colors.text : colors.mutedText, fontWeight: strong ? '900' : '600' }}>{label}</Text>
    <Text style={{ flexShrink: 1, textAlign: 'right', color: colors.text, fontWeight: strong ? '900' : '700' }}>{value}</Text>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, headerSubtitle: { color: colors.mutedText, fontSize: 11 },
  content: { padding: 14, paddingBottom: 40, gap: 16 },
  card: { padding: 14, gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' }, cardSubtitle: { color: colors.text, fontWeight: '800' },
  pickupBox: { padding: 12, gap: 12, borderRadius: 14, backgroundColor: colors.control },
  readOnly: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  ackBox: { padding: 12, borderRadius: 12, backgroundColor: colors.control },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44 },
  checkbox: { width: 24, height: 24, marginTop: 2, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 10 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900', textAlign: 'center' }, body: { color: colors.secondaryText, lineHeight: 19 }, muted: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  centerCard: { padding: 20, gap: 10, alignItems: 'center', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, margin: 14 },
  errorBox: { padding: 12, borderRadius: 12, overflow: 'hidden', color: colors.destructiveText, backgroundColor: colors.destructiveSurface, lineHeight: 19 },
});
