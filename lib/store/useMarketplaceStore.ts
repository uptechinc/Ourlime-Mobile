import { create } from 'zustand';
import type { CartSnapshot, CatalogPage, SyncStatus } from '@/lib/types/reliability';
import type { ResourceState } from '@/lib/types/resourceState';
type MarketplaceState = { ownerId: string | null; cart: CartSnapshot; status: SyncStatus; error: string | null;
  catalogs: { [queryKey: string]: ResourceState<CatalogPage> };
  setCatalog: (queryKey: string, resource: ResourceState<CatalogPage>) => void;
  setCart: (ownerId: string, cart: CartSnapshot, status: SyncStatus) => void; reset: (ownerId: string | null) => void; fail: (ownerId: string, message: string) => void };
const emptyCart = (): CartSnapshot => ({ revision: 0, lines: [], pending: [], conflicts: [] });
export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  ownerId: null, cart: emptyCart(), status: 'saved_on_device', error: null, catalogs: {},
  reset: (ownerId) => set({ ownerId, cart: emptyCart(), status: 'saving', error: null, catalogs: {} }),
  setCatalog: (queryKey, resource) => set((state) => ({ catalogs: { ...state.catalogs, [queryKey]: resource } })),
  setCart: (ownerId, cart, status) => set((state) => state.ownerId === ownerId ? { cart, status, error: null } : {}),
  fail: (ownerId, message) => set((state) => state.ownerId === ownerId ? { status: 'failed', error: message } : {}),
}));
