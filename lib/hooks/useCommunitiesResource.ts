import { useCallback, useEffect, useMemo } from 'react';
import { CommunitiesResourceService, DEFAULT_COMMUNITY_QUERY } from '@/lib/services/CommunitiesResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { CommunityCardModel, CommunityDirectoryPage, CommunityDirectoryQuery } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';

const communitiesResourceService = CommunitiesResourceService.getInstance();
const EMPTY_DIRECTORY_RESOURCE: ResourceState<CommunityDirectoryPage> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export function useCommunitiesResource(userId: string, query: CommunityDirectoryQuery = DEFAULT_COMMUNITY_QUERY) {
  const stableQuery = useMemo<CommunityDirectoryQuery>(() => ({
    categoryId: query.categoryId,
    cursor: query.cursor,
    limit: query.limit,
    scope: query.scope,
    search: query.search,
    sort: query.sort,
    visibility: query.visibility,
  }), [query.categoryId, query.cursor, query.limit, query.scope, query.search, query.sort, query.visibility]);
  const queryKey = communitiesResourceService.getQueryKey(stableQuery);
  const resource = useResourceStore((state) => state.communityDirectories[queryKey]) ?? EMPTY_DIRECTORY_RESOURCE;
  const categories = useResourceStore((state) => state.communityCategories);

  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      communitiesResourceService.hydrate(userId, stableQuery).then(() => communitiesResourceService.refresh(userId, stableQuery)),
      communitiesResourceService.hydrateCategories(userId).then(() => communitiesResourceService.refreshCategories(userId)),
    ]);
  }, [queryKey, stableQuery, userId]);

  return {
    resource,
    categories,
    refresh: useCallback(() => communitiesResourceService.refresh(userId, stableQuery, true), [stableQuery, userId]),
    refreshCategories: useCallback(() => communitiesResourceService.refreshCategories(userId, true), [userId]),
    loadMore: useCallback(() => communitiesResourceService.loadMore(userId, stableQuery), [stableQuery, userId]),
    patchCommunity: useCallback((community: CommunityCardModel) => communitiesResourceService.patchCommunity(userId, community), [userId]),
  };
}
