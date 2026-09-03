import { ApiService } from './ApiService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';
import type { RelationshipHubPage, RelationshipHubSection } from '@/lib/types/relationshipHub';

const NAMESPACE = 'relationship-hub';
const STALE_MS = 60_000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class RelationshipResourceService {
  private static instance: RelationshipResourceService;
  private readonly api = ApiService.getInstance();
  private readonly cache = LocalCacheService.getInstance();
  private readonly errors = ResourceErrorService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}
  public static getInstance(): RelationshipResourceService {
    if (!RelationshipResourceService.instance) RelationshipResourceService.instance = new RelationshipResourceService();
    return RelationshipResourceService.instance;
  }

  public async hydrate(userId: string, section: RelationshipHubSection): Promise<void> {
    const current = useResourceStore.getState().relationshipHub[section];
    if (current?.data) return;
    useResourceStore.getState().setRelationshipHub(section, { ...(current ?? createIdleResource()), status: 'hydrating', error: null });
    try {
      const cached = await this.cache.read<RelationshipHubPage>(userId, NAMESPACE, section);
      useResourceStore.getState().setRelationshipHub(section, cached ? {
        data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt,
        isStale: cached.isExpired || Date.now() - cached.updatedAt >= STALE_MS, error: null,
      } : createIdleResource());
    } catch (error: unknown) {
      useResourceStore.getState().setRelationshipHub(section, { ...(current ?? createIdleResource()), status: 'error', error: this.errors.normalize(error, 'Relationships could not be restored.') });
    }
  }

  public async refresh(userId: string, section: RelationshipHubSection, force = false): Promise<void> {
    const key = `${userId}:${section}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const current = useResourceStore.getState().relationshipHub[section];
    if (!force && current?.updatedAt && Date.now() - current.updatedAt < STALE_MS) return;
    const request = (async () => {
      try {
        await this.performRefresh(userId, section);
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, request);
    return request;
  }

  public invalidateAll(): void {
    const store = useResourceStore.getState();
    (Object.keys(store.relationshipHub) as RelationshipHubSection[]).forEach((section) => {
      const current = store.relationshipHub[section];
      if (current) store.setRelationshipHub(section, { ...current, isStale: true });
    });
  }

  public removeUserFromCachedRelationships(userId: string, targetUserId: string): void {
    const store = useResourceStore.getState();
    (Object.keys(store.relationshipHub) as RelationshipHubSection[]).forEach((section) => {
      const current = store.relationshipHub[section];
      if (current?.data) {
        const filteredItems = current.data.items.filter((item) => item.id !== targetUserId);
        const updatedData: RelationshipHubPage = {
          ...current.data,
          items: filteredItems,
        };
        store.setRelationshipHub(section, { ...current, data: updatedData, source: 'memory', updatedAt: Date.now() });
        void this.cache.write(userId, NAMESPACE, section, updatedData, { expiresAt: Date.now() + RETENTION_MS });
      }
    });
  }

  public async loadMore(userId: string, section: RelationshipHubSection): Promise<void> {
    const current = useResourceStore.getState().relationshipHub[section];
    if (!current?.data?.hasMore || !current.data.nextCursor) return;
    const key = `${userId}:${section}:more`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const request = (async () => {
      try {
        const response = await this.api.request<{ success: boolean; data?: RelationshipHubPage; error?: string }>(
          `/api/relationships/hub?ownerId=${encodeURIComponent(userId)}&section=${section}&limit=30&cursor=${encodeURIComponent(current.data!.nextCursor!)}`,
          { authenticated: true },
        );
        if (!response.success || !response.data) throw new Error(response.error || 'More relationships are unavailable');
        const items = Array.from(new Map([...current.data!.items, ...response.data.items].map((item) => [item.id, item])).values());
        const data = { ...response.data, items };
        useResourceStore.getState().setRelationshipHub(section, { ...current, data, status: 'ready', source: 'network', updatedAt: Date.now(), error: null });
        await this.cache.write(userId, NAMESPACE, section, data, { expiresAt: Date.now() + RETENTION_MS });
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, request);
    return request;
  }

  private async performRefresh(userId: string, section: RelationshipHubSection): Promise<void> {
    const current = useResourceStore.getState().relationshipHub[section] ?? createIdleResource<RelationshipHubPage>();
    useResourceStore.getState().setRelationshipHub(section, { ...current, status: current.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const response = await this.api.request<{ success: boolean; data?: RelationshipHubPage; error?: string }>(
        `/api/relationships/hub?ownerId=${encodeURIComponent(userId)}&section=${section}&limit=30`,
        { authenticated: true },
      );
      if (!response.success || !response.data) throw new Error(response.error || 'Relationships unavailable');
      const updatedAt = Date.now();
      useResourceStore.getState().setRelationshipHub(section, { data: response.data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await this.cache.write(userId, NAMESPACE, section, response.data, { expiresAt: updatedAt + RETENTION_MS });
    } catch (error: unknown) {
      useResourceStore.getState().setRelationshipHub(section, { ...current, status: current.data ? 'ready' : 'error', isStale: true, error: this.errors.normalize(error, 'Relationships are unavailable.') });
    }
  }
}

export const relationshipResourceService = RelationshipResourceService.getInstance();
