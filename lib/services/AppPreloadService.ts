import { FeedResourceService } from './FeedResourceService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { LimeMediaPreloadService } from './LimeMediaPreloadService';
import { ProjectResourceService } from './ProjectResourceService';

export class AppPreloadService {
  private static instance: AppPreloadService;
  private readonly feedService = FeedResourceService.getInstance();
  private readonly limeMediaService = LimeMediaPreloadService.getInstance();
  private readonly projectResourceService = ProjectResourceService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private generation = 0;
  private activeRun: { generation: number; userId: string; promise: Promise<void> } | null = null;

  private constructor() {}

  public static getInstance(): AppPreloadService {
    if (!AppPreloadService.instance) AppPreloadService.instance = new AppPreloadService();
    return AppPreloadService.instance;
  }

  public cancel(): void {
    this.generation += 1;
    this.limeMediaService.cancel();
    this.logger.info('AppPreloadService', 'queue:cancel');
  }

  public preload(userId: string): Promise<void> {
    if (this.activeRun) {
      if (this.activeRun.userId === userId && this.activeRun.generation === this.generation) {
        return this.activeRun.promise;
      }
      return this.activeRun.promise.then(() => this.preload(userId));
    }

    const generation = ++this.generation;
    const promise = (async () => {
      try {
        await this.performPreload(userId, generation);
      } finally {
        if (this.activeRun?.generation === generation) this.activeRun = null;
      }
    })();
    this.activeRun = { generation, userId, promise };
    return promise;
  }

  private async performPreload(userId: string, generation: number): Promise<void> {
    const homeQuery = { userId, scope: 'home' as const, filter: 'all' as const };
    await this.feedService.hydrate(homeQuery);
    if (generation !== this.generation) return;
    await this.feedService.refresh(homeQuery);
    if (generation !== this.generation) return;
    await this.feedService.seedDerivedFilters(userId, 'home');
    this.logger.success('AppPreloadService', 'home-feed:complete', { userId });
    if (generation !== this.generation) return;

    const communityQuery = { userId, scope: 'communities' as const, filter: 'all' as const };
    await this.feedService.hydrate(communityQuery);
    if (generation !== this.generation) return;
    await this.feedService.refresh(communityQuery).catch((error: unknown) => {
      this.logger.warn('AppPreloadService', 'communities-feed:failed', { error: error instanceof Error ? error.message : String(error) });
    });
    if (generation !== this.generation) return;
    await this.feedService.seedDerivedFilters(userId, 'communities');
    this.logger.success('AppPreloadService', 'communities-feed:complete', { userId });
    if (generation !== this.generation) return;

    await this.projectResourceService.hydrate(userId);
    if (generation !== this.generation) return;
    await this.projectResourceService.refresh(userId).catch((error: unknown) => {
      this.logger.warn('AppPreloadService', 'project-directory:failed', { error: error instanceof Error ? error.message : String(error) });
    });
    if (generation !== this.generation) return;
    this.logger.success('AppPreloadService', 'project-directory:complete', { userId });
  }
}

export const appPreloadService = AppPreloadService.getInstance();
