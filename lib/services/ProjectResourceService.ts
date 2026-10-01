import { DiagnosticLogService } from './DiagnosticLogService';
import { LocalCacheService } from './LocalCacheService';
import { ProjectService } from './ProjectService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { ProjectRecord } from '@/lib/types/project';
import type { ResourceSource, ResourceState } from '@/lib/types/resourceState';

const PROJECT_DIRECTORY_NAMESPACE = 'project-directories';
const PROJECT_DIRECTORY_KEY = 'owned-and-member';
const PROJECT_DIRECTORY_STALE_MS = 2 * 60 * 1000;
const PROJECT_DIRECTORY_RETENTION_MS = 48 * 60 * 60 * 1000;

type CachedProjectRecord = Omit<ProjectRecord, 'updatedAt'> & { updatedAt: string };

export class ProjectResourceService {
  private static instance: ProjectResourceService;
  private readonly projectService = ProjectService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly refreshes = new Map<string, Promise<void>>();
  private readonly inviteReconciliations = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): ProjectResourceService {
    if (!ProjectResourceService.instance) ProjectResourceService.instance = new ProjectResourceService();
    return ProjectResourceService.instance;
  }

  public async hydrate(userId: string): Promise<void> {
    const current = useResourceStore.getState().projectDirectories[userId];
    if (current?.data) return;
    useResourceStore.getState().setProjectDirectory(userId, this.withState(current, { status: 'hydrating', error: null }));
    const cached = await this.cacheService.read<CachedProjectRecord[]>(userId, PROJECT_DIRECTORY_NAMESPACE, PROJECT_DIRECTORY_KEY);
    if (!cached) {
      useResourceStore.getState().setProjectDirectory(userId, this.withState(null, { status: 'idle' }));
      return;
    }
    const projects = cached.data.map((project) => this.fromCached(project));
    useResourceStore.getState().setProjectDirectory(userId, {
      data: projects,
      status: 'ready',
      source: 'disk',
      updatedAt: cached.updatedAt,
      isStale: cached.isExpired || Date.now() - cached.updatedAt >= PROJECT_DIRECTORY_STALE_MS,
      error: null,
    });
    this.logger.info('ProjectResourceService', 'hydrate:success', { userId, projectCount: projects.length, expired: cached.isExpired });
  }

  public async refresh(userId: string, force = false): Promise<void> {
    const current = useResourceStore.getState().projectDirectories[userId];
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < PROJECT_DIRECTORY_STALE_MS) return;
    const existing = this.refreshes.get(userId);
    if (existing) return existing;
    const refresh = this.performRefresh(userId).finally(() => this.refreshes.delete(userId));
    this.refreshes.set(userId, refresh);
    return refresh;
  }

  public async reconcileInvites(userId: string): Promise<void> {
    const existing = this.inviteReconciliations.get(userId);
    if (existing) return existing;
    const reconciliation = (async () => {
      try {
        await this.projectService.claimEmailInvites();
      } catch (error: unknown) {
        this.logger.warn('ProjectResourceService', 'invites:claim-failed', { userId, error: error instanceof Error ? error.message : String(error) });
      }
      await this.refresh(userId, true);
    })().finally(() => this.inviteReconciliations.delete(userId));
    this.inviteReconciliations.set(userId, reconciliation);
    return reconciliation;
  }

  private async performRefresh(userId: string): Promise<void> {
    const current = useResourceStore.getState().projectDirectories[userId];
    useResourceStore.getState().setProjectDirectory(userId, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    try {
      const projects = await this.projectService.listForCurrentUser();
      await this.commit(userId, projects, 'network');
    } catch (error: unknown) {
      const latest = useResourceStore.getState().projectDirectories[userId];
      useResourceStore.getState().setProjectDirectory(userId, {
        ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }),
        isStale: true,
        error: this.errorService.normalize(error, 'Your projects could not be refreshed.'),
      });
    }
  }

  private async commit(userId: string, projects: ProjectRecord[], source: ResourceSource): Promise<void> {
    const updatedAt = Date.now();
    useResourceStore.getState().setProjectDirectory(userId, { data: projects, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(userId, PROJECT_DIRECTORY_NAMESPACE, PROJECT_DIRECTORY_KEY, projects.map((project) => this.toCached(project)), { expiresAt: updatedAt + PROJECT_DIRECTORY_RETENTION_MS });
    this.logger.info('ProjectResourceService', 'refresh:success', { userId, projectCount: projects.length });
  }

  private toCached(project: ProjectRecord): CachedProjectRecord {
    return { ...project, updatedAt: project.updatedAt.toISOString() };
  }

  private fromCached(project: CachedProjectRecord): ProjectRecord {
    const updatedAt = new Date(project.updatedAt);
    return { ...project, updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date(0) : updatedAt };
  }

  private withState(current: ResourceState<ProjectRecord[]> | null | undefined, patch: Partial<ResourceState<ProjectRecord[]>>): ResourceState<ProjectRecord[]> {
    return {
      data: current?.data ?? null,
      status: current?.status ?? 'idle',
      source: current?.source ?? 'memory',
      updatedAt: current?.updatedAt ?? null,
      isStale: current?.isStale ?? true,
      error: current?.error ?? null,
      ...patch,
    };
  }
}

export const projectResourceService = ProjectResourceService.getInstance();
