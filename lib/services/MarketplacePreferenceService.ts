import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MarketSavedSearch } from '@/lib/types/reliability';

export type MarketplacePreferences = {
  favoriteIds: string[];
  recentIds: string[];
};

const STORAGE_KEY = 'ourlime:marketplace-preferences:v1';
const SAVED_SEARCHES_KEY = 'ourlime:marketplace-saved-searches:v1';
const VIEW_MODE_KEY = 'ourlime:marketplace-view-mode:v1';
export type MarketViewMode = 'grid' | 'list';
const EMPTY_PREFERENCES: MarketplacePreferences = Object.freeze({ favoriteIds: [], recentIds: [] });

export class MarketplacePreferenceService {
  private static instance: MarketplacePreferenceService;

  private constructor() {}

  public static getInstance(): MarketplacePreferenceService {
    return this.instance ??= new MarketplacePreferenceService();
  }

  public async read(): Promise<MarketplacePreferences> {
    const encoded = await AsyncStorage.getItem(STORAGE_KEY);
    if (!encoded) return EMPTY_PREFERENCES;
    try {
      const decoded: unknown = JSON.parse(encoded);
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return EMPTY_PREFERENCES;
      const value = decoded as { favoriteIds?: unknown; recentIds?: unknown };
      return {
        favoriteIds: this.ids(value.favoriteIds, 500),
        recentIds: this.ids(value.recentIds, 24),
      };
    } catch {
      return EMPTY_PREFERENCES;
    }
  }

  public async toggleFavorite(productId: string): Promise<MarketplacePreferences> {
    const current = await this.read();
    const favoriteIds = current.favoriteIds.includes(productId)
      ? current.favoriteIds.filter((savedId) => savedId !== productId)
      : [productId, ...current.favoriteIds].slice(0, 500);
    return this.write({ ...current, favoriteIds });
  }

  public async recordViewed(productId: string): Promise<MarketplacePreferences> {
    const current = await this.read();
    return this.write({ ...current, recentIds: [productId, ...current.recentIds.filter((savedId) => savedId !== productId)].slice(0, 24) });
  }

  /** Saved searches (web MarketFavoritesContext savedSearches), newest first, at most 20. */
  public async readSavedSearches(): Promise<MarketSavedSearch[]> {
    try {
      const decoded: unknown = JSON.parse((await AsyncStorage.getItem(SAVED_SEARCHES_KEY)) ?? '[]');
      if (!Array.isArray(decoded)) return [];
      return decoded.flatMap((entry): MarketSavedSearch[] => {
        if (!entry || typeof entry !== 'object') return [];
        const value = entry as Partial<Record<keyof MarketSavedSearch, unknown>>;
        if (typeof value.id !== 'string' || typeof value.label !== 'string') return [];
        return [{
          id: value.id, label: value.label, query: typeof value.query === 'string' ? value.query : '',
          categories: Array.isArray(value.categories) ? value.categories.filter((category): category is string => typeof category === 'string') : [],
          createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
        }];
      }).slice(0, 20);
    } catch {
      return [];
    }
  }

  public async saveSearch(query: string, categories: string[]): Promise<MarketSavedSearch[]> {
    const trimmed = query.trim().slice(0, 100);
    if (!trimmed && !categories.length) throw new Error('Type a search or pick a category before saving.');
    const label = trimmed || categories.join(', ');
    const current = await this.readSavedSearches();
    const duplicate = current.find((entry) => entry.query === trimmed && entry.categories.join('|') === categories.join('|'));
    if (duplicate) return current;
    const next = [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, label, query: trimmed, categories, createdAt: Date.now() }, ...current].slice(0, 20);
    await AsyncStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
    return next;
  }

  public async removeSavedSearch(searchId: string): Promise<MarketSavedSearch[]> {
    const next = (await this.readSavedSearches()).filter((entry) => entry.id !== searchId);
    await AsyncStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
    return next;
  }

  public async readViewMode(): Promise<MarketViewMode> {
    return (await AsyncStorage.getItem(VIEW_MODE_KEY)) === 'list' ? 'list' : 'grid';
  }

  public async writeViewMode(mode: MarketViewMode): Promise<void> {
    await AsyncStorage.setItem(VIEW_MODE_KEY, mode);
  }

  private async write(preferences: MarketplacePreferences): Promise<MarketplacePreferences> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return preferences;
  }

  private ids(value: unknown, maximum: number): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && /^[A-Za-z0-9_-]+$/.test(entry)))].slice(0, maximum);
  }
}

export const marketplacePreferenceService = MarketplacePreferenceService.getInstance();
