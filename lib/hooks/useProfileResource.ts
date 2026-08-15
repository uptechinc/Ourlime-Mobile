import { useCallback, useEffect } from 'react';
import { ProfileResourceService, type ProfileResourceIdentifier } from '@/lib/services/ProfileResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { OwnProfileResource } from '@/lib/store/useResourceStore';
import type { PublicProfileResult } from '@/lib/services/ProfileService';

const profileResourceService = ProfileResourceService.getInstance();
const IDLE_OWN_PROFILE = createIdleResource<OwnProfileResource>();
const IDLE_PUBLIC_PROFILE = createIdleResource<PublicProfileResult>();

export function useProfileResource(identifier: { kind: 'own'; userId: string }): {
  resource: ReturnType<typeof createIdleResource<OwnProfileResource>>;
  refresh: (force?: boolean) => Promise<void>;
};
export function useProfileResource(identifier: { kind: 'public'; viewerId: string; username: string }): {
  resource: ReturnType<typeof createIdleResource<PublicProfileResult>>;
  refresh: (force?: boolean) => Promise<void>;
};
export function useProfileResource(identifier: ProfileResourceIdentifier) {
  const key = profileResourceService.getKey(identifier);
  const ownResource = useResourceStore((state) => identifier.kind === 'own' ? state.ownProfiles[identifier.userId] : undefined);
  const publicResource = useResourceStore((state) => identifier.kind === 'public' ? state.publicProfiles[key] : undefined);
  const resource = identifier.kind === 'own' ? ownResource ?? IDLE_OWN_PROFILE : publicResource ?? IDLE_PUBLIC_PROFILE;

  useEffect(() => {
    void profileResourceService.hydrate(identifier).then(() => profileResourceService.refresh(identifier));
  }, [key]);

  return {
    resource,
    refresh: useCallback((force?: boolean) => profileResourceService.refresh(identifier, force), [key]),
  };
}
