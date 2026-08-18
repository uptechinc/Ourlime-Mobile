import { useCallback, useEffect } from 'react';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import type { RelationshipHubPage, RelationshipRequestDirection } from '@/lib/types/relationshipHub';

const IDLE_RELATIONSHIP_REQUESTS = createIdleResource<RelationshipHubPage>();

export function useRelationshipRequests(
  userId: string,
  direction: RelationshipRequestDirection,
  search: string,
  enabled = true,
) {
  const key = relationshipRequestResourceService.key(userId, direction, search);
  const resource = useResourceStore((state) => state.relationshipRequests[key]) ?? IDLE_RELATIONSHIP_REQUESTS;
  useEffect(() => {
    if (!enabled || !userId) return;
    void relationshipRequestResourceService.hydrate(userId, direction, search).then(() => relationshipRequestResourceService.refresh(userId, direction, search));
  }, [direction, enabled, search, userId]);
  const refresh = useCallback(() => relationshipRequestResourceService.refresh(userId, direction, search, true), [direction, search, userId]);
  const loadMore = useCallback(() => relationshipRequestResourceService.loadMore(userId, direction, search), [direction, search, userId]);
  return { resource, refresh, loadMore };
}
