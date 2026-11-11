// Mirrors the website's lib/types/ehubCommerce.ts: the device-local E-Hub preparation cart, saved products and
// recently viewed products (stored in AsyncStorage like the website's localStorage).
export type EHubCartItem = {
  /** productId plus the chosen variant, size and colour, joined with "|". */
  id: string;
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number | null;
  quantity: number;
  availableQuantity: number;
  sellerId: string;
  sellerName: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  selectedVariant: string | null;
  selectedSize: string | null;
  selectedColour: string | null;
};

export type EHubCartItemInput = Omit<EHubCartItem, 'id'>;

export type EHubRecentlyViewedItem = {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  category: string;
  viewedAt: string;
};

export type EHubCommerceState = {
  cart: EHubCartItem[];
  favorites: string[];
  recentlyViewed: EHubRecentlyViewedItem[];
  isLoaded: boolean;
};
