import AsyncStorage from '@react-native-async-storage/async-storage';

export type MarketplacePreferences = {
  favoriteIds: string[];
  recentIds: string[];
};

const STORAGE_KEY = 'ourlime:marketplace-preferences:v1';
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
