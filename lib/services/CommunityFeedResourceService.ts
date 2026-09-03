import { PostService, type PostItem } from './PostService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';

const NAMESPACE = 'community-feeds';
const STALE_MS = 60_000;
const RETENTION_MS = 48 * 60 * 60 * 1000;

export class CommunityFeedResourceService {
  private static instance: CommunityFeedResourceService;
  private readonly posts = PostService.getInstance();
  private readonly cache = LocalCacheService.getInstance();
  private readonly errors = ResourceErrorService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();
  private constructor() {}
  public static getInstance(): CommunityFeedResourceService {
    if (!CommunityFeedResourceService.instance) CommunityFeedResourceService.instance = new CommunityFeedResourceService();
    return CommunityFeedResourceService.instance;
  }
  public getKey(userId: string, communityId: string): string { return `${userId}:${communityId}`; }

  public async hydrate(userId: string, communityId: string): Promise<void> {
    const key = this.getKey(userId, communityId);
    const current = useResourceStore.getState().communityFeeds[key];
    if (current?.data) return;
    useResourceStore.getState().setCommunityFeed(key, { ...(current ?? createIdleResource()), status: 'hydrating', error: null });
    try {
      const cached = await this.cache.read<PostItem[]>(userId, NAMESPACE, communityId);
      if (!cached) return useResourceStore.getState().setCommunityFeed(key, createIdleResource());
      useResourceStore.getState().upsertPostEntities(cached.data);
      useResourceStore.getState().setCommunityFeed(key, { data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired || Date.now() - cached.updatedAt >= STALE_MS, error: null });
    } catch (error: unknown) {
      useResourceStore.getState().setCommunityFeed(key, { ...(current ?? createIdleResource()), status: 'error', error: this.errors.normalize(error, 'Community posts could not be restored.') });
    }
  }

  public async refresh(userId: string, communityId: string, force = false): Promise<void> {
    const key = this.getKey(userId, communityId);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const current = useResourceStore.getState().communityFeeds[key];
    if (!force && current?.updatedAt && !current.isStale && Date.now() - current.updatedAt < STALE_MS) return;
    const operation = (async () => {
      useResourceStore.getState().setCommunityFeed(key, { ...(current ?? createIdleResource()), status: current?.data ? 'refreshing' : 'hydrating', error: null });
      try {
        const posts = await this.posts.fetchCommunityPosts(communityId);
        await this.commit(userId, communityId, posts);
      } catch (error: unknown) {
        const latest = useResourceStore.getState().communityFeeds[key] ?? createIdleResource<PostItem[]>();
        useResourceStore.getState().setCommunityFeed(key, { ...latest, status: latest.data ? 'ready' : 'error', isStale: true, error: this.errors.normalize(error, 'Community posts are unavailable.') });
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, operation);
    return operation;
  }

  public async patchPost(post: PostItem): Promise<void> {
    const store = useResourceStore.getState();
    store.upsertPostEntities([post]);
    await Promise.all(Object.entries(store.communityFeeds).map(async ([key, resource]) => {
      if (!resource.data || !resource.data.some((item) => item.id === post.id)) return;
      const data = resource.data.map((item) => item.id === post.id ? post : item);
      store.setCommunityFeed(key, { ...resource, data });
      await this.cache.write(key.split(':')[0], NAMESPACE, key.split(':').slice(1).join(':'), data, { expiresAt: Date.now() + RETENTION_MS });
    }));
  }

  public async prepend(userId: string, communityId: string, post: PostItem): Promise<void> {
    const key = this.getKey(userId, communityId);
    const current = useResourceStore.getState().communityFeeds[key] ?? createIdleResource<PostItem[]>();
    await this.commit(userId, communityId, [post, ...(current.data ?? []).filter((item) => item.id !== post.id)]);
  }

  public async remove(postId: string): Promise<void> {
    const store = useResourceStore.getState();
    await Promise.all(Object.entries(store.communityFeeds).map(async ([key, resource]) => {
      if (!resource.data) return;
      const data = resource.data.filter((post) => post.id !== postId);
      store.setCommunityFeed(key, { ...resource, data });
      await this.cache.write(key.split(':')[0], NAMESPACE, key.split(':').slice(1).join(':'), data, { expiresAt: Date.now() + RETENTION_MS });
    }));
  }

  private async commit(userId: string, communityId: string, posts: PostItem[]): Promise<void> {
    const updatedAt = Date.now();
    const store = useResourceStore.getState();
    store.upsertPostEntities(posts);
    store.setCommunityFeed(this.getKey(userId, communityId), { data: posts, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
    await this.cache.write(userId, NAMESPACE, communityId, posts, { expiresAt: updatedAt + RETENTION_MS });
  }
}

export const communityFeedResourceService = CommunityFeedResourceService.getInstance();
