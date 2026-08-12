import { useCallback, useEffect } from 'react';
import { FeedResourceService, type FeedResourceQuery } from '@/lib/services/FeedResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { FeedResourceData } from '@/lib/store/useResourceStore';

const feedResourceService = FeedResourceService.getInstance();

export function useFeedQuery(query: FeedResourceQuery) {
  const key = feedResourceService.getKey(query);
  const resource = useResourceStore((state) => state.feeds[key]) ?? createIdleResource<FeedResourceData>();

  useEffect(() => {
    void feedResourceService.hydrate(query).then(() => feedResourceService.refresh(query));
  }, [key]);

  return {
    resource,
    refresh: useCallback(() => feedResourceService.refresh(query, { force: true }), [key]),
    reconcile: useCallback(() => feedResourceService.refresh(query, { bufferNewPosts: true }), [key]),
    loadMore: useCallback(() => feedResourceService.loadMore(query), [key]),
    revealPending: useCallback(() => feedResourceService.revealPending(query), [key]),
    setScrollOffset: useCallback((offset: number) => feedResourceService.setScrollOffset(query, offset), [key]),
  };
}
