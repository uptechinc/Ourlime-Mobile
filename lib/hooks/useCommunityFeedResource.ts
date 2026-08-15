import { useCallback, useEffect } from 'react';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import { communityFeedResourceService } from '@/lib/services/CommunityFeedResourceService';
import type { PostItem } from '@/lib/services/PostService';

const IDLE_COMMUNITY_FEED = createIdleResource<PostItem[]>();

export function useCommunityFeedResource(userId: string, communityId: string, enabled: boolean) {
  const key = communityFeedResourceService.getKey(userId, communityId);
  const resource = useResourceStore((state) => state.communityFeeds[key] ?? IDLE_COMMUNITY_FEED);
  useEffect(() => {
    if (!enabled || !userId || !communityId) return;
    void communityFeedResourceService.hydrate(userId, communityId).then(() => communityFeedResourceService.refresh(userId, communityId));
  }, [communityId, enabled, userId]);
  const refresh = useCallback(() => communityFeedResourceService.refresh(userId, communityId, true), [communityId, userId]);
  return { resource, refresh };
}
