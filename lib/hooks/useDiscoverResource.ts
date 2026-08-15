import { useCallback, useEffect } from 'react';
import { DiscoverResourceService } from '@/lib/services/DiscoverResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';

const discoverResourceService = DiscoverResourceService.getInstance();

export function useDiscoverResource(userId: string) {
  const resource = useResourceStore((state) => state.discover);

  useEffect(() => {
    if (!userId) return;
    void discoverResourceService.hydrate(userId).then(() => discoverResourceService.refresh(userId));
  }, [userId]);

  return {
    resource,
    refresh: useCallback(() => discoverResourceService.refresh(userId, true), [userId]),
    removeSuggestion: useCallback((suggestedUserId: string) => discoverResourceService.removeSuggestion(userId, suggestedUserId), [userId]),
  };
}
