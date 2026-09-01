export type ActiveSharedPostPlayerListener = (activeKey: string | null) => void;

export class SharedPostCardStateService {
  private static instance: SharedPostCardStateService;
  private readonly listeners = new Set<ActiveSharedPostPlayerListener>();
  private readonly thumbnailCache = new Map<string, string>();
  private activePlayerKey: string | null = null;

  private constructor() {}

  public static getInstance(): SharedPostCardStateService {
    if (!SharedPostCardStateService.instance) {
      SharedPostCardStateService.instance = new SharedPostCardStateService();
    }
    return SharedPostCardStateService.instance;
  }

  public subscribe(listener: ActiveSharedPostPlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.activePlayerKey);
    return () => this.listeners.delete(listener);
  }

  public activatePlayer(key: string): void {
    if (this.activePlayerKey === key) return;
    this.activePlayerKey = key;
    this.listeners.forEach((listener) => listener(key));
  }

  public deactivatePlayer(key: string): void {
    if (this.activePlayerKey !== key) return;
    this.activePlayerKey = null;
    this.listeners.forEach((listener) => listener(null));
  }

  public deactivateAllPlayers(): void {
    if (this.activePlayerKey === null) return;
    this.activePlayerKey = null;
    this.listeners.forEach((listener) => listener(null));
  }

  public getActivePlayerKey(): string | null {
    return this.activePlayerKey;
  }

  public getCachedThumbnail(videoUrl: string): string | undefined {
    return this.thumbnailCache.get(videoUrl);
  }

  public cacheThumbnail(videoUrl: string, thumbnailUrl: string): void {
    this.thumbnailCache.delete(videoUrl);
    this.thumbnailCache.set(videoUrl, thumbnailUrl);
    while (this.thumbnailCache.size > 60) {
      const oldestKey = this.thumbnailCache.keys().next().value;
      if (typeof oldestKey !== 'string') return;
      this.thumbnailCache.delete(oldestKey);
    }
  }
}

export const sharedPostCardStateService = SharedPostCardStateService.getInstance();
