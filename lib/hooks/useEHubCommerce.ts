import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner-native';
import { useSavedIds } from '@/lib/hooks/useSavedItems';
import { useSavedStore } from '@/lib/store/useSavedStore';
import { EHubCommerceService, eHubCommerceService } from '@/lib/services/EHubCommerceService';
import type { EHubCartItem, EHubCartItemInput, EHubCartSellerGroup, EHubRecentlyViewedItem } from '@/lib/types/ehubCommerce';

export type EHubCommerce = {
  cart: EHubCartItem[];
  cartCount: number;
  cartTotal: number;
  /** Cart lines by storefront, for per-seller order requests. */
  cartGroups: EHubCartSellerGroup[];
  /** Saved eHub product ids (users/{uid}/saved, type ehub_product). */
  favorites: string[];
  recentlyViewed: EHubRecentlyViewedItem[];
  addToCart: (item: EHubCartItemInput) => boolean;
  removeFromCart: (itemId: string) => void;
  removeManyFromCart: (itemIds: string[]) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string, productTitle?: string, thumbnail?: string | null) => void;
  addRecentlyViewed: (item: Omit<EHubRecentlyViewedItem, 'viewedAt'>) => void;
};

const subscribe = (listener: () => void) => eHubCommerceService.subscribe(listener);
const getSnapshot = () => eHubCommerceService.getState();

/** The device-local E-Hub cart and recently viewed products, plus saved products (Saved), shared by every E-Hub screen. */
export function useEHubCommerce(): EHubCommerce {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addToCart = useCallback((item: EHubCartItemInput) => {
    const isAdded = eHubCommerceService.addToCart(item);
    if (isAdded) toast.success(`Added "${item.title}" to your E-Hub cart`);
    return isAdded;
  }, []);
  const removeFromCart = useCallback((itemId: string) => eHubCommerceService.removeFromCart(itemId), []);
  const removeManyFromCart = useCallback((itemIds: string[]) => eHubCommerceService.removeManyFromCart(itemIds), []);
  const updateQuantity = useCallback((itemId: string, quantity: number) => eHubCommerceService.updateQuantity(itemId, quantity), []);
  // Saved products are saved items now; the device-only list is uploaded once on sign-in (useSavedStore).
  const savedIds = useSavedIds('ehub_product');
  const favorites = useMemo(() => [...savedIds], [savedIds]);
  const toggleSaved = useSavedStore((store) => store.toggle);
  const isFavorite = useCallback((productId: string) => savedIds.has(productId), [savedIds]);
  const toggleFavorite = useCallback((productId: string, productTitle?: string, thumbnail?: string | null) => {
    if (!productId) return;
    void toggleSaved({ type: 'ehub_product', itemId: productId, snapshot: { title: productTitle || 'eHub product', thumbnail: thumbnail ?? null } });
  }, [toggleSaved]);
  const addRecentlyViewed = useCallback((item: Omit<EHubRecentlyViewedItem, 'viewedAt'>) => eHubCommerceService.addRecentlyViewed(item), []);

  const cartCount = useMemo(() => state.cart.reduce((total, item) => total + item.quantity, 0), [state.cart]);
  const cartGroups = useMemo(() => EHubCommerceService.groupCartBySeller(state.cart), [state.cart]);
  const cartTotal = useMemo(() => state.cart.reduce((total, item) => total + item.price * item.quantity, 0), [state.cart]);

  return {
    cart: state.cart, cartCount, cartTotal, cartGroups, favorites, recentlyViewed: state.recentlyViewed,
    addToCart, removeFromCart, removeManyFromCart, updateQuantity, isFavorite, toggleFavorite, addRecentlyViewed,
  };
}
