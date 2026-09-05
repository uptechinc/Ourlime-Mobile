import { FeedResourceService } from './FeedResourceService';
import { DiscoverResourceService } from './DiscoverResourceService';
import { CommunitiesResourceService, DEFAULT_COMMUNITY_QUERY } from './CommunitiesResourceService';
import { DiagnosticLogService } from './DiagnosticLogService';
import type { FeedScope } from './PostService';
import type { PreloadTask } from '@/lib/types/preload';
import { AdminMetricsService } from './AdminMetricsService';
import { NotificationService } from './NotificationService';
import { RelationshipResourceService } from './RelationshipResourceService';
import { ApiService } from './ApiService';
import { LimeResourceService } from './LimeResourceService';

const SCOPES: readonly FeedScope[] = ['home', 'friends'];

export class AppPreloadService {
  private static instance: AppPreloadService;
  private readonly feedService = FeedResourceService.getInstance();
  private readonly discoverService = DiscoverResourceService.getInstance();
  private readonly communitiesService = CommunitiesResourceService.getInstance();
  private readonly adminMetricsService = AdminMetricsService.getInstance();
  private readonly notificationService = NotificationService.getInstance();
  private readonly relationshipService = RelationshipResourceService.getInstance();
  private readonly apiService = ApiService.getInstance();
  private readonly limeService = LimeResourceService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private generation = 0;
  private activeKeys = new Set<string>();
  private activeRun: { generation: number; userId: string; promise: Promise<void> } | null = null;

  private constructor() {}

  public static getInstance(): AppPreloadService {
    if (!AppPreloadService.instance) AppPreloadService.instance = new AppPreloadService();
    return AppPreloadService.instance;
  }

  public cancel(): void {
    this.generation += 1;
    this.activeKeys.clear();
    this.apiService.cancelBackgroundRequests();
    this.logger.info('AppPreloadService', 'queue:cancel');
  }

  public preload(userId: string, canAccess: (route: string) => boolean): Promise<void> {
    if (this.activeRun) {
      if (this.activeRun.userId === userId && this.activeRun.generation === this.generation) {
        return this.activeRun.promise;
      }
      return this.activeRun.promise.then(() => this.preload(userId, canAccess));
    }

    const generation = ++this.generation;
    const promise = (async () => {
      try {
        await this.performPreload(userId, canAccess, generation);
      } finally {
        if (this.activeRun?.generation === generation) this.activeRun = null;
      }
    })();
    this.activeRun = { generation, userId, promise };
    return promise;
  }

  private async performPreload(userId: string, canAccess: (route: string) => boolean, generation: number): Promise<void> {
    const homeQuery = { userId, scope: 'home' as const, filter: 'all' as const };
    await this.feedService.hydrate(homeQuery);
    if (generation !== this.generation) return;
    await this.feedService.refresh(homeQuery);
    if (generation !== this.generation) return;
    await this.feedService.seedDerivedFilters(userId, 'home');

    const tasks = this.buildTasks(userId).filter((task) => canAccess(task.route));
    this.logger.info('AppPreloadService', 'queue:start', { taskCount: tasks.length, concurrency: 1 });
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < tasks.length && generation === this.generation) {
        if (this.apiService.isTemporarilyUnavailable()) {
          this.logger.warn('AppPreloadService', 'queue:paused-api-unavailable', { remainingTaskCount: tasks.length - nextIndex });
          return;
        }
        const task = tasks[nextIndex++];
        if (this.activeKeys.has(task.key)) continue;
        this.activeKeys.add(task.key);
        const startedAt = Date.now();
        this.logger.info('AppPreloadService', 'task:start', { key: task.key, route: task.route, priority: task.priority });
        try {
          await task.run();
          this.logger.success('AppPreloadService', 'task:complete', { key: task.key, elapsedMs: Date.now() - startedAt });
        } catch (error: unknown) {
          this.logger.error('AppPreloadService', 'task', error, { key: task.key, elapsedMs: Date.now() - startedAt });
        } finally {
          this.activeKeys.delete(task.key);
        }
        if (generation === this.generation && nextIndex < tasks.length) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    };
    await worker();
  }

  private buildTasks(userId: string): PreloadTask[] {
    const tasks: PreloadTask[] = [
      {
        key: 'limes:feeds', route: '/limes', priority: 'navigation', mediaPolicy: 'thumbnail',
        run: async () => {
          const forYouQuery = { userId, scope: 'forYou' as const };
          const followingQuery = { userId, scope: 'following' as const };
          await this.limeService.hydrate(forYouQuery);
          await this.limeService.refresh(forYouQuery);
          await this.limeService.hydrate(followingQuery);
          await this.limeService.refresh(followingQuery);
        },
      },
      {
        key: 'notifications:latest', route: '/notifications', priority: 'navigation', mediaPolicy: 'metadata',
        run: async () => { await this.notificationService.hydrate(userId); await this.notificationService.fetchPage(userId); },
      },
      {
        key: 'discover:overview', route: '/discover', priority: 'navigation', mediaPolicy: 'thumbnail',
        run: async () => { await this.discoverService.hydrate(userId); await this.discoverService.refresh(userId); },
      },
      {
        key: 'communities:directory', route: '/communities', priority: 'navigation', mediaPolicy: 'thumbnail',
        run: async () => { await this.communitiesService.hydrate(userId); await this.communitiesService.refresh(userId, DEFAULT_COMMUNITY_QUERY, false, 'background'); },
      },
      {
        key: 'relationships:friends', route: '/profile', priority: 'navigation', mediaPolicy: 'thumbnail',
        run: async () => { await this.relationshipService.hydrate(userId, 'friends'); await this.relationshipService.refresh(userId, 'friends'); },
      },
    ];
    SCOPES.filter((scope) => scope !== 'home').forEach((scope) => tasks.push({
      key: `feed:${scope}:all`, route: '/', priority: 'navigation', mediaPolicy: 'thumbnail',
      run: async () => {
        const query = { userId, scope, filter: 'all' as const };
        await this.feedService.hydrate(query);
        await this.feedService.refresh(query);
        await this.feedService.seedDerivedFilters(userId, scope);
      },
    }));
    return tasks.sort((left, right) => this.priorityValue(left.priority) - this.priorityValue(right.priority));
  }

  private priorityValue(priority: PreloadTask['priority']): number {
    if (priority === 'critical') return 0;
    if (priority === 'navigation') return 1;
    return 2;
  }
}

export const appPreloadService = AppPreloadService.getInstance();
