import { Image } from 'expo-image';
import type { Reel } from '@/types/userTypes';
import { DiagnosticLogService } from './DiagnosticLogService';

export class LimeMediaPreloadService {
  private static instance: LimeMediaPreloadService;
  private readonly preloadedUrls = new Set<string>();
  private readonly inFlightPrefetches = new Map<string, Promise<boolean>>();
  private readonly logger = DiagnosticLogService.getInstance();
  private generation = 0;

  private constructor() {}

  public static getInstance(): LimeMediaPreloadService {
    if (!LimeMediaPreloadService.instance) {
      LimeMediaPreloadService.instance = new LimeMediaPreloadService();
    }
    return LimeMediaPreloadService.instance;
  }

  public isPreloaded(url: string): boolean {
    return this.preloadedUrls.has(url);
  }

  public cancel(): void {
    this.generation += 1;
    this.inFlightPrefetches.clear();
    this.logger.info('LimeMediaPreloadService', 'cancel');
  }

  public clear(): void {
    this.preloadedUrls.clear();
    this.inFlightPrefetches.clear();
  }

  public async prefetchPoster(url: string | undefined | null): Promise<boolean> {
    if (!url || typeof url !== 'string' || url.trim().length < 5) return false;
    const cleanUrl = url.trim();
    if (this.preloadedUrls.has(cleanUrl)) return true;

    const existing = this.inFlightPrefetches.get(cleanUrl);
    if (existing) return existing;

    const currentGeneration = this.generation;
    const prefetchPromise = (async () => {
      try {
        const success = await Image.prefetch(cleanUrl, 'memory-disk');
        if (currentGeneration === this.generation && success) {
          this.preloadedUrls.add(cleanUrl);
        }
        return Boolean(success);
      } catch {
        return false;
      } finally {
        this.inFlightPrefetches.delete(cleanUrl);
      }
    })();

    this.inFlightPrefetches.set(cleanUrl, prefetchPromise);
    return prefetchPromise;
  }

  public async prefetchPosters(urls: (string | undefined | null)[], limit = 6): Promise<void> {
    const validUrls = urls
      .filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 4))
      .filter((url) => !this.preloadedUrls.has(url.trim()))
      .slice(0, limit);

    if (validUrls.length === 0) return;

    await Promise.all(validUrls.map((url) => this.prefetchPoster(url)));
    this.logger.info('LimeMediaPreloadService', 'posters-prefetched', { count: validUrls.length });
  }

  public async prefetchFeedPosters(reels: Reel[], startIndex = 0, count = 6): Promise<void> {
    if (!Array.isArray(reels) || reels.length === 0) return;
    const slice = reels.slice(Math.max(0, startIndex), Math.max(0, startIndex) + count);
    const posterUrls = slice.map((reel) => reel.thumbnailUrl || reel.media?.thumbnailUrl);
    await this.prefetchPosters(posterUrls, count);
  }
}

export const limeMediaPreloadService = LimeMediaPreloadService.getInstance();
