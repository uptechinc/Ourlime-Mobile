import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { cartSyncService } from '@/lib/services/CartSyncService';
import { marketplaceService } from '@/lib/services/MarketplaceService';
import { marketSavedForLaterService } from '@/lib/services/MarketSavedForLaterService';
import { useMarketplaceStore } from '@/lib/store/useMarketplaceStore';
import type { MarketProduct, MarketSavedItem, MarketVariant } from '@/lib/types/reliability';

type CartLineToRemove = Parameters<typeof cartSyncService.remove>[1];

export function useAccountCart(ownerId: string | null) {
  const state = useMarketplaceStore();
  const [savedForLater, setSavedForLater] = useState<MarketSavedItem[]>([]);
  const flush = useCallback(async () => {
    if (!ownerId) return;
    try {
      const cart = await cartSyncService.sync(ownerId);
      useMarketplaceStore.getState().setCart(ownerId, cart, cart.conflicts.length ? 'conflict' : cart.pending.length ? 'saved_on_device' : 'synced');
    } catch (error: unknown) {
      useMarketplaceStore.getState().fail(ownerId, error instanceof Error ? error.message : 'Cart sync failed. Saved device edits are retained.');
    }
  }, [ownerId]);
  useEffect(() => {
    // Several Market screens use this hook at once (list, detail, checkout); only a new account clears the shared store.
    if (useMarketplaceStore.getState().ownerId !== ownerId) useMarketplaceStore.getState().reset(ownerId);
    setSavedForLater([]);
    if (!ownerId) return;
    let active = true;
    void marketSavedForLaterService.read(ownerId).then((items) => { if (active) setSavedForLater(items); });
    void cartSyncService.load(ownerId).then((cart) => {
      if (!active) return;
      useMarketplaceStore.getState().setCart(ownerId, cart, 'saved_on_device');
      void flush();
    }).catch((error: unknown) => { if (active) useMarketplaceStore.getState().fail(ownerId, error instanceof Error ? error.message : 'Saved cart could not be read.'); });
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') void flush(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void flush(); }, 30000);
    return () => { active = false; subscription.remove(); clearInterval(interval); };
  }, [ownerId, flush]);
  const setQuantity = useCallback(async (product: MarketProduct, variant: MarketVariant, quantity: number) => {
    if (!ownerId) throw new Error('Sign in to save a cart.');
    try {
      const cart = await cartSyncService.setQuantity(ownerId, product, variant, quantity);
      useMarketplaceStore.getState().setCart(ownerId, cart, 'saved_on_device');
      void flush();
    } catch (error: unknown) { useMarketplaceStore.getState().fail(ownerId, error instanceof Error ? error.message : 'Cart save failed.'); throw error; }
  }, [flush, ownerId]);
  const resolve = useCallback(async (lineId: string, keep: 'local' | 'remote') => {
    if (!ownerId) return;
    const cart = await cartSyncService.resolve(ownerId, lineId, keep);
    useMarketplaceStore.getState().setCart(ownerId, cart, 'saved_on_device');
    void flush();
  }, [flush, ownerId]);
  const remove = useCallback(async (line: CartLineToRemove) => {
    if (!ownerId) throw new Error('Sign in to update a cart.');
    try {
      const nextCart = await cartSyncService.remove(ownerId, line);
      useMarketplaceStore.getState().setCart(ownerId, nextCart, 'saved_on_device');
      void flush();
    } catch (error: unknown) { useMarketplaceStore.getState().fail(ownerId, error instanceof Error ? error.message : 'Cart update failed.'); throw error; }
  }, [flush, ownerId]);
  /** Web saveForLaterAction: keep the item on this device and take it out of the synced cart. */
  const saveForLater = useCallback(async (line: CartLineToRemove) => {
    if (!ownerId) throw new Error('Sign in to save items for later.');
    setSavedForLater(await marketSavedForLaterService.save(ownerId, line));
    await remove(line);
  }, [ownerId, remove]);
  /** Web moveToCartAction, re-checked against the live listing so price and stock are current. */
  const moveToCart = useCallback(async (item: MarketSavedItem) => {
    if (!ownerId) throw new Error('Sign in to update a cart.');
    const product = await marketplaceService.product(ownerId, item.productId);
    const variant = product.variants.find((entry) => entry.id === item.variantId);
    if (!variant?.available) throw new Error(`${item.title} is no longer available in this option.`);
    const existing = useMarketplaceStore.getState().cart.lines.find((line) => !line.removed && line.productId === item.productId && line.variantId === item.variantId)?.quantity ?? 0;
    await setQuantity(product, variant, Math.min(variant.stock, 99, existing + item.quantity));
    setSavedForLater(await marketSavedForLaterService.remove(ownerId, item.productId, item.variantId));
  }, [ownerId, setQuantity]);
  const removeSaved = useCallback(async (item: MarketSavedItem) => {
    if (!ownerId) return;
    setSavedForLater(await marketSavedForLaterService.remove(ownerId, item.productId, item.variantId));
  }, [ownerId]);
  return { ...state, savedForLater, setQuantity, remove, flush, resolve, saveForLater, moveToCart, removeSaved };
}
