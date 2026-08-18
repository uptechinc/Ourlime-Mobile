import { CommunityService } from './CommunityService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { ResourceState } from '@/lib/types/resourceState';
import type { CommunityCardModel, CommunityCategory, CommunityDirectoryPage, CommunityDirectoryQuery, CommunityDirectoryScope, CommunityDirectoryVisibility } from '@/lib/types/community';
import { DiscoverResourceService } from './DiscoverResourceService';
import type { ApiRequestPriority } from './ApiService';

const DIRECTORY_NAMESPACE = 'community-directories';
const CATEGORY_NAMESPACE = 'community-categories';
const CATEGORY_KEY = 'live';
const DIRECTORY_STALE_MS = 5 * 60 * 1000;
const DIRECTORY_RETENTION_MS = 48 * 60 * 60 * 1000;
const MAX_PERSISTED_ITEMS = 60;

export const DEFAULT_COMMUNITY_QUERY: CommunityDirectoryQuery = {
  scope: 'all',
  visibility: 'all',
  categoryId: null,
  search: '',
  sort: 'popular',
  cursor: null,
  limit: 20,
};

const emptyDirectoryResource = (): ResourceState<CommunityDirectoryPage> => ({
  data: null,
  status: 'idle',
  source: 'memory',
  updatedAt: null,
  isStale: true,
  error: null,
});

export class CommunitiesResourceService {
  private static instance: CommunitiesResourceService;
  private readonly communityService = CommunityService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly discoverService = DiscoverResourceService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();
  private categoriesInFlight: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): CommunitiesResourceService {
    if (!CommunitiesResourceService.instance) CommunitiesResourceService.instance = new CommunitiesResourceService();
    return CommunitiesResourceService.instance;
  }

  public getQueryKey(query: CommunityDirectoryQuery): string {
    return [query.scope, query.visibility, query.categoryId ?? 'all', query.sort, query.search.trim().toLowerCase() || 'all'].map(encodeURIComponent).join(':');
  }

  public async hydrate(userId: string, query: CommunityDirectoryQuery = DEFAULT_COMMUNITY_QUERY): Promise<void> {
    const queryKey = this.getQueryKey(query);
    const current = useResourceStore.getState().communityDirectories[queryKey];
    if (current?.data) return;
    useResourceStore.getState().setCommunityDirectory(queryKey, this.withState(current, { status: 'hydrating', error: null }));
    try {
      const cached = await this.cacheService.read<CommunityDirectoryPage>(userId, DIRECTORY_NAMESPACE, queryKey);
      if (!cached) {
        useResourceStore.getState().setCommunityDirectory(queryKey, this.withState(null, { status: 'idle' }));
        return;
      }
      useResourceStore.getState().setCommunityDirectory(queryKey, {
        data: cached.data,
        status: 'ready',
        source: 'disk',
        updatedAt: cached.updatedAt,
        isStale: cached.isExpired || Date.now() - cached.updatedAt >= DIRECTORY_STALE_MS,
        error: null,
      });
    } catch (error: unknown) {
      useResourceStore.getState().setCommunityDirectory(queryKey, {
        ...this.withState(null, { status: 'error' }),
        error: this.errorService.normalize(error, 'Communities cache could not be loaded.'),
      });
    }
  }

  public async hydrateCategories(userId: string): Promise<void> {
    const current = useResourceStore.getState().communityCategories;
    if (current.data) return;
    useResourceStore.getState().setCommunityCategories(this.withCategoryState(current, { status: 'hydrating', error: null }));
    try {
      const cached = await this.cacheService.read<CommunityCategory[]>(userId, CATEGORY_NAMESPACE, CATEGORY_KEY);
      if (!cached) {
        useResourceStore.getState().setCommunityCategories(this.withCategoryState(null, { status: 'idle' }));
        return;
      }
      useResourceStore.getState().setCommunityCategories({ data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired || Date.now() - cached.updatedAt >= DIRECTORY_STALE_MS, error: null });
    } catch (error: unknown) {
      useResourceStore.getState().setCommunityCategories({ ...this.withCategoryState(null, { status: 'error' }), error: this.errorService.normalize(error, 'Community categories could not be loaded.') });
    }
  }

  public async refresh(userId: string, query: CommunityDirectoryQuery = DEFAULT_COMMUNITY_QUERY, force = false, priority: ApiRequestPriority = 'foreground'): Promise<void> {
    const queryKey = this.getQueryKey(query);
    const requestKey = `refresh:${priority}:${queryKey}`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    const current = useResourceStore.getState().communityDirectories[queryKey];
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < DIRECTORY_STALE_MS) return;
    const request = this.performRefresh(userId, query, queryKey, priority).finally(() => this.inFlight.delete(requestKey));
    this.inFlight.set(requestKey, request);
    return request;
  }

  public async refreshCategories(userId: string, force = false): Promise<void> {
    const current = useResourceStore.getState().communityCategories;
    if (!force && current.data && current.updatedAt && Date.now() - current.updatedAt < DIRECTORY_STALE_MS) return;
    if (this.categoriesInFlight) return this.categoriesInFlight;
    useResourceStore.getState().setCommunityCategories(this.withCategoryState(current, { status: current.data ? 'refreshing' : 'hydrating', error: null }));
    this.categoriesInFlight = this.communityService.fetchCategories().then(async (categories) => {
      const updatedAt = Date.now();
      useResourceStore.getState().setCommunityCategories({ data: categories, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await this.cacheService.write(userId, CATEGORY_NAMESPACE, CATEGORY_KEY, categories, { expiresAt: updatedAt + DIRECTORY_RETENTION_MS });
    }).catch((error: unknown) => {
      const latest = useResourceStore.getState().communityCategories;
      useResourceStore.getState().setCommunityCategories({ ...this.withCategoryState(latest, { status: latest.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'Community categories could not be loaded.') });
    }).finally(() => { this.categoriesInFlight = null; });
    return this.categoriesInFlight;
  }

  public async loadMore(userId: string, query: CommunityDirectoryQuery): Promise<void> {
    const queryKey = this.getQueryKey(query);
    const current = useResourceStore.getState().communityDirectories[queryKey];
    if (!current?.data?.hasMore || !current.data.nextCursor || current.data.items.length >= MAX_PERSISTED_ITEMS) return;
    const requestKey = `more:${queryKey}`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    useResourceStore.getState().setCommunityDirectory(queryKey, { ...current, status: 'refreshing', error: null });
    const request = this.communityService.fetchDirectory({ ...query, cursor: current.data.nextCursor }).then(async (page) => {
      const latest = useResourceStore.getState().communityDirectories[queryKey];
      const existingItems = latest?.data?.items ?? [];
      const knownIds = new Set(existingItems.map((community) => community.id));
      const mergedItems = [...existingItems, ...page.items.filter((community) => !knownIds.has(community.id))].slice(0, MAX_PERSISTED_ITEMS);
      await this.commit(userId, queryKey, { ...page, items: mergedItems, communityOfTheWeek: page.communityOfTheWeek ?? latest?.data?.communityOfTheWeek ?? null }, 'network');
    }).catch((error: unknown) => {
      const latest = useResourceStore.getState().communityDirectories[queryKey];
      useResourceStore.getState().setCommunityDirectory(queryKey, { ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'More communities could not be loaded.') });
    }).finally(() => this.inFlight.delete(requestKey));
    this.inFlight.set(requestKey, request);
    return request;
  }

  public async patchCommunity(userId: string, community: CommunityCardModel): Promise<void> {
    const entries = Object.entries(useResourceStore.getState().communityDirectories);
    await Promise.all(entries.map(async ([queryKey, resource]) => {
      if (!resource.data) return;
      const containsCommunity = resource.data.items.some((item) => item.id === community.id);
      const heroMatches = resource.data.communityOfTheWeek?.id === community.id;
      const matchesQuery = this.matchesQueryKey(queryKey, community, userId);
      if (!containsCommunity && !heroMatches && !matchesQuery) return;
      const withoutCommunity = resource.data.items.filter((item) => item.id !== community.id);
      const items = matchesQuery ? [community, ...withoutCommunity].slice(0, MAX_PERSISTED_ITEMS) : withoutCommunity;
      const data: CommunityDirectoryPage = {
        ...resource.data,
        items,
        totalCount: Math.max(0, resource.data.totalCount + (!containsCommunity && matchesQuery ? 1 : containsCommunity && !matchesQuery ? -1 : 0)),
        communityOfTheWeek: heroMatches ? community : resource.data.communityOfTheWeek,
      };
      await this.commit(userId, queryKey, data, resource.source);
    }));
    await this.discoverService.patchCommunity(userId, community.id, {
      membershipCount: community.memberCount,
      isMember: community.membershipState === 'member' || community.membershipState === 'owner',
    });
  }

  public async removeCommunity(userId: string, communityId: string): Promise<void> {
    const entries = Object.entries(useResourceStore.getState().communityDirectories);
    await Promise.all(entries.map(async ([queryKey, resource]) => {
      if (!resource.data) return;
      const contained = resource.data.items.some((community) => community.id === communityId);
      const heroMatched = resource.data.communityOfTheWeek?.id === communityId;
      if (!contained && !heroMatched) return;
      const data: CommunityDirectoryPage = {
        ...resource.data,
        items: resource.data.items.filter((community) => community.id !== communityId),
        communityOfTheWeek: heroMatched ? null : resource.data.communityOfTheWeek,
        totalCount: Math.max(0, resource.data.totalCount - (contained ? 1 : 0)),
      };
      await this.commit(userId, queryKey, data, resource.source);
    }));
    await this.discoverService.removeCommunity(userId, communityId);
  }

  private matchesQueryKey(queryKey: string, community: CommunityCardModel, userId: string): boolean {
    const [scopeValue, visibilityValue, categoryValue, _sortValue, searchValue] = queryKey.split(':').map((value) => decodeURIComponent(value));
    if (scopeValue === 'joined' && community.membershipState !== 'member' && community.membershipState !== 'owner') return false;
    if (scopeValue === 'friends' && community.friendMemberCount === 0) return false;
    if (scopeValue === 'created' && community.creatorId !== userId) return false;
    if (scopeValue === 'new' && community.createdAtMs < Date.now() - 30 * 24 * 60 * 60 * 1000) return false;
    if (visibilityValue === 'public' && community.isPrivate) return false;
    if (visibilityValue === 'private' && !community.isPrivate) return false;
    if (categoryValue && categoryValue !== 'all' && community.categoryId !== categoryValue) return false;
    if (searchValue && searchValue !== 'all' && !`${community.title} ${community.description} ${community.categoryName}`.toLowerCase().includes(searchValue)) return false;
    return true;
  }

  private async performRefresh(userId: string, query: CommunityDirectoryQuery, queryKey: string, priority: ApiRequestPriority): Promise<void> {
    const current = useResourceStore.getState().communityDirectories[queryKey];
    useResourceStore.getState().setCommunityDirectory(queryKey, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    try {
      const page = await this.communityService.fetchDirectory({ ...query, cursor: null }, priority);
      await this.commit(userId, queryKey, page, 'network');
      if (query.scope === 'all' && !query.categoryId && !query.search.trim()) {
        this.seedDerivedScopes(userId, page.items);
      }
    } catch (error: unknown) {
      const latest = useResourceStore.getState().communityDirectories[queryKey];
      useResourceStore.getState().setCommunityDirectory(queryKey, {
        ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }),
        isStale: true,
        error: this.errorService.normalize(error, 'We could not load communities.'),
      });
    }
  }

  private seedDerivedScopes(userId: string, allItems: CommunityCardModel[]): void {
    const scopes: CommunityDirectoryScope[] = ['joined', 'friends', 'new', 'created'];
    const visibilities: CommunityDirectoryVisibility[] = ['all', 'public', 'private'];

    scopes.forEach((scope) => {
      visibilities.forEach((visibility) => {
        const query: CommunityDirectoryQuery = {
          scope,
          visibility,
          categoryId: null,
          search: '',
          sort: 'popular',
          cursor: null,
          limit: 20,
        };
        const queryKey = this.getQueryKey(query);
        const current = useResourceStore.getState().communityDirectories[queryKey];
        if (current?.data && !current.isStale) return;

        let filtered = allItems;
        if (scope === 'joined') {
          filtered = filtered.filter((item) => item.membershipState === 'member' || item.membershipState === 'owner');
        } else if (scope === 'created') {
          filtered = filtered.filter((item) => item.creatorId === userId || item.membershipState === 'owner');
        } else if (scope === 'friends') {
          filtered = filtered.filter((item) => item.friendMemberCount > 0);
        } else if (scope === 'new') {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter((item) => item.createdAtMs >= thirtyDaysAgo);
        }

        if (visibility === 'public') {
          filtered = filtered.filter((item) => !item.isPrivate);
        } else if (visibility === 'private') {
          filtered = filtered.filter((item) => item.isPrivate);
        }

        const seededPage: CommunityDirectoryPage = {
          items: filtered.slice(0, 20),
          communityOfTheWeek: filtered[0] ?? null,
          nextCursor: null,
          hasMore: false,
          totalCount: filtered.length,
        };
        useResourceStore.getState().setCommunityDirectory(queryKey, {
          data: seededPage,
          status: 'ready',
          source: 'memory',
          updatedAt: Date.now(),
          isStale: true,
          error: null,
        });
      });
    });
  }

  private async commit(userId: string, queryKey: string, data: CommunityDirectoryPage, source: ResourceState<CommunityDirectoryPage>['source']): Promise<void> {
    const updatedAt = Date.now();
    useResourceStore.getState().setCommunityDirectory(queryKey, { data, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(userId, DIRECTORY_NAMESPACE, queryKey, data, { expiresAt: updatedAt + DIRECTORY_RETENTION_MS });
  }

  private withState(current: ResourceState<CommunityDirectoryPage> | null | undefined, changes: Partial<ResourceState<CommunityDirectoryPage>>): ResourceState<CommunityDirectoryPage> {
    const base = current ?? emptyDirectoryResource();
    return { ...base, ...changes };
  }

  private withCategoryState(current: ResourceState<CommunityCategory[]> | null | undefined, changes: Partial<ResourceState<CommunityCategory[]>>): ResourceState<CommunityCategory[]> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }
}

export const communitiesResourceService = CommunitiesResourceService.getInstance();
