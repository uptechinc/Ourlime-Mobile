import { apiService } from '@/lib/services/ApiService';

export type GifAsset = { id: string; name: string; imageUrl: string; type: 'gif' };
type GifApiItem = { id?: unknown; name?: unknown; imageUrl?: unknown };
type GifApiResponse = { success?: boolean; data?: GifApiItem[]; error?: string };

export class GifService {
  private static instance: GifService;
  private readonly cache = new Map<string, GifAsset[]>();
  private constructor() {}
  public static getInstance(): GifService { if (!GifService.instance) GifService.instance = new GifService(); return GifService.instance; }
  public async search(queryText: string): Promise<GifAsset[]> {
    const normalized = queryText.trim().toLowerCase(); const cacheKey = normalized || 'trending'; const cached = this.cache.get(cacheKey); if (cached) return cached;
    const query = normalized ? `?q=${encodeURIComponent(normalized)}` : '';
    const response = await apiService.request<GifApiResponse>(`/api/gifs${query}`, { priority: 'foreground' });
    if (response.success === false) throw new Error(response.error || 'GIFs could not be loaded.');
    const assets = (response.data ?? []).flatMap((item): GifAsset[] => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.imageUrl === 'string' ? [{ id: item.id, name: item.name, imageUrl: item.imageUrl, type: 'gif' }] : []);
    if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value ?? ''); this.cache.set(cacheKey, assets); return assets;
  }
}
export const gifService = GifService.getInstance();
