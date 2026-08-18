import { useCallback, useEffect } from 'react';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import type { RelationshipHubPage, RelationshipHubSection } from '@/lib/types/relationshipHub';

const IDLE_RELATIONSHIP_HUB = createIdleResource<RelationshipHubPage>();

export function useRelationshipHub(userId: string, section: RelationshipHubSection, enabled = true) {
  const resource = useResourceStore((state) => state.relationshipHub[section]) ?? IDLE_RELATIONSHIP_HUB;
  useEffect(() => {
    if (!enabled || !userId) return;
    void relationshipResourceService.hydrate(userId, section).then(() => relationshipResourceService.refresh(userId, section));
  }, [enabled, section, userId]);
  const refresh = useCallback(() => relationshipResourceService.refresh(userId, section, true), [section, userId]);
  const loadMore = useCallback(() => relationshipResourceService.loadMore(userId, section), [section, userId]);
  return { resource, refresh, loadMore };
}
