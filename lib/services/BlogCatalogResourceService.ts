import { LocalCacheService } from './LocalCacheService';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
import { useBlogCatalogStore } from '@/lib/store/useBlogCatalogStore';
import { ServiceResultError } from '@/lib/types/serviceResults';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import type { BlogListQuery } from '@/lib/types/blog';

const NAMESPACE = 'blog-catalog';
const STALE_MS = 5 * 60 * 1000;
const RETENTION_MS = 48 * 60 * 60 * 1000;
export const DEFAULT_BLOG_QUERY: BlogListQuery = { search: '', category: 'All', tags: [], type: 'all', sort: 'newest' };

/** Server-filtered, page-paginated blog list (GET /api/blogs&articles); the default view is cached on disk. */
export class BlogCatalogResourceService {
  private static instance: BlogCatalogResourceService;
  private generation = 0;
  private loadingMore = false;
  private readonly cache = LocalCacheService.getInstance();
  private readonly blogs = BlogsAndArticlesService.getInstance();

  public static getInstance(): BlogCatalogResourceService { return this.instance ??= new BlogCatalogResourceService(); }

  public queryKey(query: BlogListQuery): string {
    return JSON.stringify([query.search.trim().toLowerCase(), query.category, [...query.tags].sort(), query.type, query.sort]);
  }

  private isDefault(query: BlogListQuery): boolean {
    return this.queryKey(query) === this.queryKey(DEFAULT_BLOG_QUERY);
  }

  public cancel(): void { this.generation += 1; }

  /** Loads page 1 for a query, showing the cached default view first when available. */
  public async load(ownerId: string, query: BlogListQuery): Promise<void> {
    const key = this.queryKey(query);
    const generation = ++this.generation;
    const store = useBlogCatalogStore.getState();
    if (store.ownerId !== ownerId || store.queryKey !== key) store.reset(ownerId, key);
    if (!useBlogCatalogStore.getState().resource.data && this.isDefault(query)) {
      const cached = await this.cache.read<unknown>(ownerId, NAMESPACE, key).catch(() => null);
      if (cached && generation === this.generation) {
        try {
          const data = reliabilityDecoder.blogPage(cached.data);
          useBlogCatalogStore.getState().set(ownerId, key, { data, status: 'refreshing', source: 'disk', updatedAt: cached.updatedAt, isStale: Date.now() - cached.updatedAt >= STALE_MS, error: null });
        } catch { /* Ignore an incompatible cached page. */ }
      }
    }
    const latest = useBlogCatalogStore.getState().resource;
    useBlogCatalogStore.getState().set(ownerId, key, { ...latest, status: latest.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const data = await this.blogs.listPosts(query, 1);
      if (generation !== this.generation) return;
      const updatedAt = Date.now();
      useBlogCatalogStore.getState().set(ownerId, key, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      if (this.isDefault(query)) await this.cache.write(ownerId, NAMESPACE, key, data, { expiresAt: updatedAt + RETENTION_MS }).catch(() => undefined);
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      const failed = useBlogCatalogStore.getState().resource;
      useBlogCatalogStore.getState().set(ownerId, key, { ...failed, status: failed.data ? 'ready' : 'error', isStale: true, error: new ServiceResultError('unknown', error instanceof Error ? error.message : 'Failed to load blogs', error) });
    }
  }

  /** Appends the next page (web: numbered pagination; mobile: load more). */
  public async loadMore(ownerId: string, query: BlogListQuery): Promise<void> {
    const key = this.queryKey(query);
    const current = useBlogCatalogStore.getState().resource;
    if (!current.data || this.loadingMore || current.data.items.length >= current.data.total) return;
    this.loadingMore = true;
    const generation = this.generation;
    useBlogCatalogStore.getState().set(ownerId, key, { ...current, status: 'refreshing', error: null });
    try {
      const next = await this.blogs.listPosts(query, current.data.page + 1);
      if (generation !== this.generation) return;
      const latest = useBlogCatalogStore.getState().resource;
      const items = [...new Map([...(latest.data?.items ?? []), ...next.items].map((item) => [item.id, item])).values()];
      useBlogCatalogStore.getState().set(ownerId, key, { data: { ...next, items }, status: 'ready', source: 'network', updatedAt: Date.now(), isStale: false, error: null });
    } catch (error: unknown) {
      const latest = useBlogCatalogStore.getState().resource;
      useBlogCatalogStore.getState().set(ownerId, key, { ...latest, status: 'ready', error: new ServiceResultError('unknown', error instanceof Error ? error.message : 'More blogs could not be loaded.', error) });
    } finally {
      this.loadingMore = false;
    }
  }
}

export const blogCatalogResourceService = BlogCatalogResourceService.getInstance();
