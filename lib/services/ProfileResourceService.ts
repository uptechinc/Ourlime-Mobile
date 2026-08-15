import { AuthService, type UserProfile } from './AuthService';
import { ProfileService, type PublicProfileResult } from './ProfileService';
import { RelationshipService } from './RelationshipService';
import { LocalCacheService, type CachedRecord } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { RequestTimeoutService } from './RequestTimeoutService';
import { PostService } from './PostService';
import { useResourceStore, type OwnProfileResource } from '@/lib/store/useResourceStore';
import type { ResourceState } from '@/lib/types/resourceState';

const PROFILE_NAMESPACE = 'profiles';
const OWN_STALE_MS = 5 * 60_000;
const PUBLIC_STALE_MS = 10 * 60_000;
const PROFILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type ProfileResourceIdentifier =
  | { kind: 'own'; userId: string }
  | { kind: 'public'; viewerId: string; username: string };

export class ProfileResourceService {
  private static instance: ProfileResourceService;
  private readonly authService = AuthService.getInstance();
  private readonly profileService = ProfileService.getInstance();
  private readonly relationshipService = RelationshipService.getInstance();
  private readonly postService = PostService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();

  private constructor() {}

  public static getInstance(): ProfileResourceService {
    if (!ProfileResourceService.instance) ProfileResourceService.instance = new ProfileResourceService();
    return ProfileResourceService.instance;
  }

  public getKey(identifier: ProfileResourceIdentifier): string {
    return identifier.kind === 'own' ? `own:${identifier.userId}` : `public:${identifier.username.replace(/^@/, '').toLowerCase()}`;
  }

  public async hydrate(identifier: ProfileResourceIdentifier): Promise<void> {
    const key = this.getKey(identifier);
    const existing = this.getResource(identifier);
    if (existing?.data) return;
    this.setResource(identifier, this.withState(existing, { status: 'hydrating', error: null }));
    const cacheUserId = identifier.kind === 'own' ? identifier.userId : identifier.viewerId;
    let cached: CachedRecord<OwnProfileResource | PublicProfileResult> | null;
    try {
      cached = await this.cacheService.read<OwnProfileResource | PublicProfileResult>(cacheUserId, PROFILE_NAMESPACE, key);
    } catch {
      this.setResource(identifier, this.withState(null, { status: 'idle', error: null }));
      return;
    }
    if (!cached) {
      this.setResource(identifier, this.withState(null, { status: 'idle' }));
      return;
    }
    const staleMs = identifier.kind === 'own' ? OWN_STALE_MS : PUBLIC_STALE_MS;
    this.setResource(identifier, { data: cached.data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired || Date.now() - cached.updatedAt >= staleMs, error: null });
  }

  public async refresh(identifier: ProfileResourceIdentifier, force = false): Promise<void> {
    const key = this.getKey(identifier);
    const existingRequest = this.inFlight.get(key);
    if (existingRequest) return existingRequest;
    const current = this.getResource(identifier);
    const staleMs = identifier.kind === 'own' ? OWN_STALE_MS : PUBLIC_STALE_MS;
    if (!force && current?.data && current.updatedAt && Date.now() - current.updatedAt < staleMs) return;
    const operation = this.performRefresh(identifier).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  public async patchOwnProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const identifier: ProfileResourceIdentifier = { kind: 'own', userId };
    const current = this.getResource(identifier) as ResourceState<OwnProfileResource> | undefined;
    if (!current?.data) return;
    await this.commit(identifier, { ...current.data, profile: { ...current.data.profile, ...updates } }, 'memory');
  }

  public async adjustOwnStats(userId: string, changes: Partial<Record<'posts' | 'friends' | 'followers' | 'following', number>>): Promise<void> {
    const identifier: ProfileResourceIdentifier = { kind: 'own', userId };
    const current = this.getResource(identifier) as ResourceState<OwnProfileResource> | undefined;
    if (!current?.data) return;
    const stats = { ...current.data.stats };
    for (const key of Object.keys(changes) as Array<keyof typeof stats>) stats[key] = Math.max(0, stats[key] + (changes[key] ?? 0));
    await this.commit(identifier, { ...current.data, stats }, 'memory');
  }

  private async performRefresh(identifier: ProfileResourceIdentifier): Promise<void> {
    // Guard: never attempt a Firestore fetch with a blank userId.
    if (identifier.kind === 'own' && !identifier.userId) return;
    const current = this.getResource(identifier);
    this.setResource(identifier, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    try {
      if (identifier.kind === 'own') {
        const profile = await this.timeoutService.run(
          this.authService.getUserProfile(identifier.userId),
          'Profile request',
        );
        if (!profile) throw new Error('Your profile record could not be found.');
        const initialStats = {
          posts: profile.postsCount ?? 0,
          friends: profile.friendsCount ?? 0,
          followers: profile.followersCount ?? 0,
          following: 0,
        };
        await this.commit(identifier, { profile, stats: initialStats }, 'network');

        try {
          const [networkStats, posts] = await Promise.all([
            this.timeoutService.run(
              this.relationshipService.getNetworkStats(identifier.userId),
              'Profile network statistics',
              5_000,
            ),
            this.timeoutService.run(
              this.postService.getAuthorPostCount(identifier.userId),
              'Profile post statistics',
              5_000,
            ).catch(() => initialStats.posts),
          ]);
          await this.commit(identifier, { profile, stats: { posts, ...networkStats } }, 'network');
        } catch {
          // The profile is already ready; network counts are optional enrichment.
        }
      } else {
        const publicProfile = await this.timeoutService.run(this.profileService.fetchPublicProfile(identifier.username), 'Public profile request');
        await this.commit(identifier, publicProfile, 'network');
      }
    } catch (error: unknown) {
      const latest = this.getResource(identifier);
      this.setResource(identifier, { ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'Profile could not be loaded.') });
    }
  }

  private async commit(identifier: ProfileResourceIdentifier, data: OwnProfileResource | PublicProfileResult, source: ResourceState<OwnProfileResource | PublicProfileResult>['source']): Promise<void> {
    const updatedAt = Date.now();
    const cacheUserId = identifier.kind === 'own' ? identifier.userId : identifier.viewerId;
    this.setResource(identifier, { data, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(cacheUserId, PROFILE_NAMESPACE, this.getKey(identifier), data, { expiresAt: updatedAt + (identifier.kind === 'own' ? OWN_STALE_MS : PUBLIC_STALE_MS) });
    if (identifier.kind === 'public') {
      const publicData = data as PublicProfileResult;
      const uidKey = `public:uid:${publicData.profile.uid}`;
      useResourceStore.getState().setPublicProfile(uidKey, { data: publicData, status: 'ready', source, updatedAt, isStale: false, error: null });
      await this.cacheService.write(cacheUserId, PROFILE_NAMESPACE, uidKey, publicData, { expiresAt: updatedAt + PUBLIC_STALE_MS });
    }
    await this.cacheService.prune({ userId: cacheUserId, namespace: PROFILE_NAMESPACE, maximumRecords: 100, maximumExpiredAgeMs: PROFILE_RETENTION_MS });
  }

  private getResource(identifier: ProfileResourceIdentifier): ResourceState<OwnProfileResource | PublicProfileResult> | undefined {
    const state = useResourceStore.getState();
    return identifier.kind === 'own' ? state.ownProfiles[identifier.userId] : state.publicProfiles[this.getKey(identifier)];
  }

  private setResource(identifier: ProfileResourceIdentifier, resource: ResourceState<OwnProfileResource | PublicProfileResult>): void {
    const state = useResourceStore.getState();
    if (identifier.kind === 'own') state.setOwnProfile(identifier.userId, resource as ResourceState<OwnProfileResource>);
    else state.setPublicProfile(this.getKey(identifier), resource as ResourceState<PublicProfileResult>);
  }

  private withState(current: ResourceState<OwnProfileResource | PublicProfileResult> | null | undefined, changes: Partial<ResourceState<OwnProfileResource | PublicProfileResult>>): ResourceState<OwnProfileResource | PublicProfileResult> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }
}

export const profileResourceService = ProfileResourceService.getInstance();
