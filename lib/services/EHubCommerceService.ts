import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EHubCartItem, EHubCartItemInput, EHubCommerceState, EHubRecentlyViewedItem } from '@/lib/types/ehubCommerce';

// Same keys as the website's localStorage (lib/ehub/EHubCommerceContext.tsx).
const CART_STORAGE_KEY = 'ourlime_ehub_cart_v2';
const FAVORITES_STORAGE_KEY = 'ourlime_ehub_favorites_v2';
const RECENT_STORAGE_KEY = 'ourlime_ehub_recent_v2';
const MAXIMUM_RECENTLY_VIEWED = 10;

type Listener = () => void;

/** The website's lib/ehub/EHubPricing.ts: a sale price only counts when it is below the regular price. */
export function normalizeEHubSalePrice(value: unknown, regularPrice: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const salePrice = Number(value);
  return Number.isFinite(salePrice) && salePrice >= 0 && salePrice < regularPrice ? salePrice : null;
}

export function getEHubCurrentPrice(regularPrice: number, salePrice: unknown): number {
  return normalizeEHubSalePrice(salePrice, regularPrice) ?? regularPrice;
}

/**
 * The website's EHubCommerceContext as a service: a preparation cart (not checkout), saved products and recently
 * viewed products, all kept on this device only. Screens subscribe through useEHubCommerce; every change is written
 * to AsyncStorage straight away.
 */
export class EHubCommerceService {
  private static instance: EHubCommerceService;
  private state: EHubCommerceState = { cart: [], favorites: [], recentlyViewed: [], isLoaded: false };
  private readonly listeners = new Set<Listener>();
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): EHubCommerceService {
    if (!EHubCommerceService.instance) EHubCommerceService.instance = new EHubCommerceService();
    return EHubCommerceService.instance;
  }

  public getState(): EHubCommerceState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    void this.load();
    return () => { this.listeners.delete(listener); };
  }

  /** Reads the stored lists once per app run. */
  public load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        const [cart, favorites, recentlyViewed] = await Promise.all([
          this.readArray<EHubCartItem>(CART_STORAGE_KEY),
          this.readArray<string>(FAVORITES_STORAGE_KEY),
          this.readArray<EHubRecentlyViewedItem>(RECENT_STORAGE_KEY),
        ]);
        // Anything changed before the read finished wins over the stored copy.
        this.setState({
          cart: this.state.cart.length ? this.state.cart : cart.filter((item) => typeof item?.id === 'string'),
          favorites: this.state.favorites.length ? this.state.favorites : favorites.filter((favorite) => typeof favorite === 'string'),
          recentlyViewed: this.state.recentlyViewed.length ? this.state.recentlyViewed : recentlyViewed.filter((item) => typeof item?.id === 'string'),
          isLoaded: true,
        }, false);
      })();
    }
    return this.loadPromise;
  }

  public static getCartItemId(item: Pick<EHubCartItemInput, 'productId' | 'selectedVariant' | 'selectedSize' | 'selectedColour'>): string {
    return [item.productId, item.selectedVariant, item.selectedSize, item.selectedColour].filter(Boolean).join('|');
  }

  /** Adds the item, or raises the quantity of the same product with the same options, never past the stock. */
  public addToCart(item: EHubCartItemInput): boolean {
    if (!item.productId || item.availableQuantity <= 0) return false;
    const id = EHubCommerceService.getCartItemId(item);
    const existingItem = this.state.cart.find((cartItem) => cartItem.id === id);
    const cart = existingItem
      ? this.state.cart.map((cartItem) => cartItem.id === id
        ? { ...cartItem, ...item, id, quantity: Math.min(cartItem.quantity + item.quantity, item.availableQuantity) }
        : cartItem)
      : [...this.state.cart, { ...item, id, quantity: Math.min(Math.max(1, item.quantity), item.availableQuantity) }];
    this.setState({ ...this.state, cart });
    return true;
  }

  public removeFromCart(itemId: string): void {
    if (!itemId) return;
    this.setState({ ...this.state, cart: this.state.cart.filter((item) => item.id !== itemId) });
  }

  /** 0 or less removes the item; more than the stock is capped at the stock. */
  public updateQuantity(itemId: string, quantity: number): void {
    if (!itemId || !Number.isFinite(quantity)) return;
    if (quantity <= 0) { this.removeFromCart(itemId); return; }
    this.setState({
      ...this.state,
      cart: this.state.cart.map((item) => item.id === itemId ? { ...item, quantity: Math.min(Math.floor(quantity), item.availableQuantity) } : item),
    });
  }

  public isFavorite(productId: string): boolean {
    return this.state.favorites.includes(productId);
  }

  /** Returns true when the product is now saved. */
  public toggleFavorite(productId: string): boolean {
    if (!productId) return false;
    const isSaved = this.isFavorite(productId);
    const favorites = isSaved ? this.state.favorites.filter((favoriteId) => favoriteId !== productId) : [...this.state.favorites, productId];
    this.setState({ ...this.state, favorites });
    return !isSaved;
  }

  /** Newest first, one entry per product, at most 10 (the website records these but does not show them yet). */
  public addRecentlyViewed(item: Omit<EHubRecentlyViewedItem, 'viewedAt'>): void {
    if (!item.id) return;
    const recentlyViewed = [
      { ...item, viewedAt: new Date().toISOString() },
      ...this.state.recentlyViewed.filter((recentItem) => recentItem.id !== item.id),
    ].slice(0, MAXIMUM_RECENTLY_VIEWED);
    this.setState({ ...this.state, recentlyViewed });
  }

  private setState(nextState: EHubCommerceState, shouldPersist = true): void {
    this.state = nextState;
    this.listeners.forEach((listener) => listener());
    if (shouldPersist) void this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [CART_STORAGE_KEY, JSON.stringify(this.state.cart)],
        [FAVORITES_STORAGE_KEY, JSON.stringify(this.state.favorites)],
        [RECENT_STORAGE_KEY, JSON.stringify(this.state.recentlyViewed)],
      ]);
    } catch (error: unknown) {
      console.error('[EHubCommerceService.persist] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async readArray<TValue>(key: string): Promise<TValue[]> {
    try {
      const value = await AsyncStorage.getItem(key);
      const parsed: unknown = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed as TValue[] : [];
    } catch (error: unknown) {
      console.error('[EHubCommerceService.readArray] Error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }
}

export const eHubCommerceService = EHubCommerceService.getInstance();
