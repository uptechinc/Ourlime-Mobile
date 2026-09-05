import { CommunityService } from './CommunityService';
import { EventService } from './EventService';
import { JobsService } from '@/lib/job/JobsService';
import { RelationshipService } from './RelationshipService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import type { DiscoverResourceData, DiscoverSectionStatus } from '@/lib/types/discoverResources';
import type { ResourceState } from '@/lib/types/resourceState';

const DISCOVER_NAMESPACE = 'discover';
const DISCOVER_KEY = 'overview';
const DISCOVER_STALE_MS = 5 * 60 * 1000;
const DISCOVER_RETENTION_MS = 24 * 60 * 60 * 1000;

const EMPTY_STATUS: DiscoverResourceData['sectionStatus'] = {
  people: 'idle',
  communities: 'idle',
  events: 'idle',
  jobs: 'idle',
};

export class DiscoverResourceService {
  private static instance: DiscoverResourceService;
  private readonly communityService = CommunityService.getInstance();
  private readonly eventService = EventService.getInstance();
  private readonly jobsService = JobsService.getInstance();
  private readonly relationshipService = RelationshipService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private inFlight: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DiscoverResourceService {
    if (!DiscoverResourceService.instance) DiscoverResourceService.instance = new DiscoverResourceService();
    return DiscoverResourceService.instance;
  }

  public async hydrate(userId: string): Promise<void> {
    const current = useResourceStore.getState().discover;
    if (current.data) return;
    useResourceStore.getState().setDiscover(this.withState(current, { status: 'hydrating', error: null }));
    try {
      const cached = await this.cacheService.read<DiscoverResourceData>(userId, DISCOVER_NAMESPACE, DISCOVER_KEY);
      if (!cached) {
        useResourceStore.getState().setDiscover(this.withState(null, { status: 'idle' }));
        return;
      }
      useResourceStore.getState().setDiscover({
        data: { ...cached.data, sectionStatus: { ...EMPTY_STATUS, ...cached.data.sectionStatus } },
        status: 'ready',
        source: 'disk',
        updatedAt: cached.updatedAt,
        isStale: cached.isExpired || Date.now() - cached.updatedAt >= DISCOVER_STALE_MS,
        error: null,
      });
      await this.cacheService.touch(userId, DISCOVER_NAMESPACE, DISCOVER_KEY);
    } catch (error: unknown) {
      useResourceStore.getState().setDiscover({ ...this.withState(null, { status: 'error' }), error: this.errorService.normalize(error, 'Discover cache could not be loaded.') });
    }
  }

  public async refresh(userId: string, force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const current = useResourceStore.getState().discover;
    if (!force && current.data && current.updatedAt && Date.now() - current.updatedAt < DISCOVER_STALE_MS) return;
    this.inFlight = (async () => {
      try {
        await this.performRefresh(userId);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  public async removeSuggestion(userId: string, suggestedUserId: string): Promise<void> {
    const current = useResourceStore.getState().discover;
    if (!current.data) return;
    await this.commit(userId, {
      ...current.data,
      suggestedPeople: current.data.suggestedPeople.filter((person) => person.id !== suggestedUserId),
    }, current.source);
  }

  public async patchCommunity(userId: string, communityId: string, updates: { membershipCount?: number; isMember?: boolean }): Promise<void> {
    const current = useResourceStore.getState().discover;
    if (!current.data) return;
    await this.commit(userId, {
      ...current.data,
      communities: current.data.communities.map((community) => community.id === communityId ? {
        ...community,
        membershipCount: updates.membershipCount ?? community.membershipCount,
      } : community),
    }, current.source);
  }

  public async removeCommunity(userId: string, communityId: string): Promise<void> {
    const current = useResourceStore.getState().discover;
    if (!current.data || !current.data.communities.some((community) => community.id === communityId)) return;
    await this.commit(userId, {
      ...current.data,
      communities: current.data.communities.filter((community) => community.id !== communityId),
    }, 'memory');
  }

  private async performRefresh(userId: string): Promise<void> {
    const current = useResourceStore.getState().discover;
    const base: DiscoverResourceData = current.data ?? {
      suggestedPeople: [], communities: [], events: [], jobs: [], sectionStatus: EMPTY_STATUS,
    };
    useResourceStore.getState().setDiscover(this.withState(current, {
      status: current.data ? 'refreshing' : 'hydrating',
      error: null,
      data: { ...base, sectionStatus: { people: 'loading', communities: 'loading', events: 'loading', jobs: 'loading' } },
    }));

    const peoplePromise = this.settleSection('people', () => this.relationshipService.getSuggestions(12).then((suggestedPeople) => ({ suggestedPeople })));
    const communitiesPromise = this.settleSection('communities', () => this.communityService.fetchCommunities(40).then((records) => ({ communities: records.map((community) => ({ id: community.id, title: community.title, membershipCount: community.memberCount, imageUrl: community.imageUrl })) })));
    const eventsPromise = this.settleSection('events', () => this.eventService.fetchEvents().then((records) => ({ events: records.map((event, index) => ({
      id: event.id || `event-${index}`,
      title: event.title,
      date: new Date(event.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      location: event.location,
      image: event.image || event.media?.find((media) => media.type === 'image')?.url || null,
    })) })));
    const jobsPromise = this.settleSection('jobs', () => this.jobsService.fetchJobs(12).then((records) => ({ jobs: records.map((job) => ({
      id: job.id,
      role: job.basic_info.title,
      company: job.creator?.name || 'Ourlime member',
      type: job.basic_info.type,
      salary: `$${job.basic_info.priceRange.from.toLocaleString()} - $${job.basic_info.priceRange.to.toLocaleString()}`,
      image: job.creator?.profileImage || null,
    })) })));

    const [people, communities, events, jobs] = await Promise.all([peoplePromise, communitiesPromise, eventsPromise, jobsPromise]);
    const next: DiscoverResourceData = {
      suggestedPeople: people.status === 'fulfilled' ? people.value.suggestedPeople : base.suggestedPeople,
      communities: communities.status === 'fulfilled' ? communities.value.communities : base.communities,
      events: events.status === 'fulfilled' ? events.value.events : base.events,
      jobs: jobs.status === 'fulfilled' ? jobs.value.jobs : base.jobs,
      sectionStatus: {
        people: this.sectionStatus(people.status, base.suggestedPeople.length),
        communities: this.sectionStatus(communities.status, base.communities.length),
        events: this.sectionStatus(events.status, base.events.length),
        jobs: this.sectionStatus(jobs.status, base.jobs.length),
      },
    };
    const failed = [people, communities, events, jobs].filter((result) => result.status === 'rejected');
    if (failed.length === 4 && !current.data) {
      const reason = failed[0].status === 'rejected' ? failed[0].reason : new Error('Discover is unavailable.');
      useResourceStore.getState().setDiscover({ ...this.withState(null, { status: 'error' }), error: this.errorService.normalize(reason, 'Discover is unavailable.') });
      return;
    }
    await this.commit(userId, next, 'network');
  }

  private sectionStatus(result: PromiseSettledResult<unknown>['status'], cachedCount: number): DiscoverSectionStatus {
    return result === 'fulfilled' || cachedCount > 0 ? 'ready' : 'error';
  }

  private async settleSection<T>(section: keyof DiscoverResourceData['sectionStatus'], load: () => Promise<T>): Promise<PromiseSettledResult<T>> {
    try {
      return { status: 'fulfilled', value: await load() };
    } catch (reason: unknown) {
      // Catch synchronous native/method failures too; never leave every section
      // loading because one source failed before returning its promise.
      this.logger.error('DiscoverResourceService', 'section', reason, { section });
      return { status: 'rejected', reason };
    }
  }

  private async commit(userId: string, data: DiscoverResourceData, source: ResourceState<DiscoverResourceData>['source']): Promise<void> {
    const updatedAt = Date.now();
    useResourceStore.getState().setDiscover({ data, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(userId, DISCOVER_NAMESPACE, DISCOVER_KEY, data, { expiresAt: updatedAt + DISCOVER_RETENTION_MS });
  }

  private withState(current: ResourceState<DiscoverResourceData> | null | undefined, changes: Partial<ResourceState<DiscoverResourceData>>): ResourceState<DiscoverResourceData> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }
}

export const discoverResourceService = DiscoverResourceService.getInstance();
