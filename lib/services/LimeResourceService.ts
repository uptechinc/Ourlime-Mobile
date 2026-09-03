import { Image } from 'expo-image';
import type { Reel } from '@/types/userTypes';
import type { LimeComment } from '@/lib/types/lime';
import type { ResourceState } from '@/lib/types/resourceState';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { LimeService, type LimeFeedCursor, type LimeFeedScope } from './LimeService';
import { LocalCacheService, type CachedRecord } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { RequestTimeoutService } from './RequestTimeoutService';
import { DiagnosticLogService } from './DiagnosticLogService';

const LIME_NAMESPACE = 'limes';
const LIME_CACHE_VERSION = 'v3';
const LIME_STALE_MS = 90_000;
const LIME_RETENTION_MS = 24 * 60 * 60 * 1000;
const INITIAL_PAGE_SIZE = 12;
const MAXIMUM_MEMORY_REELS = 36;
const AVATAR_PREFETCH_LIMIT = 8;

export type LimeFeedResourceQuery = {
  userId: string;
  category?: string;
  scope?: LimeFeedScope;
};

export type LimeFeedResourceData = {
  reels: Reel[];
  followingUserIds: string[];
  friendUserIds: string[];
  userRepostedReelIds: string[];
  commentsByReel: Record<string, LimeComment[]>;
  nextCursor: LimeFeedCursor | null;
  hasMore: boolean;
  isLoadingMore: boolean;
};

type CachedReel = Omit<Reel, 'createdAt'> & {
  createdAt: string;
};

type CachedLimeFeedResourceData = {
  reels: CachedReel[];
  followingUserIds: string[];
  friendUserIds: string[];
  userRepostedReelIds: string[];
  commentsByReel: Record<string, LimeComment[]>;
  hasMore: boolean;
};

export class LimeResourceService {
  private static instance: LimeResourceService;
  private readonly limeService = LimeService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): LimeResourceService {
    if (!LimeResourceService.instance) {
      LimeResourceService.instance = new LimeResourceService();
    }
    return LimeResourceService.instance;
  }

  public getKey(query: LimeFeedResourceQuery): string {
    return `${query.userId}:${LIME_CACHE_VERSION}:${query.scope ?? 'forYou'}:${query.category?.trim().toLowerCase() || 'all'}`;
  }

  public async hydrate(query: LimeFeedResourceQuery): Promise<void> {
    const key = this.getKey(query);
    const existing = useResourceStore.getState().limeFeeds[key];
    if (existing?.data) return;

    useResourceStore.getState().setLimeFeed(
      key,
      this.withState(existing, { status: 'hydrating', error: null }),
    );

    const cached = await this.cacheService.read<CachedLimeFeedResourceData>(
      query.userId,
      LIME_NAMESPACE,
      key,
    );
    if (!cached || !Array.isArray(cached.data.reels)) {
      const forYouResource = query.scope === 'following'
        ? useResourceStore.getState().limeFeeds[this.getKey({ ...query, scope: 'forYou' })]
        : null;
      if (forYouResource?.data) {
        const followingUserIds = new Set(forYouResource.data.followingUserIds);
        useResourceStore.getState().setLimeFeed(key, {
          ...forYouResource,
          data: {
            ...forYouResource.data,
            reels: forYouResource.data.reels.filter((reel) => followingUserIds.has(reel.userId)),
            nextCursor: null,
            hasMore: false,
            isLoadingMore: false,
          },
          source: 'memory',
          isStale: true,
        });
        return;
      }
      useResourceStore.getState().setLimeFeed(
        key,
        this.withState(null, { status: 'idle', error: null }),
      );
      return;
    }

    const data = this.deserialize(cached);
    useResourceStore.getState().setLimeFeed(key, {
      data,
      status: 'ready',
      source: 'disk',
      updatedAt: cached.updatedAt,
      isStale: cached.isExpired || Date.now() - cached.updatedAt >= LIME_STALE_MS,
      error: null,
    });
    await this.cacheService.touch(query.userId, LIME_NAMESPACE, key);
  }

  public async refresh(query: LimeFeedResourceQuery, force = false): Promise<void> {
    const key = this.getKey(query);
    const existingRequest = this.inFlight.get(key);
    if (existingRequest) return existingRequest;

    const operation = (async () => {
      try {
        await this.performRefresh(query, force);
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, operation);
    return operation;
  }

  public async loadMore(query: LimeFeedResourceQuery): Promise<void> {
    const key = this.getKey(query);
    const requestKey = `${key}:more`;
    const current = useResourceStore.getState().limeFeeds[key];
    if (!current?.data?.hasMore || !current.data.nextCursor || current.data.isLoadingMore) return;
    const existingRequest = this.inFlight.get(requestKey);
    if (existingRequest) return existingRequest;

    useResourceStore.getState().setLimeFeed(key, {
      ...current,
      data: { ...current.data, isLoadingMore: true },
    });

    const operation = (async () => {
      try {
        const page = await this.timeoutService.run(
          this.limeService.fetchFeed(
            query.userId,
            query.category,
            current.data!.nextCursor ?? undefined,
            INITIAL_PAGE_SIZE,
            0,
            query.scope ?? 'forYou',
          ),
          'Limes pagination request',
        );
        const latest = useResourceStore.getState().limeFeeds[key];
        if (!latest?.data) return;
        const reels = this.dedupe([...latest.data.reels, ...page.reels]).slice(0, MAXIMUM_MEMORY_REELS);
        await this.commit(query, {
          ...latest.data,
          reels,
          commentsByReel: { ...latest.data.commentsByReel, ...page.commentsByReel },
          nextCursor: page.lastDoc,
          hasMore: page.hasMore,
          isLoadingMore: false,
        }, 'network');
      } catch (error: unknown) {
        const latest = useResourceStore.getState().limeFeeds[key];
        if (!latest?.data) return;
        useResourceStore.getState().setLimeFeed(key, {
          ...latest,
          status: 'ready',
          isStale: true,
          error: this.errorService.normalize(error, 'Could not load more Limes.'),
          data: { ...latest.data, isLoadingMore: false },
        });
      } finally {
        this.inFlight.delete(requestKey);
      }
    })();

    this.inFlight.set(requestKey, operation);
    return operation;
  }

  public async ensureLime(query: LimeFeedResourceQuery, limeId: string): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().limeFeeds[key];
    if (current?.data?.reels.some((reel) => reel.id === limeId)) {
      const reordered = [
        ...current.data.reels.filter((reel) => reel.id === limeId),
        ...current.data.reels.filter((reel) => reel.id !== limeId),
      ];
      await this.commit(query, { ...current.data, reels: reordered }, current.source);
      return;
    }

    const requestedLime = await this.timeoutService.run(
      this.limeService.fetchLimeById(limeId, 0),
      'Requested Lime lookup',
    );
    if (!requestedLime) return;
    const latest = useResourceStore.getState().limeFeeds[key];
    const data = latest?.data ?? this.emptyData();
    await this.commit(query, {
      ...data,
      reels: this.dedupe([requestedLime, ...data.reels]).slice(0, MAXIMUM_MEMORY_REELS),
    }, 'network');
  }

  public async patchReel(query: LimeFeedResourceQuery, reelId: string, patch: (reel: Reel) => Reel): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().limeFeeds[key];
    if (!current?.data) return;
    await this.commit(query, {
      ...current.data,
      reels: current.data.reels.map((reel) => reel.id === reelId ? patch(reel) : reel),
    }, current.source);
  }

  public async patchFollowing(query: LimeFeedResourceQuery, targetUserId: string, following: boolean): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().limeFeeds[key];
    if (!current?.data) return;
    const followingUserIds = new Set(current.data.followingUserIds);
    if (following) followingUserIds.add(targetUserId);
    else followingUserIds.delete(targetUserId);
    await this.commit(query, {
      ...current.data,
      followingUserIds: Array.from(followingUserIds),
      reels: query.scope === 'following' && !following
        ? current.data.reels.filter((reel) => reel.userId !== targetUserId)
        : current.data.reels,
    }, current.source);

    const userKeyPrefix = `${query.userId}:`;
    Object.entries(useResourceStore.getState().limeFeeds).forEach(([resourceKey, resource]) => {
      if (resourceKey === key || !resourceKey.startsWith(userKeyPrefix) || !resource.data) return;
      const resourceFollowingIds = new Set(resource.data.followingUserIds);
      if (following) resourceFollowingIds.add(targetUserId);
      else resourceFollowingIds.delete(targetUserId);
      useResourceStore.getState().setLimeFeed(resourceKey, {
        ...resource,
        data: {
          ...resource.data,
          followingUserIds: Array.from(resourceFollowingIds),
          reels: resourceKey.startsWith(`${query.userId}:${LIME_CACHE_VERSION}:following:`) && !following
            ? resource.data.reels.filter((reel) => reel.userId !== targetUserId)
            : resource.data.reels,
        },
        isStale: true,
      });
    });
  }

  public async removeReel(query: LimeFeedResourceQuery, reelId: string): Promise<void> {
    const userKeyPrefix = `${query.userId}:${LIME_CACHE_VERSION}:`;
    const matchingResources = Object.entries(useResourceStore.getState().limeFeeds)
      .filter(([resourceKey, resource]) => resourceKey.startsWith(userKeyPrefix) && resource.data);

    await Promise.all(matchingResources.map(async ([resourceKey, resource]) => {
      if (!resource.data) return;
      const commentsByReel = { ...resource.data.commentsByReel };
      delete commentsByReel[reelId];
      await this.commitKey(query.userId, resourceKey, {
        ...resource.data,
        reels: resource.data.reels.filter((reel) => reel.id !== reelId),
        userRepostedReelIds: resource.data.userRepostedReelIds.filter((id) => id !== reelId),
        commentsByReel,
      }, resource.source);
    }));
  }

  public async patchRepostMarker(query: LimeFeedResourceQuery, reelId: string, reposted: boolean): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().limeFeeds[key];
    if (!current?.data) return;
    const ids = new Set(current.data.userRepostedReelIds);
    if (reposted) ids.add(reelId);
    else ids.delete(reelId);
    await this.commit(query, { ...current.data, userRepostedReelIds: Array.from(ids) }, current.source);
  }

  private async performRefresh(query: LimeFeedResourceQuery, force: boolean): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().limeFeeds[key];
    if (!force && current?.data && !current.isStale && current.updatedAt && Date.now() - current.updatedAt < LIME_STALE_MS) {
      return;
    }

    useResourceStore.getState().setLimeFeed(
      key,
      this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }),
    );

    try {
      const [page, repostedIds] = await this.timeoutService.run(
        Promise.all([
          this.limeService.fetchFeed(
            query.userId,
            query.category,
            undefined,
            INITIAL_PAGE_SIZE,
            0,
            query.scope ?? 'forYou',
          ),
          this.limeService.fetchUserRepostedLimeIds(query.userId),
        ]),
        'Limes feed request',
      );
      await this.commit(query, {
        reels: page.reels.slice(0, MAXIMUM_MEMORY_REELS),
        followingUserIds: page.followingUserIds,
        friendUserIds: page.friendUserIds,
        userRepostedReelIds: Array.from(repostedIds),
        commentsByReel: page.commentsByReel,
        nextCursor: page.lastDoc,
        hasMore: page.hasMore,
        isLoadingMore: false,
      }, 'network');
      void this.prefetchAvatars(page.reels);
    } catch (error: unknown) {
      const latest = useResourceStore.getState().limeFeeds[key];
      useResourceStore.getState().setLimeFeed(key, {
        ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }),
        isStale: true,
        error: this.errorService.normalize(error, 'Could not load Limes.'),
      });
    }
  }

  private async commit(
    query: LimeFeedResourceQuery,
    data: LimeFeedResourceData,
    source: ResourceState<LimeFeedResourceData>['source'],
  ): Promise<void> {
    const key = this.getKey(query);
    await this.commitKey(query.userId, key, data, source);
  }

  private async commitKey(
    userId: string,
    key: string,
    data: LimeFeedResourceData,
    source: ResourceState<LimeFeedResourceData>['source'],
  ): Promise<void> {
    const updatedAt = Date.now();
    useResourceStore.getState().setLimeFeed(key, {
      data,
      status: 'ready',
      source,
      updatedAt,
      isStale: false,
      error: null,
    });
    await this.cacheService.write(
      userId,
      LIME_NAMESPACE,
      key,
      this.serialize(data),
      { expiresAt: updatedAt + LIME_RETENTION_MS },
    );
    await this.cacheService.prune({
      userId,
      namespace: LIME_NAMESPACE,
      maximumRecords: 8,
      maximumExpiredAgeMs: LIME_RETENTION_MS,
    });
  }

  private serialize(data: LimeFeedResourceData): CachedLimeFeedResourceData {
    return {
      reels: data.reels.map((reel) => ({
        ...reel,
        createdAt: reel.createdAt.toISOString(),
      })),
      followingUserIds: data.followingUserIds,
      friendUserIds: data.friendUserIds,
      userRepostedReelIds: data.userRepostedReelIds,
      commentsByReel: data.commentsByReel,
      hasMore: data.hasMore,
    };
  }

  private deserialize(cached: CachedRecord<CachedLimeFeedResourceData>): LimeFeedResourceData {
    return {
      reels: cached.data.reels.map((reel) => ({
        ...reel,
        createdAt: new Date(reel.createdAt),
        repostedBy: Array.isArray(reel.repostedBy)
          ? reel.repostedBy
          : reel.repostedBy
            ? [reel.repostedBy as NonNullable<Reel['repostedBy']>[number]]
            : undefined,
      })),
      followingUserIds: cached.data.followingUserIds ?? [],
      friendUserIds: cached.data.friendUserIds ?? [],
      userRepostedReelIds: cached.data.userRepostedReelIds ?? [],
      commentsByReel: cached.data.commentsByReel ?? {},
      nextCursor: null,
      hasMore: cached.data.hasMore,
      isLoadingMore: false,
    };
  }

  private async prefetchAvatars(reels: Reel[]): Promise<void> {
    const urls = Array.from(new Set(reels
      .map((reel) => reel.user.profileImage)
      .filter((url): url is string => Boolean(url))))
      .slice(0, AVATAR_PREFETCH_LIMIT);
    await Promise.all(urls.map((url) => Image.prefetch(url).catch(() => false)));
    this.logger.info('LimeResourceService', 'avatar-preload', { count: urls.length });
  }

  private withState(
    current: ResourceState<LimeFeedResourceData> | null | undefined,
    changes: Partial<ResourceState<LimeFeedResourceData>>,
  ): ResourceState<LimeFeedResourceData> {
    return {
      data: current?.data ?? null,
      status: current?.status ?? 'idle',
      source: current?.source ?? 'memory',
      updatedAt: current?.updatedAt ?? null,
      isStale: current?.isStale ?? true,
      error: current?.error ?? null,
      ...changes,
    };
  }

  private emptyData(): LimeFeedResourceData {
    return {
      reels: [],
      followingUserIds: [],
      friendUserIds: [],
      userRepostedReelIds: [],
      commentsByReel: {},
      nextCursor: null,
      hasMore: false,
      isLoadingMore: false,
    };
  }

  private dedupe(reels: Reel[]): Reel[] {
    return Array.from(new Map(reels.map((reel) => [reel.id, reel])).values());
  }
}

export const limeResourceService = LimeResourceService.getInstance();
