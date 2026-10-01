import { useCallback, useEffect, useMemo } from 'react';
import { FeedResourceService, type FeedResourceQuery } from '@/lib/services/FeedResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { FeedResourceData } from '@/lib/store/useResourceStore';

const feedResourceService = FeedResourceService.getInstance();
const IDLE_FEED_RESOURCE = createIdleResource<FeedResourceData>();

export function useFeedQuery(query: FeedResourceQuery) {
  const stableQuery = useMemo<FeedResourceQuery>(() => ({
    authorId: query.authorId,
    filter: query.filter,
    scope: query.scope,
    userId: query.userId,
  }), [query.authorId, query.filter, query.scope, query.userId]);
  const key = feedResourceService.getKey(stableQuery);
  const resource = useResourceStore((state) => state.feeds[key]) ?? IDLE_FEED_RESOURCE;

  useEffect(() => {
    void (async () => {
      if (stableQuery.filter !== 'all') await feedResourceService.seedDerivedFilters(stableQuery.userId, stableQuery.scope);
      await feedResourceService.hydrate(stableQuery);
      await feedResourceService.refresh(stableQuery);
    })();
  }, [key, stableQuery]);

  return {
    resource,
    refresh: useCallback(() => feedResourceService.refresh(stableQuery, { force: true }), [stableQuery]),
    reconcile: useCallback(() => feedResourceService.refresh(stableQuery, { bufferNewPosts: true }), [stableQuery]),
    loadMore: useCallback(() => feedResourceService.loadMore(stableQuery), [stableQuery]),
    revealPending: useCallback(() => feedResourceService.revealPending(stableQuery), [stableQuery]),
    setScrollOffset: useCallback((offset: number) => feedResourceService.setScrollOffset(stableQuery, offset), [stableQuery]),
  };
}
