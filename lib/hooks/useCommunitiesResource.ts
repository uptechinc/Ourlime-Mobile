import { useCallback, useEffect } from 'react';
import { CommunitiesResourceService, DEFAULT_COMMUNITY_QUERY } from '@/lib/services/CommunitiesResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { CommunityCardModel, CommunityDirectoryPage, CommunityDirectoryQuery } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';

const communitiesResourceService = CommunitiesResourceService.getInstance();
const EMPTY_DIRECTORY_RESOURCE: ResourceState<CommunityDirectoryPage> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export function useCommunitiesResource(userId: string, query: CommunityDirectoryQuery = DEFAULT_COMMUNITY_QUERY) {
  const queryKey = communitiesResourceService.getQueryKey(query);
  const resource = useResourceStore((state) => state.communityDirectories[queryKey] ?? EMPTY_DIRECTORY_RESOURCE);
  const categories = useResourceStore((state) => state.communityCategories);

  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      communitiesResourceService.hydrate(userId, query).then(() => communitiesResourceService.refresh(userId, query)),
      communitiesResourceService.hydrateCategories(userId).then(() => communitiesResourceService.refreshCategories(userId)),
    ]);
  }, [queryKey, userId]);

  return {
    resource,
    categories,
    refresh: useCallback(() => communitiesResourceService.refresh(userId, query, true), [queryKey, userId]),
    loadMore: useCallback(() => communitiesResourceService.loadMore(userId, query), [queryKey, userId]),
    patchCommunity: useCallback((community: CommunityCardModel) => communitiesResourceService.patchCommunity(userId, community), [userId]),
  };
}
