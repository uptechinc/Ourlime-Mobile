import { communityDataService } from './CommunityDataService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { CommunityService } from './CommunityService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { CommunityDashboardData, CommunityReportStatus } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';

export type CommunityReportAction = 'assign' | 'dismiss' | 'resolve' | 'hide';
export type CommunityReportActionInput = {
  communityId: string;
  reportIds: string[];
  action: CommunityReportAction;
  resolutionNote?: string;
  targetId?: string;
  targetType?: 'post' | 'event' | 'poll';
};

const NAMESPACE = 'community-dashboards';
const RETENTION_MS = 48 * 60 * 60 * 1000;
const STALE_MS = 5 * 60 * 1000;

export class CommunityDashboardService {
  private static instance: CommunityDashboardService;
  private readonly data = communityDataService;
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly communityService = CommunityService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): CommunityDashboardService {
    if (!CommunityDashboardService.instance) CommunityDashboardService.instance = new CommunityDashboardService();
    return CommunityDashboardService.instance;
  }

  public async hydrate(userId: string, communityId: string): Promise<void> {
    if (!userId || !communityId || useResourceStore.getState().communityDashboards[communityId]?.data) return;
    const cached = await this.cacheService.read<CommunityDashboardData>(userId, NAMESPACE, communityId).catch(() => null);
    if (!cached) return;
    useResourceStore.getState().setCommunityDashboard(communityId, { data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired, error: null });
  }

  public async refresh(userId: string, communityId: string, force = false): Promise<void> {
    const existing = this.inFlight.get(communityId);
    if (existing) return existing;
    const current = useResourceStore.getState().communityDashboards[communityId];
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < STALE_MS) return;
    useResourceStore.getState().setCommunityDashboard(communityId, this.state(current, current?.data ? 'refreshing' : 'hydrating'));
    const request = (async () => {
      try {
        const [dashboard, community] = await Promise.all([
          this.data.getDashboard(communityId),
          this.communityService.fetchCommunity(communityId),
        ]);
        const dashboardData = { ...dashboard, memberCount: community.memberCount };
        const updatedAt = Date.now();
        useResourceStore.getState().setCommunityDashboard(communityId, { data: dashboardData, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
        await this.cacheService.write(userId, NAMESPACE, communityId, dashboardData, { expiresAt: updatedAt + RETENTION_MS });
      } catch (error: unknown) {
        const latest = useResourceStore.getState().communityDashboards[communityId];
        useResourceStore.getState().setCommunityDashboard(communityId, { ...this.state(latest, latest?.data ? 'ready' : 'error'), isStale: true, error: this.errorService.normalize(error, 'Community dashboard could not be loaded.') });
      } finally {
        this.inFlight.delete(communityId);
      }
    })();
    this.inFlight.set(communityId, request);
    return request;
  }

  public async moderate(userId: string, input: CommunityReportActionInput): Promise<void> {
    await this.data.moderateReports(input);
    await this.refresh(userId, input.communityId, true);
  }

  public statusForAction(action: CommunityReportAction): CommunityReportStatus {
    if (action === 'assign') return 'in_review';
    if (action === 'dismiss') return 'dismissed';
    return 'resolved';
  }

  private state(current: ResourceState<CommunityDashboardData> | undefined, status: ResourceState<CommunityDashboardData>['status']): ResourceState<CommunityDashboardData> {
    return { data: current?.data ?? null, status, source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: null };
  }
}

export const communityDashboardService = CommunityDashboardService.getInstance();
