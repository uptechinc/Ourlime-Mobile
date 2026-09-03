import { ApiService } from './ApiService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { RelationshipHubPage, RelationshipRequestDirection } from '@/lib/types/relationshipHub';

const NAMESPACE = 'relationship-requests';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class RelationshipRequestResourceService {
  private static instance: RelationshipRequestResourceService;
  private readonly api = ApiService.getInstance();
  private readonly cache = LocalCacheService.getInstance();
  private readonly errors = ResourceErrorService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}
  public static getInstance(): RelationshipRequestResourceService {
    if (!RelationshipRequestResourceService.instance) RelationshipRequestResourceService.instance = new RelationshipRequestResourceService();
    return RelationshipRequestResourceService.instance;
  }

  public key(userId: string, direction: RelationshipRequestDirection, search: string): string {
    return `${userId}:${direction}:${search.trim().toLowerCase()}`;
  }

  public async hydrate(userId: string, direction: RelationshipRequestDirection, search: string): Promise<void> {
    const key = this.key(userId, direction, search);
    const current = useResourceStore.getState().relationshipRequests[key];
    if (current?.data) return;
    useResourceStore.getState().setRelationshipRequests(key, { ...(current ?? createIdleResource()), status: 'hydrating', error: null });
    const cached = await this.cache.read<RelationshipHubPage>(userId, NAMESPACE, key);
    useResourceStore.getState().setRelationshipRequests(key, cached ? { data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: true, error: null } : createIdleResource());
  }

  public async refresh(userId: string, direction: RelationshipRequestDirection, search: string, force = false): Promise<void> {
    const key = this.key(userId, direction, search);
    const requestKey = `${key}:refresh`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    const current = useResourceStore.getState().relationshipRequests[key];
    if (!force && current?.updatedAt && Date.now() - current.updatedAt < 60_000) return;
    const request = (async () => {
      try {
        return await this.fetch(userId, direction, search, null, false);
      } finally {
        this.inFlight.delete(requestKey);
      }
    })();
    this.inFlight.set(requestKey, request);
    return request;
  }

  public async loadMore(userId: string, direction: RelationshipRequestDirection, search: string): Promise<void> {
    const key = this.key(userId, direction, search);
    const current = useResourceStore.getState().relationshipRequests[key];
    if (!current?.data?.hasMore || !current.data.nextCursor) return;
    const requestKey = `${key}:more`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    const request = (async () => {
      try {
        return await this.fetch(userId, direction, search, current.data!.nextCursor, true);
      } finally {
        this.inFlight.delete(requestKey);
      }
    })();
    this.inFlight.set(requestKey, request);
    return request;
  }

  public invalidate(): void {
    const store = useResourceStore.getState();
    Object.entries(store.relationshipRequests).forEach(([key, resource]) => store.setRelationshipRequests(key, { ...resource, isStale: true }));
  }

  public removeUserFromCachedRequests(userId: string): void {
    const store = useResourceStore.getState();
    Object.entries(store.relationshipRequests).forEach(([key, resource]) => {
      if (!resource.data) return;
      store.setRelationshipRequests(key, { ...resource, data: { ...resource.data, items: resource.data.items.filter((item) => item.id !== userId) }, source: 'memory', updatedAt: Date.now(), isStale: true });
    });
  }

  private async fetch(userId: string, direction: RelationshipRequestDirection, search: string, cursor: string | null, append: boolean): Promise<void> {
    const key = this.key(userId, direction, search);
    const current = useResourceStore.getState().relationshipRequests[key] ?? createIdleResource<RelationshipHubPage>();
    useResourceStore.getState().setRelationshipRequests(key, { ...current, status: current.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const parameters = new URLSearchParams({ ownerId: userId, section: 'requests', direction, limit: '30' });
      if (search.trim()) parameters.set('search', search.trim());
      if (cursor) parameters.set('cursor', cursor);
      const response = await this.api.request<{ success: boolean; data?: RelationshipHubPage; error?: string }>(`/api/relationships/hub?${parameters.toString()}`, { authenticated: true });
      if (!response.success || !response.data) throw new Error(response.error ?? 'Requests are unavailable.');
      const data = append && current.data ? { ...response.data, items: Array.from(new Map([...current.data.items, ...response.data.items].map((item) => [item.id, item])).values()) } : response.data;
      const updatedAt = Date.now();
      useResourceStore.getState().setRelationshipRequests(key, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await this.cache.write(userId, NAMESPACE, key, data, { expiresAt: updatedAt + RETENTION_MS });
    } catch (error: unknown) {
      useResourceStore.getState().setRelationshipRequests(key, { ...current, status: current.data ? 'ready' : 'error', isStale: true, error: this.errors.normalize(error, 'Requests are unavailable.') });
    }
  }
}

export const relationshipRequestResourceService = RelationshipRequestResourceService.getInstance();
