import { ApiService } from './ApiService';
import type {
  ColorVariants,
  Colors,
  Product,
  ProductOwnership,
  ProductSubImage,
  ProductVariant,
  SizeVariants,
  Sizes,
} from '@/types/productTypes';

export type MarketCatalogData = {
  products: Product[];
  categories: string[];
  colors: Colors[];
  sizes: Sizes[];
  colorVariants: ColorVariants[];
  sizeVariants: SizeVariants[];
  variants: ProductVariant[];
  subImages: ProductSubImage[];
  ownership: ProductOwnership[];
  pagination: {
    pageSize: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type MarketFilters = {
  category?: string;
  searchTerm?: string;
  cursor?: string | null;
  limit?: number;
};

type MarketApiResponse = {
  status: 'success';
  data: {
    success: boolean;
    data: MarketCatalogData;
  };
};

export class MarketService {
  private static instance: MarketService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): MarketService {
    if (!MarketService.instance) MarketService.instance = new MarketService();
    return MarketService.instance;
  }

  public async fetchCatalog(filters: MarketFilters = {}): Promise<MarketCatalogData> {
    const query = new URLSearchParams();
    query.set('limit', String(Math.min(Math.max(filters.limit ?? 20, 1), 30)));
    if (filters.cursor) query.set('cursor', filters.cursor);
    const isFiltered = Boolean(filters.category || filters.searchTerm);
    if (filters.category) query.append('categories', filters.category);
    if (filters.searchTerm?.trim()) query.set('q', filters.searchTerm.trim());
    const endpoint = isFiltered ? '/api/market/search_and_filter' : '/api/market/fetch';
    const response = await this.apiService.request<MarketApiResponse>(`${endpoint}?${query.toString()}`, {
      priority: 'foreground',
    });
    if (response.status !== 'success' || !response.data.success) {
      throw new Error('The marketplace catalog could not be loaded.');
    }
    return response.data.data;
  }
}

export const marketService = MarketService.getInstance();
