import { useCallback, useEffect } from 'react';
import { projectResourceService } from '@/lib/services/ProjectResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { ProjectRecord } from '@/lib/types/project';

const EMPTY_PROJECT_DIRECTORY = createIdleResource<ProjectRecord[]>();

export function useProjectsResource(userId: string, mutationReady: boolean) {
  const resource = useResourceStore((state) => state.projectDirectories[userId]) ?? EMPTY_PROJECT_DIRECTORY;

  useEffect(() => {
    if (!userId) return;
    void projectResourceService.hydrate(userId).then(() => projectResourceService.refresh(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId || !mutationReady) return;
    void projectResourceService.reconcileInvites(userId);
  }, [mutationReady, userId]);

  return {
    resource,
    refresh: useCallback(() => projectResourceService.refresh(userId, true), [userId]),
  };
}
