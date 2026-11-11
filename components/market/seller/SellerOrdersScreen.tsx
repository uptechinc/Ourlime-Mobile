import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, ExternalLink, MapPin, Package, Send, Truck, X } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SellerButton } from '@/components/ehub/EHubSellerFormParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useSellerOrders } from '@/lib/hooks/useSellerOrders';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import type { SellerOrder, SellerOrderStatus, ShipmentDetails } from '@/lib/types/marketListing';
import SellerScreenFrame, { SellerLoading } from './SellerScreenFrame';
import { ListingInput } from './ListingFormParts';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';
/** Website STATUS_BADGES (profile/products/orders). */
const STATUS_BADGES: { [status in SellerOrderStatus]: { label: string; tone: BadgeTone } } = {
  pending_payment: { label: 'Payment pending', tone: 'warning' }, paid: { label: 'Paid / confirmed', tone: 'success' },
  processing: { label: 'Processing', tone: 'info' }, shipped: { label: 'Shipped', tone: 'info' }, ready_for_pickup: { label: 'Ready for pickup', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' }, cancelled: { label: 'Cancelled', tone: 'danger' }, refund_pending: { label: 'Refund requested', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'muted' }, disputed: { label: 'Disputed', tone: 'danger' },
};
const DEFAULT_CARRIER = 'TTPost';

/** Website /profile/products/orders ("Order Fulfillment"): buyer orders and the seller's status changes. */
export default function SellerOrdersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, getDecision } = usePageAccess();
  const canMutate = getDecision('/market').canMutate;
  const orders = useSellerOrders(profile?.uid ?? null);
  const [shipping, setShipping] = useState<SellerOrder | null>(null);
  const [shipment, setShipment] = useState<ShipmentDetails>({ carrier: DEFAULT_CARRIER, trackingNumber: '', trackingUrl: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const run = async (order: SellerOrder, status: SellerOrderStatus) => {
    try {
      await orders.setStatus(order.id, status);
      setNotice({ type: 'success', message: `Order ${order.orderNumber} marked as ${STATUS_BADGES[status].label.toLowerCase()}.` });
    } catch (failure: unknown) {
      setNotice({ type: 'error', message: failure instanceof Error ? failure.message : 'Failed to update order status.' });
    }
  };
  const openShipping = (order: SellerOrder) => {
    setShipment({ carrier: order.fulfillmentDetails.carrier || DEFAULT_CARRIER, trackingNumber: order.fulfillmentDetails.trackingNumber ?? '', trackingUrl: order.fulfillmentDetails.trackingUrl ?? '' });
    setShipping(order);
  };
  const confirmShipment = async () => {
    if (!shipping || !shipment.trackingNumber.trim()) return;
    try {
      await orders.markShipped(shipping.id, shipment);
      setNotice({ type: 'success', message: `Order ${shipping.orderNumber} marked as shipped.` });
      setShipping(null);
    } catch (failure: unknown) {
      setNotice({ type: 'error', message: failure instanceof Error ? failure.message : 'Failed to update order status.' });
    }
  };
  const badgeStyle = (tone: BadgeTone) => tone === 'success' ? styles.badgeSuccess : tone === 'warning' ? styles.badgeWarning : tone === 'danger' ? styles.badgeDanger : tone === 'info' ? styles.badgeInfo : styles.badgeMuted;

  return <SellerScreenFrame title="Order fulfilment" subtitle="Shipments, pickup readiness and order status" fallbackRoute="/market/seller">
    {orders.isLoading ? <SellerLoading label="Loading orders…" /> : <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={orders.isRefreshing} onRefresh={() => void orders.refresh()} tintColor={colors.accent} />}>
      {orders.error ? <Pressable onPress={() => void orders.refresh()} style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{orders.error} Tap to retry.</Text></Pressable> : null}
      {!orders.error && !orders.orders.length ? <View style={styles.empty}>
        <Package size={44} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>No customer orders yet</Text>
        <Text style={styles.emptyText}>When customers purchase your listed products, their orders will appear here for fulfilment.</Text>
      </View> : null}
      {orders.orders.map((order) => {
        const badge = STATUS_BADGES[order.status];
        const busy = orders.busyOrderId === order.id;
        const canProcess = order.status === 'paid';
        const canShip = order.deliveryMethod === 'shipping' && (order.status === 'paid' || order.status === 'processing');
        const canReady = order.deliveryMethod === 'pickup' && (order.status === 'paid' || order.status === 'processing');
        const canDeliver = order.status === 'shipped' || order.status === 'ready_for_pickup';
        const trackingUrl = order.fulfillmentDetails.trackingUrl;
        return <View key={order.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.flex}>
              <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
              <Text style={styles.meta}>{order.buyerName} · {order.createdAtMs ? new Date(order.createdAtMs).toLocaleDateString() : '—'} · <Text style={{ textTransform: 'capitalize' }}>{order.deliveryMethod}</Text></Text>
            </View>
            <Text style={[styles.badge, badgeStyle(badge.tone)]}>{badge.label}</Text>
          </View>
          {order.items.map((item) => <View key={item.id || item.productId} style={styles.item}>
            <View style={styles.thumb}>{item.thumbnailImage ? <CachedImage uri={item.thumbnailImage} style={styles.fill} accessibilityLabel={item.title} /> : <Package size={18} color={colors.mutedText} />}</View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{[item.colorName, item.sizeName].filter(Boolean).join(' / ') || 'Standard'} · Qty {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatMarketPrice('', item.price * item.quantity)}</Text>
          </View>)}
          <View style={styles.totalRow}><Text style={styles.meta}>Total (incl. shipping {formatMarketPrice('', order.shippingCost)})</Text><Text style={styles.total}>{formatMarketPrice('', order.total)}</Text></View>
          {order.shippingAddress ? <View style={styles.address}><MapPin size={14} color={colors.mutedText} /><Text style={[styles.meta, styles.flex]}>
            {order.shippingAddress.fullName} · {order.shippingAddress.addressLine1}{order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}, {order.shippingAddress.city}{order.shippingAddress.country ? `, ${order.shippingAddress.country}` : ''} · {order.shippingAddress.phone}
          </Text></View> : null}
          {order.fulfillmentDetails.trackingNumber ? <View style={styles.address}><Truck size={14} color={colors.mutedText} /><Text style={[styles.meta, styles.flex]}>{order.fulfillmentDetails.carrier || 'Carrier'} · {order.fulfillmentDetails.trackingNumber}</Text>
            {trackingUrl ? <Pressable accessibilityRole="link" accessibilityLabel="Open tracking link" hitSlop={8} onPress={() => void Linking.openURL(trackingUrl).catch(() => setNotice({ type: 'error', message: 'The tracking link could not be opened.' }))}><ExternalLink size={16} color={colors.accentText} /></Pressable> : null}
          </View> : null}
          {canMutate && (canProcess || canShip || canReady || canDeliver) ? <View style={styles.actions}>
            {canProcess ? <SellerButton compact variant="secondary" label="Start processing" icon={<Clock size={15} color={colors.text} />} isLoading={busy} onPress={() => void run(order, 'processing')} /> : null}
            {canShip ? <SellerButton compact label="Mark shipped" icon={<Send size={15} color="#ffffff" />} disabled={busy} onPress={() => openShipping(order)} /> : null}
            {canReady ? <SellerButton compact label="Ready for pickup" icon={<MapPin size={15} color="#ffffff" />} isLoading={busy} onPress={() => void run(order, 'ready_for_pickup')} /> : null}
            {canDeliver ? <SellerButton compact label="Mark delivered" icon={<CheckCircle2 size={15} color="#ffffff" />} isLoading={busy} onPress={() => void run(order, 'delivered')} /> : null}
          </View> : null}
        </View>;
      })}
    </ScrollView>}

    <Modal visible={Boolean(shipping)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShipping(null)}>
      <KeyboardSafeView style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => { if (!orders.busyOrderId) setShipping(null); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={styles.flex}><Text style={styles.sheetTitle}>Ship order #{shipping?.orderNumber}</Text><Text style={styles.meta}>Enter carrier details and the tracking number for the buyer.</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => setShipping(null)}><X size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            <ListingInput label="Carrier name" value={shipment.carrier} maxLength={200} onChangeText={(carrier) => setShipment((current) => ({ ...current, carrier }))} placeholder="e.g. TTPost, DHL, FedEx, Local Courier" />
            <ListingInput label="Tracking number" required autoCapitalize="characters" maxLength={200} value={shipment.trackingNumber} onChangeText={(trackingNumber) => setShipment((current) => ({ ...current, trackingNumber }))} placeholder="e.g. TT-12345678" />
            <ListingInput label="Tracking URL (optional)" keyboardType="url" autoCapitalize="none" maxLength={2000} value={shipment.trackingUrl} onChangeText={(trackingUrl) => setShipment((current) => ({ ...current, trackingUrl }))} placeholder="https://track.carrier.com/..." />
            <View style={styles.actions}>
              <View style={styles.flex}><SellerButton variant="secondary" label="Cancel" disabled={Boolean(orders.busyOrderId)} onPress={() => setShipping(null)} /></View>
              <View style={styles.flex}><SellerButton label="Confirm shipment" isLoading={Boolean(shipping && orders.busyOrderId === shipping.id)} disabled={!shipment.trackingNumber.trim()} onPress={() => void confirmShipment()} /></View>
            </View>
          </ScrollView>
        </View>
      </KeyboardSafeView>
    </Modal>
    <CustomModal visible={Boolean(notice)} type={notice?.type ?? 'info'} title={notice?.type === 'error' ? 'Update failed' : 'Order updated'} message={notice?.message ?? ''} onClose={() => setNotice(null)} />
  </SellerScreenFrame>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  errorCard: { padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface },
  errorText: { color: colors.destructiveText, lineHeight: 18 },
  empty: { paddingVertical: 50, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.mutedText, textAlign: 'center', lineHeight: 19, fontSize: 13 },
  card: { padding: 14, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderNumber: { color: colors.text, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 2, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  badgeSuccess: { backgroundColor: colors.successSurface, color: colors.successText },
  badgeWarning: { backgroundColor: colors.warningSurface, color: colors.warningText },
  badgeDanger: { backgroundColor: colors.destructiveSurface, color: colors.destructiveText },
  badgeInfo: { backgroundColor: colors.control, color: colors.accentText },
  badgeMuted: { backgroundColor: colors.control, color: colors.secondaryText },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 46, height: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.control },
  itemTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  itemPrice: { color: colors.text, fontSize: 13, fontWeight: '800' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  total: { color: colors.text, fontSize: 16, fontWeight: '900' },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 12, backgroundColor: colors.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim },
  sheet: { maxHeight: '88%', padding: 18, paddingBottom: 30, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.canvas },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
});
