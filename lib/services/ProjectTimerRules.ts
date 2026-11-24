/**
 * Where a member's running task timer lives (eProjects U3, audit S5). Same rules as the website's
 * lib/projects/ProjectTimerRules.ts.
 * - Current: users/{uid}/private/projectTimer { taskId, projectId, startedAt }, readable only by the member.
 * - Legacy: users/{uid}.activeTimer on the public profile. Still read while no private timer exists, so a timer
 *   started by an older build keeps running; every start or stop clears it.
 */
export type StoredProjectTimer = { taskId: string; projectId: string; startedAt: unknown };
export type ProjectTimerSources = { privateExists: boolean; privateData: unknown; legacy: unknown };

export const PROJECT_TIMER_DOCUMENT = 'projectTimer';

const readTimer = (value: unknown): StoredProjectTimer | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { taskId?: unknown; projectId?: unknown; startedAt?: unknown };
  if (typeof record.taskId !== 'string' || !record.taskId || typeof record.projectId !== 'string' || !record.projectId) return null;
  return { taskId: record.taskId, projectId: record.projectId, startedAt: record.startedAt ?? null };
};

export class ProjectTimerRules {
  /** The private timer when that document exists (even if malformed: it replaced the legacy field), else the legacy one. */
  public resolve(sources: ProjectTimerSources): StoredProjectTimer | null {
    return sources.privateExists ? readTimer(sources.privateData) : readTimer(sources.legacy);
  }

  /** True when the public profile still carries a legacy timer that the next write should clear. */
  public hasLegacy(legacy: unknown): boolean {
    return legacy !== undefined && legacy !== null;
  }
}

export const projectTimerRules = new ProjectTimerRules();
