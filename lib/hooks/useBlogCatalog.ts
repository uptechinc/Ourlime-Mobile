import { useCallback, useEffect, useMemo } from 'react';
import { blogCatalogResourceService } from '@/lib/services/BlogCatalogResourceService';
import { useBlogCatalogStore } from '@/lib/store/useBlogCatalogStore';
import type { BlogListQuery, BlogPage } from '@/lib/types/blog';
import type { ResourceState } from '@/lib/types/resourceState';

const EMPTY_BLOG_RESOURCE: ResourceState<BlogPage> = Object.freeze({
  data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null,
});

export function useBlogCatalog(ownerId: string, query: BlogListQuery) {
  const queryKey = useMemo(() => blogCatalogResourceService.queryKey(query), [query]);
  const resource = useBlogCatalogStore((state) => (state.ownerId === ownerId && state.queryKey === queryKey ? state.resource : EMPTY_BLOG_RESOURCE));
  useEffect(() => {
    void blogCatalogResourceService.load(ownerId, query);
    return () => blogCatalogResourceService.cancel();
    // queryKey captures every query field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, queryKey]);
  const refresh = useCallback(() => blogCatalogResourceService.load(ownerId, query), [ownerId, query]);
  const loadMore = useCallback(() => blogCatalogResourceService.loadMore(ownerId, query), [ownerId, query]);
  const hasMore = Boolean(resource.data && resource.data.items.length < resource.data.total);
  return { ...resource, hasMore, refresh, loadMore };
}
