import { LocalCacheService } from './LocalCacheService';
import { marketplaceService } from './MarketplaceService';
import { useMarketplaceStore } from '@/lib/store/useMarketplaceStore';
import type { CatalogCursor, CatalogPage } from '@/lib/types/reliability';
import type { ResourceState } from '@/lib/types/resourceState';
import { ServiceResultError } from '@/lib/types/serviceResults';
import { reliabilityDecoder } from './ReliabilityDecoderService';

const NAMESPACE = 'marketplace-catalog';
const CACHE_SCHEMA_VERSION = 2;
const STALE_MS = 5 * 60 * 1000;
const RETENTION_MS = 48 * 60 * 60 * 1000;

export class MarketplaceResourceService {
  private static instance: MarketplaceResourceService;
  private readonly cache = LocalCacheService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();
  private generation = 0;
  public static getInstance(): MarketplaceResourceService { return this.instance ??= new MarketplaceResourceService(); }
  public key(search = '', category = ''): string { return [search.normalize('NFKC').toLocaleLowerCase('en-US').trim().slice(0, 100) || 'all', category.trim() || 'all'].map(encodeURIComponent).join(':'); }
  public cancel(): void { this.generation += 1; }
  private state(queryKey: string): ResourceState<CatalogPage> {
    return useMarketplaceStore.getState().catalogs[queryKey] ?? { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
  }
  public async hydrate(ownerId: string | null, search = '', category = ''): Promise<void> {
    const queryKey = this.key(search, category); const current = this.state(queryKey); if (current.data) return;
    useMarketplaceStore.getState().setCatalog(queryKey, { ...current, status: 'hydrating', error: null });
    const cacheOwnerId = ownerId ?? 'public';
    const cached = await this.cache.read<unknown>(cacheOwnerId, NAMESPACE, queryKey, CACHE_SCHEMA_VERSION);
    let data: CatalogPage | null = null;
    if (cached) {
      try {
        data = reliabilityDecoder.catalogPage(cached.data);
      } catch {
        await this.cache.remove(cacheOwnerId, NAMESPACE, queryKey);
      }
    }
    useMarketplaceStore.getState().setCatalog(queryKey, cached && data ? { data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired || Date.now() - cached.updatedAt >= STALE_MS, error: null } : { ...current, status: 'idle' });
  }
  public async refresh(ownerId: string | null, search = '', category = '', force = false): Promise<void> {
    const queryKey = this.key(search, category); const requestKey = `refresh:${ownerId}:${queryKey}`; const existing = this.inFlight.get(requestKey); if (existing) return existing;
    const current = this.state(queryKey); if (!force && current.data?.products.length && current.updatedAt && Date.now() - current.updatedAt < STALE_MS) return;
    const generation = ++this.generation;
    useMarketplaceStore.getState().setCatalog(queryKey, { ...current, status: current.data ? 'refreshing' : 'hydrating', error: null });
    const request = (async () => {
      try {
        const page = await marketplaceService.catalog(ownerId, search, category);
        if (generation !== this.generation) return;
        const updatedAt = Date.now(); useMarketplaceStore.getState().setCatalog(queryKey, { data: page, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
        await this.cache.write(ownerId ?? 'public', NAMESPACE, queryKey, page, { expiresAt: updatedAt + RETENTION_MS, schemaVersion: CACHE_SCHEMA_VERSION });
      } catch (error: unknown) {
        if (generation !== this.generation) return;
        const latest = this.state(queryKey); useMarketplaceStore.getState().setCatalog(queryKey, { ...latest, status: latest.data ? 'ready' : 'error', isStale: true, error: new ServiceResultError('unknown', error instanceof Error ? error.message : 'Catalog could not be loaded.', error) });
      } finally { this.inFlight.delete(requestKey); }
    })();
    this.inFlight.set(requestKey, request); return request;
  }
  public async loadMore(ownerId: string | null, search: string, category: string, cursor: CatalogCursor): Promise<void> {
    const queryKey = this.key(search, category); const requestKey = `more:${ownerId ?? 'public'}:${queryKey}`; if (this.inFlight.has(requestKey)) return this.inFlight.get(requestKey);
    const current = this.state(queryKey); if (!current.data) return;
    useMarketplaceStore.getState().setCatalog(queryKey, { ...current, status: 'refreshing', error: null });
    const request = (async () => {
      try {
        const page = await marketplaceService.catalog(ownerId, search, category, cursor); const latest = this.state(queryKey); const products = [...new Map([...(latest.data?.products ?? []), ...page.products].map((product) => [product.id, product])).values()];
        const data = { products: products.slice(0, 100), cursor: page.cursor }; const updatedAt = Date.now(); useMarketplaceStore.getState().setCatalog(queryKey, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null }); await this.cache.write(ownerId ?? 'public', NAMESPACE, queryKey, data, { expiresAt: updatedAt + RETENTION_MS, schemaVersion: CACHE_SCHEMA_VERSION });
      } catch (error: unknown) { const latest = this.state(queryKey); useMarketplaceStore.getState().setCatalog(queryKey, { ...latest, status: 'ready', isStale: true, error: new ServiceResultError('unknown', error instanceof Error ? error.message : 'More listings could not be loaded.', error) }); }
      finally { this.inFlight.delete(requestKey); }
    })();
    this.inFlight.set(requestKey, request); return request;
  }
}
export const marketplaceResourceService = MarketplaceResourceService.getInstance();
