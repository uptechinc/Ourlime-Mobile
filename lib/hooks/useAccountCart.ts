import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { cartSyncService } from '@/lib/services/CartSyncService';
import { useMarketplaceStore } from '@/lib/store/useMarketplaceStore';
import type { MarketProduct, MarketVariant } from '@/lib/types/reliability';

export function useAccountCart(ownerId: string | null) {
  const state = useMarketplaceStore();
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
    useMarketplaceStore.getState().reset(ownerId);
    if (!ownerId) return;
    let active = true;
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
  const remove = useCallback(async (line: Parameters<typeof cartSyncService.remove>[1]) => {
    if (!ownerId) throw new Error('Sign in to update a cart.');
    const nextCart = await cartSyncService.remove(ownerId, line);
    useMarketplaceStore.getState().setCart(ownerId, nextCart, 'saved_on_device');
    void flush();
  }, [flush, ownerId]);
  return { ...state, setQuantity, remove, flush, resolve };
}
