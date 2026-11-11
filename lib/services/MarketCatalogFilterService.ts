import type { MarketProduct, MarketProductCondition } from '@/lib/types/reliability';

export type MarketSort = 'default' | 'newest' | 'price-low-high' | 'price-high-low' | 'rating' | 'popularity';
export type MarketSellerTypeFilter = 'all' | 'business' | 'personal';
export type MarketCondition = Exclude<MarketProductCondition, null>;
export type MarketFilters = {
  categories: string[]; conditions: MarketCondition[]; colors: string[]; sizes: string[]; sellerType: MarketSellerTypeFilter;
  inStockOnly: boolean; deliveryOnly: boolean; pickupOnly: boolean; favoritesOnly: boolean;
  /** Web price range is [0, max] with max 0..10000; 10000 means "no limit". */
  maxPrice: number;
};

export const MARKET_PRICE_CEILING = 10000;
export const EMPTY_MARKET_FILTERS: MarketFilters = {
  categories: [], conditions: [], colors: [], sizes: [], sellerType: 'all', inStockOnly: false, deliveryOnly: false, pickupOnly: false, favoritesOnly: false, maxPrice: MARKET_PRICE_CEILING,
};

/** Client-side copy of the web MarketService.filterProducts rules, applied to the listings loaded so far. */
export class MarketCatalogFilterService {
  private static instance: MarketCatalogFilterService;

  private constructor() {}

  public static getInstance(): MarketCatalogFilterService {
    if (!MarketCatalogFilterService.instance) MarketCatalogFilterService.instance = new MarketCatalogFilterService();
    return MarketCatalogFilterService.instance;
  }

  public activeCount(filters: MarketFilters): number {
    return filters.categories.length + filters.conditions.length + filters.colors.length + filters.sizes.length
      + Number(filters.sellerType !== 'all') + Number(filters.inStockOnly) + Number(filters.deliveryOnly) + Number(filters.pickupOnly)
      + Number(filters.favoritesOnly) + Number(filters.maxPrice < MARKET_PRICE_CEILING);
  }

  /** Web "Maximum price ($)" validation: a whole number from 0 to 10,000. */
  public parseMaxPrice(input: string): number | null {
    if (!/^\d+$/.test(input.trim())) return null;
    const value = Number(input.trim());
    return value >= 0 && value <= MARKET_PRICE_CEILING ? value : null;
  }

  /** Listing price for range and sort: variants when the listing has real variants, else salePrice ?? originalPrice. */
  public prices(product: MarketProduct): number[] {
    const realVariants = product.variants.filter((variant) => !variant.isBase && variant.id !== 'base');
    if (realVariants.length) return realVariants.map((variant) => variant.price);
    return [product.salePrice ?? product.originalPrice ?? product.variants[0]?.price ?? 0];
  }

  public matchesSearch(product: MarketProduct, search: string): boolean {
    const term = search.normalize('NFKC').toLocaleLowerCase('en-US').trim();
    if (!term) return true;
    return [product.title, product.shortDescription, product.description, product.category, product.sellerName, ...product.tags]
      .some((field) => field.toLocaleLowerCase('en-US').includes(term));
  }

  public apply(products: readonly MarketProduct[], filters: MarketFilters, search: string, favoriteIds: readonly string[], sort: MarketSort): MarketProduct[] {
    const filtered = products.filter((product) => {
      if (!this.matchesSearch(product, search)) return false;
      if (filters.categories.length && !filters.categories.includes(product.category)) return false;
      if (filters.colors.length && !product.variants.some((variant) => variant.colorName && filters.colors.includes(variant.colorName))) return false;
      if (filters.sizes.length && !product.variants.some((variant) => variant.sizeName && filters.sizes.includes(variant.sizeName))) return false;
      if (filters.maxPrice < MARKET_PRICE_CEILING && !this.prices(product).some((price) => price >= 0 && price <= filters.maxPrice)) return false;
      if (filters.inStockOnly && product.variants.length && !product.variants.some((variant) => variant.stock > 0)) return false;
      if (filters.conditions.length && !filters.conditions.includes(product.condition ?? 'new')) return false;
      if (filters.deliveryOnly && product.deliveryAvailable !== true) return false;
      if (filters.pickupOnly && product.pickupAvailable !== true) return false;
      if (filters.sellerType !== 'all' && product.sellerType !== filters.sellerType) return false;
      if (filters.favoritesOnly && !favoriteIds.includes(product.id)) return false;
      return true;
    });
    if (sort === 'default') return filtered;
    const minimum = (product: MarketProduct) => product.salePrice ?? Math.min(...this.prices(product));
    return [...filtered].sort((first, second) => {
      switch (sort) {
        case 'price-low-high': return minimum(first) - minimum(second);
        case 'price-high-low': return minimum(second) - minimum(first);
        case 'newest': return (second.createdAtMs ?? 0) - (first.createdAtMs ?? 0);
        case 'rating': return (second.rating ?? 0) - (first.rating ?? 0);
        case 'popularity': return (second.popularity || second.ratingCount) - (first.popularity || first.ratingCount);
        default: return 0;
      }
    });
  }

  /** Distinct colour and size names across the loaded listings, for the filter sheet. */
  public facets(products: readonly MarketProduct[]): { colors: { name: string; code: string | null }[]; sizes: string[]; categories: string[] } {
    const colors = new Map<string, string | null>();
    const sizes = new Set<string>();
    products.forEach((product) => product.variants.forEach((variant) => {
      if (variant.colorName && !colors.has(variant.colorName)) colors.set(variant.colorName, variant.colorCode);
      if (variant.sizeName) sizes.add(variant.sizeName);
    }));
    return {
      colors: [...colors].map(([name, code]) => ({ name, code })).sort((first, second) => first.name.localeCompare(second.name)),
      sizes: [...sizes].sort((first, second) => first.localeCompare(second, undefined, { numeric: true })),
      categories: [...new Set(products.map((product) => product.category).filter(Boolean))].sort((first, second) => first.localeCompare(second)),
    };
  }
}

export const marketCatalogFilterService = MarketCatalogFilterService.getInstance();
