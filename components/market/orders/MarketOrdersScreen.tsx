import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ExternalLink, Package, Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { marketOrderService } from '@/lib/services/MarketOrderService';
import type { MarketOrder, MarketOrderStatus } from '@/lib/types/reliability';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import { MarketOrdersSkeleton } from '../MarketSkeletons';
import { MarketButton } from '../MarketFormModal';
import WriteReviewModal from '../reviews/WriteReviewModal';

type BadgeTone = 'pending' | 'positive' | 'info' | 'danger' | 'neutral';
const STATUS_BADGES: Record<MarketOrderStatus, { label: string; tone: BadgeTone }> = {
  pending_payment: { label: 'Payment Pending', tone: 'pending' },
  paid: { label: 'Paid / Confirmed', tone: 'positive' },
  processing: { label: 'Processing', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  ready_for_pickup: { label: 'Ready for Pickup', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'positive' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  refund_pending: { label: 'Refund Requested', tone: 'pending' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'danger' },
};
const isKnownStatus = (status: string): status is MarketOrderStatus => status in STATUS_BADGES;

/** Web app/market/orders/page.tsx: buyer order history with tracking, cancel, confirm received and review. */
export default function MarketOrdersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile, getDecision } = usePageAccess();
  const ownerId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; title: string } | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setOrders(await marketOrderService.buyerOrders(ownerId)); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Orders could not be loaded.'); }
    finally { setLoading(false); }
  }, [ownerId]);
  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (order: MarketOrder, next: 'cancelled' | 'delivered') => {
    if (busyOrderId) return;
    setBusyOrderId(order.id); setError(null); setNotice(null); setConfirmCancelId(null);
    try {
      if (next === 'cancelled') await marketOrderService.cancel(order.id); else await marketOrderService.confirmReceived(order.id);
      setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status: next } : entry));
      setNotice(next === 'cancelled' ? 'Order cancelled successfully.' : 'Confirmed item received! You can now leave a review.');
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : next === 'cancelled' ? 'Failed to cancel order' : 'Failed to confirm delivery');
    } finally { setBusyOrderId(null); }
  };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/market')} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.headerTitle}>My Orders</Text><Text style={styles.headerSubtitle}>Track shipments and write reviews</Text></View>
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={loading && orders.length > 0} onRefresh={() => void load()} tintColor={colors.accent} />} contentContainerStyle={styles.content}>
      {!ownerId ? <View style={styles.empty}><Package size={42} color={colors.mutedText} /><Text style={styles.emptyTitle}>Sign in to View Orders</Text><MarketButton label="Sign In" onPress={() => router.push('/(auth)/login')} /></View> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {error ? <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.errorBox}><Text style={{ color: colors.destructiveText }}>{error} Tap to retry.</Text></Pressable> : null}
      {ownerId && loading && !orders.length ? <MarketOrdersSkeleton /> : null}
      {ownerId && !loading && !error && !orders.length ? <View style={styles.empty}>
        <Package size={46} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>No orders placed yet</Text>
        <Text style={styles.emptyText}>Browse the marketplace and discover quality products from verified sellers.</Text>
        <MarketButton label="Start Shopping" onPress={() => router.replace('/market')} />
      </View> : null}
      {orders.map((order) => {
        const badge = isKnownStatus(order.status) ? STATUS_BADGES[order.status] : { label: order.status, tone: 'neutral' as BadgeTone };
        const tone = { pending: [colors.warningSurface, colors.warningText], positive: [colors.successSurface, colors.accentText], info: [colors.control, colors.text], danger: [colors.destructiveSurface, colors.destructiveText], neutral: [colors.control, colors.mutedText] }[badge.tone];
        const busy = busyOrderId === order.id;
        return <View key={order.id} style={[styles.card, busy && { opacity: 0.6 }]}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.kicker}>ORDER NUMBER</Text><Text style={styles.strong}>{order.orderNumber}</Text>
              <Text style={styles.muted}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''} · Total {formatMarketPrice('', order.total)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: tone[0] }]}><Text style={{ color: tone[1], fontSize: 11, fontWeight: '800' }}>{badge.label}</Text></View>
          </View>
          {order.items.map((item) => <View key={item.id} style={styles.itemRow}>
            {item.thumbnailImage ? <Image source={{ uri: item.thumbnailImage }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.control }]} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Pressable onPress={() => item.productId && router.push(`/market/${encodeURIComponent(item.productId)}` as Href)}><Text numberOfLines={2} style={styles.strong}>{item.title}</Text></Pressable>
              <Text style={styles.muted}>Qty: {item.quantity} • {formatMarketPrice('', item.price)} each • Seller: {item.sellerName}</Text>
              <Text style={styles.strong}>{formatMarketPrice('', item.price * item.quantity)}</Text>
              {order.status === 'delivered' && canMutate && item.productId ? <Pressable accessibilityRole="button" onPress={() => setReviewTarget({ productId: item.productId, title: item.title })} style={styles.linkButton}><Text style={styles.linkText}>Leave Review</Text></Pressable> : null}
            </View>
          </View>)}
          {order.fulfillmentDetails?.trackingNumber ? <View style={styles.tracking}>
            <Truck size={16} color={colors.accentText} />
            <Text style={[styles.body, { flex: 1 }]}>Carrier: {order.fulfillmentDetails.carrier ?? 'Courier'} • Tracking: {order.fulfillmentDetails.trackingNumber}</Text>
            {order.fulfillmentDetails.trackingUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(order.fulfillmentDetails?.trackingUrl ?? '')} style={styles.linkButton}><Text style={styles.linkText}>Track</Text><ExternalLink size={12} color={colors.accentText} /></Pressable> : null}
          </View> : null}
          {order.deliveryMethod === 'pickup' && order.fulfillmentDetails?.pickupLocation ? <Text style={styles.body}>Pickup: {order.fulfillmentDetails.pickupLocation}{order.fulfillmentDetails.pickupNotes ? ` · ${order.fulfillmentDetails.pickupNotes}` : ''}</Text> : null}
          <Text style={styles.muted}>Fulfillment: {order.deliveryMethod === 'shipping' ? 'Standard Delivery' : 'Direct Pickup'}</Text>
          {canMutate && marketOrderService.canConfirmReceived(order) ? <MarketButton label={busy ? 'Saving…' : 'Confirm Item Received'} disabled={busy} onPress={() => void changeStatus(order, 'delivered')} /> : null}
          {canMutate && marketOrderService.canCancel(order) ? confirmCancelId === order.id
            ? <View style={{ gap: 8 }}><Text style={styles.body}>Cancel this order? Items go back to the seller's stock.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable accessibilityRole="button" onPress={() => setConfirmCancelId(null)} style={[styles.outlineButton, { flex: 1 }]}><Text style={styles.strong}>Keep order</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => void changeStatus(order, 'cancelled')} style={[styles.outlineButton, { flex: 1, borderColor: colors.destructiveText }]}><Text style={{ color: colors.destructiveText, fontWeight: '900' }}>Cancel Order</Text></Pressable>
              </View></View>
            : <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmCancelId(order.id)} style={styles.outlineButton}><Text style={{ color: colors.destructiveText, fontWeight: '900' }}>Cancel Order</Text></Pressable> : null}
        </View>;
      })}
    </ScrollView>
    {reviewTarget ? <WriteReviewModal productId={reviewTarget.productId} productTitle={reviewTarget.title} onClose={() => setReviewTarget(null)} onSuccess={() => setNotice('Review submitted successfully!')} /> : null}
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, headerSubtitle: { color: colors.mutedText, fontSize: 11 },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  card: { padding: 14, gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  kicker: { color: colors.mutedText, fontSize: 10, fontWeight: '800' }, strong: { color: colors.text, fontWeight: '800' }, muted: { color: colors.mutedText, fontSize: 12 }, body: { color: colors.secondaryText, lineHeight: 19 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  itemRow: { flexDirection: 'row', gap: 10 }, thumb: { width: 60, height: 60, borderRadius: 10 },
  tracking: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.control },
  linkButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }, linkText: { color: colors.accentText, fontWeight: '800' },
  outlineButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  notice: { padding: 12, borderRadius: 12, overflow: 'hidden', color: colors.accentText, backgroundColor: colors.successSurface },
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  empty: { paddingVertical: 40, paddingHorizontal: 18, alignItems: 'center', gap: 10 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, emptyText: { color: colors.mutedText, textAlign: 'center' },
});
