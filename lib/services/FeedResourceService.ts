import { PostService, type FeedFilter, type FeedPage, type FeedScope, type PostItem } from './PostService';
import { LocalCacheService, type CachedRecord } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { RequestTimeoutService } from './RequestTimeoutService';
import { useResourceStore, type FeedResourceData } from '@/lib/store/useResourceStore';
import type { ResourceState } from '@/lib/types/resourceState';
import { communityFeedResourceService } from './CommunityFeedResourceService';

const FEED_NAMESPACE = 'feeds';
const FEED_STALE_MS = 60_000;
const FEED_RETENTION_MS = 48 * 60 * 60 * 1000;

export type FeedResourceQuery = {
  userId: string;
  scope: FeedScope;
  filter: FeedFilter;
  authorId?: string;
};

export class FeedResourceService {
  private static instance: FeedResourceService;
  private readonly postService = PostService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): FeedResourceService {
    if (!FeedResourceService.instance) FeedResourceService.instance = new FeedResourceService();
    return FeedResourceService.instance;
  }

  public getKey(query: FeedResourceQuery): string {
    return `${query.userId}:${query.scope}:${query.filter}:${query.authorId ?? 'feed'}`;
  }

  public async hydrate(query: FeedResourceQuery): Promise<void> {
    const key = this.getKey(query);
    const existing = useResourceStore.getState().feeds[key];
    if (existing?.data) return;
    useResourceStore.getState().setFeed(key, this.withState(existing, { status: 'hydrating', error: null }));
    let cached: CachedRecord<FeedResourceData> | null;
    try {
      cached = await this.cacheService.read<FeedResourceData>(query.userId, FEED_NAMESPACE, key);
    } catch {
      useResourceStore.getState().setFeed(key, this.withState(null, { status: 'idle', error: null }));
      return;
    }
    if (!cached) {
      useResourceStore.getState().setFeed(key, this.withState(null, { status: 'idle' }));
      return;
    }
    const hydratedData: FeedResourceData = { ...cached.data, pendingPosts: cached.data.pendingPosts ?? [], scrollOffset: cached.data.scrollOffset ?? 0 };
    useResourceStore.getState().upsertPostEntities([...hydratedData.posts, ...hydratedData.pendingPosts]);
    useResourceStore.getState().setFeed(key, {
      data: hydratedData,
      status: 'ready',
      source: 'disk',
      updatedAt: cached.updatedAt,
      isStale: cached.isExpired || hydratedData.isPartialSeed === true || Date.now() - cached.updatedAt >= FEED_STALE_MS,
      error: null,
    });
    await this.cacheService.touch(query.userId, FEED_NAMESPACE, key);
  }

  public async refresh(query: FeedResourceQuery, options: { force?: boolean; bufferNewPosts?: boolean } = {}): Promise<void> {
    const key = this.getKey(query);
    const existingRequest = this.inFlight.get(key);
    if (existingRequest) return existingRequest;
    const operation = this.performRefresh(query, options).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  public async loadMore(query: FeedResourceQuery): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().feeds[key];
    if (!current?.data?.hasMore || !current.data.nextCursor || this.inFlight.has(`${key}:more`)) return;
    const operation = this.timeoutService.run(this.postService.fetchFeedPage({ limit: 20, cursor: current.data.nextCursor, filter: query.filter, scope: query.scope, authorId: query.authorId }), 'Feed pagination request').then(async (page) => {
      const posts = this.dedupe([...current.data!.posts, ...page.posts]).slice(0, 60);
      await this.commit(query, { ...current.data!, posts, nextCursor: page.nextCursor, hasMore: page.hasMore }, 'network');
    }).catch((error: unknown) => {
      useResourceStore.getState().setFeed(key, { ...current, status: 'ready', isStale: true, error: this.errorService.normalize(error, 'Could not load more posts.') });
    }).finally(() => this.inFlight.delete(`${key}:more`));
    this.inFlight.set(`${key}:more`, operation);
    return operation;
  }

  public async revealPending(query: FeedResourceQuery): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().feeds[key];
    if (!current?.data || current.data.pendingPosts.length === 0) return;
    await this.commit(query, { ...current.data, posts: this.dedupe([...current.data.pendingPosts, ...current.data.posts]), pendingPosts: [], scrollOffset: 0 }, current.source);
  }

  public async patchPost(updatedPost: PostItem): Promise<void> {
    const state = useResourceStore.getState();
    state.upsertPostEntities([updatedPost]);
    await Promise.all(Object.entries(state.feeds).map(async ([key, resource]) => {
      if (!resource.data) return;
      const userId = key.split(':')[0];
      const nextData = { ...resource.data, posts: resource.data.posts.map((post) => post.id === updatedPost.id ? updatedPost : post) };
      state.setFeed(key, { ...resource, data: nextData });
      await this.cacheService.write(userId, FEED_NAMESPACE, key, nextData, { expiresAt: Date.now() + FEED_RETENTION_MS });
    }));
    await communityFeedResourceService.patchPost(updatedPost);
  }

  public async patchAuthor(userId: string, updates: { firstName: string; lastName: string; userName: string; profilePicture: string | null }): Promise<void> {
    const state = useResourceStore.getState();
    await Promise.all(Object.entries(state.feeds).map(async ([key, resource]) => {
      if (!resource.data) return;
      const patch = (post: PostItem): PostItem => post.userId !== userId ? post : { ...post, user: { ...post.user, firstName: updates.firstName, lastName: updates.lastName, userName: updates.userName, profileImage: updates.profilePicture ?? undefined } };
      const nextData = { ...resource.data, posts: resource.data.posts.map(patch), pendingPosts: resource.data.pendingPosts.map(patch) };
      state.setFeed(key, { ...resource, data: nextData });
      await this.cacheService.write(key.split(':')[0], FEED_NAMESPACE, key, nextData, { expiresAt: Date.now() + FEED_RETENTION_MS });
    }));
  }

  public async removePosts(predicate: (post: PostItem) => boolean): Promise<void> {
    const state = useResourceStore.getState();
    const removedIds = Object.values(state.postEntities).filter(predicate).map((post) => post.id);
    await Promise.all(Object.entries(state.feeds).map(async ([key, resource]) => {
      if (!resource.data) return;
      const nextData = { ...resource.data, posts: resource.data.posts.filter((post) => !predicate(post)), pendingPosts: resource.data.pendingPosts.filter((post) => !predicate(post)) };
      state.setFeed(key, { ...resource, data: nextData });
      await this.cacheService.write(key.split(':')[0], FEED_NAMESPACE, key, nextData, { expiresAt: Date.now() + FEED_RETENTION_MS });
    }));
    await Promise.all(removedIds.map((postId) => communityFeedResourceService.remove(postId)));
  }

  public async prependCreated(query: FeedResourceQuery, post: PostItem): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().feeds[key];
    const data: FeedResourceData = current?.data ? { ...current.data, posts: this.dedupe([post, ...current.data.posts]) } : { posts: [post], nextCursor: null, hasMore: false, pendingPosts: [], scrollOffset: 0 };
    await this.commit(query, data, 'memory');
  }

  public async seedDerivedFilters(userId: string, scope: FeedScope): Promise<void> {
    const allQuery: FeedResourceQuery = { userId, scope, filter: 'all' };
    const allResource = useResourceStore.getState().feeds[this.getKey(allQuery)];
    if (!allResource?.data) return;
    const filters: Exclude<FeedFilter, 'all'>[] = ['photo', 'video', 'audio', 'poll', 'event'];
    for (const filter of filters) {
      const query: FeedResourceQuery = { userId, scope, filter };
      const key = this.getKey(query);
      if (useResourceStore.getState().feeds[key]?.data) continue;
      const posts = allResource.data!.posts.filter((post) => this.matchesFilter(post, filter));
      const data: FeedResourceData = { posts, nextCursor: null, hasMore: true, pendingPosts: [], scrollOffset: 0, isPartialSeed: true };
      const updatedAt = Date.now();
      useResourceStore.getState().upsertPostEntities(posts);
      useResourceStore.getState().setFeed(key, { data, status: 'ready', source: allResource.source, updatedAt, isStale: true, error: null });
    }
  }

  public setScrollOffset(query: FeedResourceQuery, scrollOffset: number): void {
    const key = this.getKey(query);
    const current = useResourceStore.getState().feeds[key];
    if (!current?.data) return;
    const nextData = { ...current.data, scrollOffset };
    useResourceStore.getState().setFeed(key, { ...current, data: nextData });
    void this.cacheService.write(query.userId, FEED_NAMESPACE, key, nextData, { expiresAt: Date.now() + FEED_RETENTION_MS });
  }

  public async reconcileCachedFeeds(userId: string): Promise<void> {
    const keys = Object.keys(useResourceStore.getState().feeds).filter((key) => key.startsWith(`${userId}:`));
    await Promise.all(keys.map(async (key) => {
      const parts = key.split(':');
      const scope = parts[1];
      const filter = parts[2];
      if ((scope !== 'home' && scope !== 'friends' && scope !== 'communities') || (filter !== 'all' && filter !== 'photo' && filter !== 'video' && filter !== 'audio' && filter !== 'poll' && filter !== 'event')) return;
      await this.refresh({ userId, scope, filter, authorId: parts[3] === 'feed' ? undefined : parts[3] }, { bufferNewPosts: true });
    }));
  }

  private async performRefresh(query: FeedResourceQuery, options: { force?: boolean; bufferNewPosts?: boolean }): Promise<void> {
    const key = this.getKey(query);
    const current = useResourceStore.getState().feeds[key];
    if (!options.force && current?.data && !current.isStale && current.updatedAt && Date.now() - current.updatedAt < FEED_STALE_MS) return;
    useResourceStore.getState().setFeed(key, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    try {
      const page = await this.timeoutService.run(this.postService.fetchFeedPage({ limit: 20, filter: query.filter, scope: query.scope, authorId: query.authorId }), 'Feed request');
      const currentData = useResourceStore.getState().feeds[key]?.data;
      const existingIds = new Set(currentData?.posts.map((post) => post.id) ?? []);
      const newPosts = page.posts.filter((post) => !existingIds.has(post.id));
      const shouldBuffer = options.bufferNewPosts === true && Boolean(currentData?.posts.length) && newPosts.length > 0;
      const refreshedById = new Map(page.posts.map((post) => [post.id, post]));
      const data: FeedResourceData = {
        posts: shouldBuffer ? (currentData?.posts ?? []).map((post) => refreshedById.get(post.id) ?? post) : page.posts.slice(0, 60),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        pendingPosts: shouldBuffer ? this.dedupe([...(currentData?.pendingPosts ?? []), ...newPosts]) : [],
        scrollOffset: currentData?.scrollOffset ?? 0,
        isPartialSeed: false,
      };
      await this.commit(query, data, 'network');
    } catch (error: unknown) {
      const latest = useResourceStore.getState().feeds[key];
      useResourceStore.getState().setFeed(key, { ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'Could not load your feed.') });
    }
  }

  private async commit(query: FeedResourceQuery, data: FeedResourceData, source: ResourceState<FeedResourceData>['source']): Promise<void> {
    const key = this.getKey(query);
    const updatedAt = Date.now();
    useResourceStore.getState().upsertPostEntities([...data.posts, ...data.pendingPosts]);
    useResourceStore.getState().setFeed(key, { data, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(query.userId, FEED_NAMESPACE, key, data, { expiresAt: updatedAt + FEED_RETENTION_MS });
    await this.cacheService.prune({ userId: query.userId, namespace: FEED_NAMESPACE, maximumRecords: 24, maximumExpiredAgeMs: FEED_RETENTION_MS });
  }

  private withState(current: ResourceState<FeedResourceData> | null | undefined, changes: Partial<ResourceState<FeedResourceData>>): ResourceState<FeedResourceData> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }

  private dedupe(posts: PostItem[]): PostItem[] {
    return Array.from(new Map(posts.map((post) => [post.id, post])).values());
  }

  private matchesFilter(post: PostItem, filter: Exclude<FeedFilter, 'all'>): boolean {
    if (filter === 'poll' || filter === 'event') return post.type === filter;
    if (filter === 'photo') return post.media.some((media) => media.type === 'image');
    if (filter === 'video') return post.media.some((media) => media.type === 'video');
    return false;
  }
}

export const feedResourceService = FeedResourceService.getInstance();
