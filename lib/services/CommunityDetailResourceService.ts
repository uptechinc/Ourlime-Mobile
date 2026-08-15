import type { Event } from '@/types/eventTypes';
import type { CommunityDetailResource, CommunityJoinRequest, CommunityMember, CommunityPage, CommunityPoll } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { CommunityService } from './CommunityService';
import { CommunityPollService, type CreateCommunityPollInput } from './CommunityPollService';
import { EventService } from './EventService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { CommunitiesResourceService } from './CommunitiesResourceService';

const DETAIL_NAMESPACE = 'community-details';
const MEMBERS_NAMESPACE = 'community-members';
const REQUESTS_NAMESPACE = 'community-requests';
const EVENTS_NAMESPACE = 'community-events';
const POLLS_NAMESPACE = 'community-polls';
const STALE_MS = 5 * 60 * 1000;
const RETENTION_MS = 48 * 60 * 60 * 1000;

type CommunityWorkspace = 'members' | 'requests' | 'events' | 'polls';

export class CommunityDetailResourceService {
  private static instance: CommunityDetailResourceService;
  private readonly communityService = CommunityService.getInstance();
  private readonly pollService = CommunityPollService.getInstance();
  private readonly eventService = EventService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly directoriesService = CommunitiesResourceService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): CommunityDetailResourceService {
    if (!CommunityDetailResourceService.instance) CommunityDetailResourceService.instance = new CommunityDetailResourceService();
    return CommunityDetailResourceService.instance;
  }

  public async hydrateDetail(userId: string, identifier: string): Promise<void> {
    const current = useResourceStore.getState().communityDetails[identifier];
    if (current?.data) return;
    useResourceStore.getState().setCommunityDetail(identifier, this.withState(current, { status: 'hydrating', error: null }));
    await this.hydrateValue(userId, DETAIL_NAMESPACE, identifier, (data: CommunityDetailResource, updatedAt, isExpired) => {
      useResourceStore.getState().setCommunityDetail(identifier, { data, status: 'ready', source: 'disk', updatedAt, isStale: isExpired || Date.now() - updatedAt >= STALE_MS, error: null });
    }, () => useResourceStore.getState().setCommunityDetail(identifier, this.withState(null, { status: 'idle' })), (error) => useResourceStore.getState().setCommunityDetail(identifier, { ...this.withState(null, { status: 'error' }), error }));
  }

  public async refreshDetail(userId: string, identifier: string, force = false): Promise<void> {
    const requestKey = `detail:${identifier}`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    const current = useResourceStore.getState().communityDetails[identifier];
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < STALE_MS) return;
    useResourceStore.getState().setCommunityDetail(identifier, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    const request = this.communityService.fetchCommunityDetail(identifier).then(async (data) => {
      const updatedAt = Date.now();
      useResourceStore.getState().setCommunityDetail(identifier, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await Promise.all([
        this.cacheService.write(userId, DETAIL_NAMESPACE, identifier, data, { expiresAt: updatedAt + RETENTION_MS }),
        this.directoriesService.patchCommunity(userId, data.community),
      ]);
    }).catch((error: unknown) => {
      const latest = useResourceStore.getState().communityDetails[identifier];
      useResourceStore.getState().setCommunityDetail(identifier, { ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'Community could not be loaded.') });
    }).finally(() => this.inFlight.delete(requestKey));
    this.inFlight.set(requestKey, request);
    return request;
  }

  public async loadWorkspace(userId: string, communityId: string, workspace: CommunityWorkspace, force = false): Promise<void> {
    const requestKey = `${workspace}:${communityId}`;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;
    const current = this.getWorkspaceResource(communityId, workspace);
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < STALE_MS) return;
    if (!current?.data) await this.hydrateWorkspace(userId, communityId, workspace);
    const hydrated = this.getWorkspaceResource(communityId, workspace);
    this.setWorkspaceResource(communityId, workspace, { ...this.baseWorkspaceState(hydrated), status: hydrated?.data ? 'refreshing' : 'hydrating', error: null });
    const request = this.fetchWorkspace(communityId, workspace).then(async (data) => {
      const updatedAt = Date.now();
      this.setWorkspaceResource(communityId, workspace, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await this.cacheService.write(userId, this.namespaceFor(workspace), communityId, data, { expiresAt: updatedAt + RETENTION_MS });
    }).catch((error: unknown) => {
      const latest = this.getWorkspaceResource(communityId, workspace);
      this.setWorkspaceResource(communityId, workspace, { ...this.baseWorkspaceState(latest), status: latest?.data ? 'ready' : 'error', isStale: true, error: this.errorService.normalize(error, `Community ${workspace} could not be loaded.`) });
    }).finally(() => this.inFlight.delete(requestKey));
    this.inFlight.set(requestKey, request);
    return request;
  }

  public async createPoll(userId: string, input: CreateCommunityPollInput): Promise<void> {
    await this.pollService.createPoll(input);
    await this.loadWorkspace(userId, input.communityId, 'polls', true);
  }

  public async loadMoreMembers(userId: string, communityId: string): Promise<void> {
    const current = useResourceStore.getState().communityMembers[communityId];
    if (!current?.data?.hasMore || !current.data.nextCursor || current.status === 'refreshing') return;
    useResourceStore.getState().setCommunityMembers(communityId, { ...current, status: 'refreshing', error: null });
    try {
      const page = await this.communityService.fetchMembers(communityId, current.data.nextCursor);
      const existingIds = new Set(current.data.items.map((member) => member.userId));
      const data: CommunityPage<CommunityMember> = { ...page, items: [...current.data.items, ...page.items.filter((member) => !existingIds.has(member.userId))] };
      const updatedAt = Date.now();
      useResourceStore.getState().setCommunityMembers(communityId, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      await this.cacheService.write(userId, MEMBERS_NAMESPACE, communityId, data, { expiresAt: updatedAt + RETENTION_MS });
    } catch (error: unknown) {
      useResourceStore.getState().setCommunityMembers(communityId, { ...current, status: 'ready', isStale: true, error: this.errorService.normalize(error, 'More community members could not be loaded.') });
    }
  }

  public async searchMembers(userId: string, communityId: string, search: string): Promise<void> {
    const current = useResourceStore.getState().communityMembers[communityId];
    useResourceStore.getState().setCommunityMembers(communityId, { ...this.baseMemberState(current), status: current?.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const data = await this.communityService.fetchMembers(communityId, null, search.trim());
      const updatedAt = Date.now();
      useResourceStore.getState().setCommunityMembers(communityId, { data, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
      if (!search.trim()) await this.cacheService.write(userId, MEMBERS_NAMESPACE, communityId, data, { expiresAt: updatedAt + RETENTION_MS });
    } catch (error: unknown) {
      useResourceStore.getState().setCommunityMembers(communityId, { ...this.baseMemberState(current), status: current?.data ? 'ready' : 'error', error: this.errorService.normalize(error, 'Community member search failed.') });
    }
  }

  public async votePoll(userId: string, communityId: string, pollId: string, optionIndex: number): Promise<void> {
    await this.pollService.vote(communityId, pollId, optionIndex);
    await this.loadWorkspace(userId, communityId, 'polls', true);
  }

  public async deletePoll(userId: string, communityId: string, pollId: string): Promise<void> {
    await this.pollService.deletePoll(communityId, pollId);
    await this.loadWorkspace(userId, communityId, 'polls', true);
  }

  private async hydrateWorkspace(userId: string, communityId: string, workspace: CommunityWorkspace): Promise<void> {
    const current = this.getWorkspaceResource(communityId, workspace);
    if (current?.data) return;
    this.setWorkspaceResource(communityId, workspace, { ...this.baseWorkspaceState(current), status: 'hydrating', error: null });
    await this.hydrateValue<Event[] | CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | CommunityPoll[]>(userId, this.namespaceFor(workspace), communityId, (data, updatedAt, isExpired) => this.setWorkspaceResource(communityId, workspace, { data, status: 'ready', source: 'disk', updatedAt, isStale: isExpired || Date.now() - updatedAt >= STALE_MS, error: null }), () => this.setWorkspaceResource(communityId, workspace, { ...this.baseWorkspaceState(null), status: 'idle' }), (error) => this.setWorkspaceResource(communityId, workspace, { ...this.baseWorkspaceState(null), status: 'error', error }));
  }

  private async hydrateValue<TData>(userId: string, namespace: string, key: string, onHit: (data: TData, updatedAt: number, isExpired: boolean) => void, onMiss: () => void, onError: (error: ReturnType<ResourceErrorService['normalize']>) => void): Promise<void> {
    try {
      const cached = await this.cacheService.read<TData>(userId, namespace, key);
      if (!cached) onMiss();
      else onHit(cached.data, cached.updatedAt, cached.isExpired);
    } catch (error: unknown) {
      onError(this.errorService.normalize(error, 'Cached community data could not be loaded.'));
    }
  }

  private async fetchWorkspace(communityId: string, workspace: CommunityWorkspace): Promise<CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | Event[] | CommunityPoll[]> {
    if (workspace === 'members') return this.communityService.fetchMembers(communityId);
    if (workspace === 'requests') return this.communityService.fetchJoinRequests(communityId);
    if (workspace === 'events') return this.eventService.fetchCommunityEvents(communityId);
    return (await this.pollService.fetchPolls(communityId)).items;
  }

  private getWorkspaceResource(communityId: string, workspace: CommunityWorkspace): ResourceState<CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | Event[] | CommunityPoll[]> | undefined {
    const state = useResourceStore.getState();
    if (workspace === 'members') return state.communityMembers[communityId];
    if (workspace === 'requests') return state.communityRequests[communityId];
    if (workspace === 'events') return state.communityEvents[communityId];
    return state.communityPolls[communityId];
  }

  private setWorkspaceResource(communityId: string, workspace: CommunityWorkspace, resource: ResourceState<CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | Event[] | CommunityPoll[]>): void {
    const state = useResourceStore.getState();
    if (workspace === 'members') state.setCommunityMembers(communityId, resource as ResourceState<CommunityPage<CommunityMember>>);
    else if (workspace === 'requests') state.setCommunityRequests(communityId, resource as ResourceState<CommunityPage<CommunityJoinRequest>>);
    else if (workspace === 'events') state.setCommunityEvents(communityId, resource as ResourceState<Event[]>);
    else state.setCommunityPolls(communityId, resource as ResourceState<CommunityPoll[]>);
  }

  private namespaceFor(workspace: CommunityWorkspace): string {
    if (workspace === 'members') return MEMBERS_NAMESPACE;
    if (workspace === 'requests') return REQUESTS_NAMESPACE;
    if (workspace === 'events') return EVENTS_NAMESPACE;
    return POLLS_NAMESPACE;
  }

  private baseWorkspaceState(current: ResourceState<CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | Event[] | CommunityPoll[]> | null | undefined): ResourceState<CommunityPage<CommunityMember> | CommunityPage<CommunityJoinRequest> | Event[] | CommunityPoll[]> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null };
  }

  private withState(current: ResourceState<CommunityDetailResource> | null | undefined, changes: Partial<ResourceState<CommunityDetailResource>>): ResourceState<CommunityDetailResource> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }

  private baseMemberState(current: ResourceState<CommunityPage<CommunityMember>> | undefined): ResourceState<CommunityPage<CommunityMember>> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null };
  }
}

export const communityDetailResourceService = CommunityDetailResourceService.getInstance();
