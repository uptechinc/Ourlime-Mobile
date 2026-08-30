import { useCallback, useEffect, useMemo } from 'react';
import { LimeResourceService, type LimeFeedResourceQuery } from '@/lib/services/LimeResourceService';
import type { LimeFeedScope } from '@/lib/services/LimeService';
import { useResourceStore } from '@/lib/store/useResourceStore';

const limeResourceService = LimeResourceService.getInstance();

type UseLimeFeedResourceOptions = {
  userId: string;
  category?: string;
  scope: LimeFeedScope;
};

export function useLimeFeedResource({ userId, category, scope }: UseLimeFeedResourceOptions) {
  const query = useMemo<LimeFeedResourceQuery>(() => ({ userId, category, scope }), [category, scope, userId]);
  const key = limeResourceService.getKey(query);
  const resource = useResourceStore((state) => state.limeFeeds[key]);

  useEffect(() => {
    if (!userId) return;
    void limeResourceService.hydrate(query).then(() => limeResourceService.refresh(query));
  }, [query, userId]);

  const refresh = useCallback((force = false) => limeResourceService.refresh(query, force), [query]);
  const loadMore = useCallback(() => limeResourceService.loadMore(query), [query]);

  return { query, resource, refresh, loadMore };
}
