import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { projectPulseService } from '@/lib/services/ProjectPulseService';
import type { ProjectPulse } from '@/lib/services/ProjectInsightRules';
import type { ProjectRecord } from '@/lib/types/project';

/** Overdue counts and next milestones for the projects-list cards; reloads when the list changes. */
export function useProjectPulses(projects: readonly ProjectRecord[], viewerId: string) {
  const [pulses, setPulses] = useState<Map<string, ProjectPulse>>(new Map());
  const generation = useRef(0);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  // Only the projects that get a pulse, and their last change, decide when to read again.
  const listKey = useMemo(() => projectPulseService.eligible(projects)
    .map((project) => `${project.id}:${new Date(project.updatedAt).getTime() || 0}`).join('|'), [projects]);

  const load = useCallback(async (force: boolean): Promise<void> => {
    if (!viewerId) return;
    const current = ++generation.current;
    const next = await projectPulseService.load(projectsRef.current, viewerId, force);
    if (current === generation.current) setPulses(next);
  }, [viewerId]);

  useEffect(() => {
    if (!listKey) { setPulses(new Map()); return; }
    void load(false);
  }, [listKey, load]);

  return { pulses, reload: useCallback(() => load(true), [load]) };
}
