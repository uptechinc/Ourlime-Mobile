import { appServerService } from '@/lib/services/AppServerService';

export type GifAsset = { id: string; name: string; imageUrl: string; type: 'gif' };
type GifResult = { id?: unknown; name?: unknown; imageUrl?: unknown };

/** GIF search and trending through the app's own searchGifs function (the GIPHY key stays on the server). */
export class GifService {
  private static instance: GifService;
  private readonly cache = new Map<string, GifAsset[]>();

  private constructor() {}

  public static getInstance(): GifService {
    if (!GifService.instance) GifService.instance = new GifService();
    return GifService.instance;
  }

  public async search(queryText: string): Promise<GifAsset[]> {
    const normalized = queryText.trim().toLowerCase();
    const cacheKey = normalized || 'trending';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const results = await appServerService.call<GifResult[]>('searchGifs', { query: normalized });
    const assets = results.flatMap((item): GifAsset[] => (
      typeof item.id === 'string' && typeof item.name === 'string' && typeof item.imageUrl === 'string'
        ? [{ id: item.id, name: item.name, imageUrl: item.imageUrl, type: 'gif' }]
        : []
    ));
    if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value ?? '');
    this.cache.set(cacheKey, assets);
    return assets;
  }
}

export const gifService = GifService.getInstance();
