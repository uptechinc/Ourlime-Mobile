import { useCallback, useEffect } from 'react';
import { marketplaceResourceService } from '@/lib/services/MarketplaceResourceService';
import { useMarketplaceStore } from '@/lib/store/useMarketplaceStore';
import type { CatalogPage } from '@/lib/types/reliability';
import type { ResourceState } from '@/lib/types/resourceState';

const EMPTY_CATALOG_RESOURCE: ResourceState<CatalogPage> = Object.freeze({
  data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null,
});

export function useMarketplaceCatalog(ownerId: string | null, search: string, category: string) {
  const queryKey = marketplaceResourceService.key(search, category);
  const resource = useMarketplaceStore((state) => state.catalogs[queryKey] ?? EMPTY_CATALOG_RESOURCE);
  useEffect(() => {
    const timer = setTimeout(() => { void marketplaceResourceService.hydrate(ownerId, search, category).then(() => marketplaceResourceService.refresh(ownerId, search, category)); }, 300);
    return () => { clearTimeout(timer); marketplaceResourceService.cancel(); };
  }, [ownerId, search, category]);
  const refresh = useCallback(() => marketplaceResourceService.refresh(ownerId, search, category, true), [ownerId, search, category]);
  const cursor = resource.data?.cursor ?? null;
  const cursorTitle = cursor?.title ?? '';
  const cursorId = cursor?.id ?? '';
  const loadMore = useCallback(() => cursorId ? marketplaceResourceService.loadMore(ownerId, search, category, { search, category, title: cursorTitle, id: cursorId }) : Promise.resolve(), [ownerId, search, category, cursorTitle, cursorId]);
  return { ...resource, refresh, loadMore };
}
