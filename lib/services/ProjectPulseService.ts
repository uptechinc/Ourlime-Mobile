import { projectService } from './ProjectService';
import { projectInsightRules, type ProjectPulse } from './ProjectInsightRules';
import { settleAll } from '@/lib/utils/settleAll';
import type { ProjectRecord } from '@/lib/types/project';

/** Project cards read at most this many projects' tasks per refresh (two small reads each, no listeners). */
export const MAX_PULSE_PROJECTS = 12;
const PULSE_FRESH_MS = 2 * 60 * 1000;

type CachedPulse = { viewerId: string; loadedAt: number; versionKey: string; pulse: ProjectPulse };

/**
 * The overdue count and next milestone on each projects-list card. The project document has no such counters, so
 * the tasks and milestones of the viewer's open (active or paused) projects are read once, bounded and cached briefly.
 */
export class ProjectPulseService {
  private static instance: ProjectPulseService;
  private readonly cache = new Map<string, CachedPulse>();
  private readonly inFlight = new Map<string, Promise<ProjectPulse | null>>();

  private constructor() {}

  public static getInstance(): ProjectPulseService {
    if (!ProjectPulseService.instance) ProjectPulseService.instance = new ProjectPulseService();
    return ProjectPulseService.instance;
  }

  /** Projects whose cards get a pulse: accepted membership, still open, most recently active first, capped. */
  public eligible(projects: readonly ProjectRecord[]): ProjectRecord[] {
    return projects
      .filter((project) => project.membershipStatus === 'accepted' && (project.status === 'active' || project.status === 'on-hold'))
      .slice(0, MAX_PULSE_PROJECTS);
  }

  public cached(projectId: string, viewerId: string): ProjectPulse | null {
    const entry = this.cache.get(projectId);
    return entry && entry.viewerId === viewerId ? entry.pulse : null;
  }

  public async load(projects: readonly ProjectRecord[], viewerId: string, force = false): Promise<Map<string, ProjectPulse>> {
    const targets = this.eligible(projects);
    const results = await settleAll(targets.map((project) => this.loadOne(project, viewerId, force)));
    const pulses = new Map<string, ProjectPulse>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) pulses.set(targets[index].id, result.value);
    });
    return pulses;
  }

  private loadOne(project: ProjectRecord, viewerId: string, force: boolean): Promise<ProjectPulse | null> {
    const versionKey = `${project.updatedAt instanceof Date ? project.updatedAt.getTime() : String(project.updatedAt)}`;
    const entry = this.cache.get(project.id);
    if (!force && entry && entry.viewerId === viewerId && entry.versionKey === versionKey && Date.now() - entry.loadedAt < PULSE_FRESH_MS) {
      return Promise.resolve(entry.pulse);
    }
    const existing = this.inFlight.get(project.id);
    if (existing) return existing;
    const request = (async (): Promise<ProjectPulse | null> => {
      try {
        const [tasks, milestones] = await Promise.all([projectService.fetchTasks(project.id), projectService.fetchMilestones(project.id)]);
        const pulse = projectInsightRules.pulse(tasks, milestones, viewerId, projectInsightRules.today());
        this.cache.set(project.id, { viewerId, loadedAt: Date.now(), versionKey, pulse });
        return pulse;
      } catch (error: unknown) {
        console.warn('[ProjectPulseService.loadOne] Error:', error instanceof Error ? error.message : 'project summary not loaded');
        return entry && entry.viewerId === viewerId ? entry.pulse : null;
      } finally {
        this.inFlight.delete(project.id);
      }
    })();
    this.inFlight.set(project.id, request);
    return request;
  }
}

export const projectPulseService = ProjectPulseService.getInstance();
