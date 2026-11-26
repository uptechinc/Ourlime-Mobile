import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSavedIds } from '@/lib/hooks/useSavedItems';
import { useSavedStore } from '@/lib/store/useSavedStore';
import { EHubCommerceService, eHubCommerceService } from '@/lib/services/EHubCommerceService';
import { cartFeedbackService } from '@/lib/services/CartFeedbackService';
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
  /** Adds (or raises the quantity of) a line and confirms it with a toast; `onViewCart` adds a "View cart" button to it. */
  addToCart: (item: EHubCartItemInput, options?: EHubAddToCartOptions) => boolean;
  removeFromCart: (itemId: string) => void;
  removeManyFromCart: (itemIds: string[]) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string, productTitle?: string, thumbnail?: string | null) => void;
  addRecentlyViewed: (item: Omit<EHubRecentlyViewedItem, 'viewedAt'>) => void;
};

export type EHubAddToCartOptions = { onViewCart?: () => void };

const subscribe = (listener: () => void) => eHubCommerceService.subscribe(listener);
const getSnapshot = () => eHubCommerceService.getState();

/** The device-local E-Hub cart and recently viewed products, plus saved products (Saved), shared by every E-Hub screen. */
export function useEHubCommerce(): EHubCommerce {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addToCart = useCallback((item: EHubCartItemInput, options?: EHubAddToCartOptions) => {
    const existing = eHubCommerceService.getState().cart.find((cartItem) => EHubCommerceService.isSameCartLine(cartItem, item));
    if (item.availableQuantity <= 0) { cartFeedbackService.failed('This product is out of stock.'); return false; }
    if (existing && existing.quantity >= item.availableQuantity) {
      cartFeedbackService.atLimit(existing.quantity, { onViewCart: options?.onViewCart });
      return false;
    }
    const isAdded = eHubCommerceService.addToCart(item);
    if (!isAdded) { cartFeedbackService.failed('This product could not be added. Try again.'); return false; }
    const line = eHubCommerceService.getState().cart.find((cartItem) => EHubCommerceService.isSameCartLine(cartItem, item));
    cartFeedbackService.added({ title: item.title, quantityInCart: line?.quantity ?? item.quantity, wasInCart: Boolean(existing), onViewCart: options?.onViewCart });
    return true;
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
