import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner-native';
import { eHubCommerceService } from '@/lib/services/EHubCommerceService';
import type { EHubCartItem, EHubCartItemInput, EHubRecentlyViewedItem } from '@/lib/types/ehubCommerce';

export type EHubCommerce = {
  cart: EHubCartItem[];
  cartCount: number;
  cartTotal: number;
  favorites: string[];
  recentlyViewed: EHubRecentlyViewedItem[];
  addToCart: (item: EHubCartItemInput) => boolean;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string, productTitle?: string) => void;
  addRecentlyViewed: (item: Omit<EHubRecentlyViewedItem, 'viewedAt'>) => void;
};

const subscribe = (listener: () => void) => eHubCommerceService.subscribe(listener);
const getSnapshot = () => eHubCommerceService.getState();

/** The device-local E-Hub cart, saved products and recently viewed products, shared by every E-Hub screen. */
export function useEHubCommerce(): EHubCommerce {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addToCart = useCallback((item: EHubCartItemInput) => {
    const isAdded = eHubCommerceService.addToCart(item);
    if (isAdded) toast.success(`Added "${item.title}" to your E-Hub cart`);
    return isAdded;
  }, []);
  const removeFromCart = useCallback((itemId: string) => eHubCommerceService.removeFromCart(itemId), []);
  const updateQuantity = useCallback((itemId: string, quantity: number) => eHubCommerceService.updateQuantity(itemId, quantity), []);
  const isFavorite = useCallback((productId: string) => state.favorites.includes(productId), [state.favorites]);
  const toggleFavorite = useCallback((productId: string, productTitle?: string) => {
    const isSaved = eHubCommerceService.toggleFavorite(productId);
    toast.success(`${isSaved ? 'Saved' : 'Removed'} ${productTitle ?? 'product'}`);
  }, []);
  const addRecentlyViewed = useCallback((item: Omit<EHubRecentlyViewedItem, 'viewedAt'>) => eHubCommerceService.addRecentlyViewed(item), []);

  const cartCount = useMemo(() => state.cart.reduce((total, item) => total + item.quantity, 0), [state.cart]);
  const cartTotal = useMemo(() => state.cart.reduce((total, item) => total + item.price * item.quantity, 0), [state.cart]);

  return {
    cart: state.cart, cartCount, cartTotal, favorites: state.favorites, recentlyViewed: state.recentlyViewed,
    addToCart, removeFromCart, updateQuantity, isFavorite, toggleFavorite, addRecentlyViewed,
  };
}
