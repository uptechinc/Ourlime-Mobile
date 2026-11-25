import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EHubCartItem, EHubCartItemInput, EHubCartSellerGroup, EHubCommerceState, EHubRecentlyViewedItem } from '@/lib/types/ehubCommerce';

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

  /** Same product with the same options; size "M" and colour "M" are different lines. */
  public static isSameCartLine(
    left: Pick<EHubCartItemInput, 'productId' | 'selectedVariant' | 'selectedSize' | 'selectedColour'>,
    right: Pick<EHubCartItemInput, 'productId' | 'selectedVariant' | 'selectedSize' | 'selectedColour'>,
  ): boolean {
    const option = (value: string | null | undefined): string => value ?? '';
    return left.productId === right.productId && option(left.selectedVariant) === option(right.selectedVariant)
      && option(left.selectedSize) === option(right.selectedSize) && option(left.selectedColour) === option(right.selectedColour);
  }

  /** The short id carts have always used; a labelled one only when that would clash with a different line. */
  public static createCartItemId(item: Pick<EHubCartItemInput, 'productId' | 'selectedVariant' | 'selectedSize' | 'selectedColour'>, cart: EHubCartItem[]): string {
    const shortId = EHubCommerceService.getCartItemId(item);
    if (!cart.some((cartItem) => cartItem.id === shortId)) return shortId;
    return [item.productId, `v:${item.selectedVariant ?? ''}`, `s:${item.selectedSize ?? ''}`, `c:${item.selectedColour ?? ''}`].join('|');
  }

  /** Adds the item, or raises the quantity of the same product with the same options, never past the stock. */
  public addToCart(item: EHubCartItemInput): boolean {
    if (!item.productId || item.availableQuantity <= 0) return false;
    const existingItem = this.state.cart.find((cartItem) => EHubCommerceService.isSameCartLine(cartItem, item));
    const id = existingItem ? existingItem.id : EHubCommerceService.createCartItemId(item, this.state.cart);
    const cart = existingItem
      ? this.state.cart.map((cartItem) => cartItem.id === id
        ? { ...cartItem, ...item, id, quantity: Math.min(cartItem.quantity + item.quantity, item.availableQuantity) }
        : cartItem)
      : [...this.state.cart, { ...item, id, quantity: Math.min(Math.max(1, item.quantity), item.availableQuantity) }];
    this.setState({ ...this.state, cart });
    return true;
  }

  /** Cart lines by storefront (sellerId is the storefront id), in the order each storefront was first added. */
  public static groupCartBySeller(cart: EHubCartItem[]): EHubCartSellerGroup[] {
    const groups = new Map<string, EHubCartSellerGroup>();
    cart.forEach((item) => {
      const group = groups.get(item.sellerId) ?? { sellerId: item.sellerId, sellerName: item.sellerName, items: [], subtotal: 0, deliveryAvailable: true, pickupAvailable: true };
      group.items.push(item);
      group.subtotal = Math.round((group.subtotal + item.price * item.quantity) * 100) / 100;
      group.deliveryAvailable = group.deliveryAvailable && item.deliveryAvailable;
      // Matches the server: pickup is refused only for a product that offers delivery but not pickup.
      group.pickupAvailable = group.pickupAvailable && (item.pickupAvailable || !item.deliveryAvailable);
      groups.set(item.sellerId, group);
    });
    return [...groups.values()];
  }

  /** Removes several lines at once (the lines of an order request that was just sent). */
  public removeManyFromCart(itemIds: string[]): void {
    if (!itemIds.length) return;
    this.setState({ ...this.state, cart: this.state.cart.filter((item) => !itemIds.includes(item.id)) });
  }

  public removeFromCart(itemId: string): void {
    if (!itemId) return;
    this.setState({ ...this.state, cart: this.state.cart.filter((item) => item.id !== itemId) });
  }

  /** Whole units only: less than 1 removes the item; more than the stock is capped at the stock. */
  public updateQuantity(itemId: string, quantity: number): void {
    if (!itemId || !Number.isFinite(quantity)) return;
    // Rounded down before the check, so 0.5 removes the line instead of leaving one of 0 units the seller refuses.
    const wholeQuantity = Math.floor(quantity);
    if (wholeQuantity <= 0) { this.removeFromCart(itemId); return; }
    this.setState({
      ...this.state,
      cart: this.state.cart.map((item) => item.id === itemId ? { ...item, quantity: Math.min(wholeQuantity, item.availableQuantity) } : item),
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

  /**
   * Hands over the saved products kept on this device before they moved to the member's Saved list
   * (users/{uid}/saved) and clears them here. Called once after sign-in.
   */
  public async takeDeviceFavorites(): Promise<string[]> {
    await this.load();
    const favorites = this.state.favorites;
    if (favorites.length === 0) return [];
    this.setState({ ...this.state, favorites: [] });
    return favorites;
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
