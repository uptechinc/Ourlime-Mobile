import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { useAccountCart } from '@/lib/hooks/useAccountCart';
import { marketplaceService } from '@/lib/services/MarketplaceService';
import type { CartLine, SyncStatus } from '@/lib/types/reliability';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import MarketFormModal, { MarketButton } from '../MarketFormModal';
import QuantityStepper from '../QuantityStepper';

type AccountCart = ReturnType<typeof useAccountCart>;
type MarketCartModalProps = { ownerId: string | null; canMutate: boolean; cart: AccountCart; onClose: () => void };

const CART_STATUS_LABELS: Record<SyncStatus, string> = {
  saving: 'Saving your cart…',
  saved_on_device: 'Saved on this device.',
  syncing: 'Syncing with your account…',
  synced: 'Synced with your account.',
  offline: 'Offline. Changes will sync when you reconnect.',
  failed: 'Sync failed. Tap Save Cart to retry.',
  conflict: 'Your devices disagree on some quantities.',
};

/** Saved cart (web MarketCartDrawer): lines grouped by seller, save for later, shipping and 5% tax estimate. */
export default function MarketCartModal({ ownerId, canMutate, cart, onClose }: MarketCartModalProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<Map<string, CartLine>>(new Map());
  const visibleLines = useMemo(() => cart.cart.lines.filter((line) => !line.removed), [cart.cart.lines]);
  const productKey = [...new Set(visibleLines.map((line) => line.productId))].sort().join('|');
  // Seller details only change per product, not per quantity edit.
  const linesRef = useRef(visibleLines);
  linesRef.current = visibleLines;

  useEffect(() => {
    if (!ownerId || !productKey) return;
    let active = true;
    void marketplaceService.enrichLines(ownerId, linesRef.current).then((lines) => {
      if (active) setEnriched(new Map(lines.map((line) => [line.productId, line])));
    });
    return () => { active = false; };
  }, [ownerId, productKey]);

  const lines = visibleLines.map((line) => {
    const details = enriched.get(line.productId);
    return details ? { ...line, sellerId: details.sellerId, sellerName: details.sellerName, shippingCost: details.shippingCost, deliveryAvailable: details.deliveryAvailable, pickupAvailable: details.pickupAvailable } : line;
  });
  const groups = marketplaceService.sellerGroups(lines);
  const totals = marketplaceService.totals(lines, 'shipping');
  const currency = lines.length && lines.every((line) => line.currency === lines[0].currency) ? lines[0].currency : '';

  const run = (lineId: string, operation: () => Promise<unknown>) => {
    if (busyLineId) return;
    setBusyLineId(lineId); setError('');
    void operation().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Action failed. Please retry.')).then(() => setBusyLineId(null));
  };
  const handleQuantity = async (line: CartLine, quantity: number) => {
    if (!ownerId || !canMutate) throw new Error('Sign in to update this cart.');
    if (quantity === 0) { await cart.remove(line); return; }
    const product = await marketplaceService.product(ownerId, line.productId);
    const variant = product.variants.find((entry) => entry.id === line.variantId);
    if (!variant) throw new Error('Variant is unavailable. Remove this item or retry later.');
    await cart.setQuantity(product, variant, quantity);
  };
  const go = (path: '/market/checkout' | '/market/orders') => { onClose(); router.push(path as Href); };

  return <MarketFormModal visible title="Saved cart" onClose={onClose}>
    <View style={{ padding: 12, borderRadius: 13, backgroundColor: colors.warningSurface }}><Text style={{ color: colors.warningText, lineHeight: 18 }}>{ownerId ? `${CART_STATUS_LABELS[cart.status]} Items do not reserve stock.` : 'Sign in to save and sync a cart.'}</Text></View>
    {cart.error || error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText }}>{error || cart.error}</Text> : null}
    {!lines.length ? <View style={{ paddingVertical: 30, alignItems: 'center', gap: 9 }}><ShoppingBag color={colors.mutedText} size={40} /><Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Your cart is empty</Text><Text style={{ color: colors.mutedText, textAlign: 'center' }}>Products you add will stay here until you remove them.</Text></View> : null}
    {groups.map((group) => <View key={group.sellerId} style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900' }}>{group.sellerName}</Text>
      {group.lines.map((line) => <View key={line.id} style={{ padding: 10, flexDirection: 'row', gap: 11, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: busyLineId === line.id ? 0.6 : 1 }}>
        {line.image ? <Image source={{ uri: line.image }} style={{ width: 78, height: 78, borderRadius: 11 }} /> : <View style={{ width: 78, height: 78, borderRadius: 11, backgroundColor: colors.control }} />}
        <View style={{ flex: 1, gap: 6 }}>
          <Pressable onPress={() => { onClose(); router.push(`/market/${encodeURIComponent(line.productId)}` as Href); }}><Text numberOfLines={2} style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{line.title}</Text></Pressable>
          {line.variantLabel && line.variantLabel !== 'Standard' ? <Text style={{ color: colors.mutedText, fontSize: 11 }}>{line.variantLabel}</Text> : null}
          <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '900' }}>{formatMarketPrice(line.currency, line.price * line.quantity)}</Text>
          <QuantityStepper label={`quantity of ${line.title}`} value={line.quantity} canDecrease={canMutate && !busyLineId} canIncrease={canMutate && !busyLineId && line.quantity < 99}
            onDecrease={() => run(line.id, () => handleQuantity(line, line.quantity - 1))} onIncrease={() => run(line.id, () => handleQuantity(line, line.quantity + 1))} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable accessibilityRole="button" disabled={!canMutate} onPress={() => run(line.id, () => cart.saveForLater(line))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800' }}>Save for later</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!canMutate} onPress={() => run(line.id, () => handleQuantity(line, 0))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '800' }}>Remove</Text></Pressable>
          </View>
        </View>
      </View>)}
    </View>)}
    {lines.length ? <View style={{ padding: 14, gap: 6, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <TotalRow label="Subtotal" value={formatMarketPrice(currency, totals.subtotal)} />
      <TotalRow label="Estimated shipping" value={totals.shipping === 0 ? 'Free' : formatMarketPrice(currency, totals.shipping)} />
      <TotalRow label="Estimated tax (5%)" value={formatMarketPrice(currency, totals.tax)} />
      <TotalRow label="Estimated total" value={formatMarketPrice(currency, totals.total)} strong />
    </View> : null}
    {cart.cart.conflicts.map((conflict) => <View key={conflict.mutation.id} style={{ padding: 12, gap: 9, borderRadius: 14, backgroundColor: colors.warningSurface }}><Text style={{ color: colors.warningText }}>{conflict.mutation.line.title}: device quantity {conflict.mutation.line.quantity}; account quantity {conflict.remote.quantity}.</Text><MarketButton label="Keep device quantity" onPress={() => run(conflict.mutation.lineId, () => cart.resolve(conflict.mutation.lineId, 'local'))} /><MarketButton label="Keep account quantity" onPress={() => run(conflict.mutation.lineId, () => cart.resolve(conflict.mutation.lineId, 'remote'))} /></View>)}
    {cart.savedForLater.length ? <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Saved for later ({cart.savedForLater.length})</Text>
      {cart.savedForLater.map((item) => <View key={`${item.productId}:${item.variantId}`} style={{ padding: 10, flexDirection: 'row', gap: 11, alignItems: 'center', borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        {item.image ? <Image source={{ uri: item.image }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.control }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text>
          <Text style={{ color: colors.mutedText, fontSize: 11 }}>{formatMarketPrice(item.currency, item.price)} · Qty {item.quantity}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable accessibilityRole="button" disabled={!canMutate} onPress={() => run(`saved:${item.productId}`, () => cart.moveToCart(item))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800' }}>Move to cart</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => run(`saved:${item.productId}`, () => cart.removeSaved(item))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '800' }}>Remove</Text></Pressable>
          </View>
        </View>
      </View>)}
    </View> : null}
    {ownerId ? <>
      <MarketButton label="Proceed to checkout" disabled={!canMutate || !lines.length || Boolean(cart.cart.conflicts.length)} onPress={() => go('/market/checkout')} />
      <MarketButton label="Save Cart / Retry sync" disabled={!canMutate} onPress={() => void cart.flush()} />
      <Pressable accessibilityRole="button" onPress={() => go('/market/orders')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontWeight: '800' }}>My orders</Text></Pressable>
    </> : <MarketButton label="Sign in to save a cart" onPress={() => { onClose(); router.push('/(auth)/login'); }} />}
  </MarketFormModal>;
}

type TotalRowProps = { label: string; value: string; strong?: boolean };
function TotalRow({ label, value, strong }: TotalRowProps) {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text style={{ color: strong ? colors.text : colors.mutedText, fontWeight: strong ? '900' : '600' }}>{label}</Text>
    <Text style={{ color: colors.text, fontWeight: strong ? '900' : '700' }}>{value}</Text>
  </View>;
}
