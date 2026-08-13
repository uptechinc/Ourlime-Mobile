import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { ApiService, ApiServiceError } from './ApiService';
import { RequestTimeoutService } from './RequestTimeoutService';

export type CommunitySummary = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  membershipCount: number;
  isPrivate: boolean;
  categoryId: string | null;
  creatorId: string | null;
  creatorName: string;
  isMember: boolean;
  requestStatus: 'none' | 'pending' | 'approved' | 'declined';
  postCount: number;
  membershipLikes: number;
  createdAt: string | null;
  createdAtMs: number;
  hasAccess: boolean;
  isOwner: boolean;
  isBanned: boolean;
  postingPermission: 'members' | 'admins' | 'owner';
};

export type CommunityCategory = { id: string; name: string; type: string };

type JoinedByFriendsResponse = {
  success: boolean;
  data?: { communityIds?: string[] };
  error?: string;
};

export type CreateCommunityInput = {
  title: string;
  description: string;
  isPrivate: boolean;
  categoryId?: string;
};

type CommunitySource = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  coverImage?: unknown;
  bannerImageUrl?: unknown;
  membershipCount?: unknown;
  memberCount?: unknown;
  membersCount?: unknown;
  isPrivate?: unknown;
  privacy?: unknown;
  categoryId?: unknown;
  userId?: unknown;
  creatorName?: unknown;
  isMember?: unknown;
  requestStatus?: unknown;
  postCount?: unknown;
  membershipLikes?: unknown;
  createdAt?: unknown;
  hasAccess?: unknown;
  isOwner?: unknown;
  isBanned?: unknown;
  postingPermission?: unknown;
};

const readString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const readDateMs = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

export class CommunityService {
  private static instance: CommunityService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly apiService = ApiService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();

  private constructor() {}

  public static getInstance(): CommunityService {
    if (!CommunityService.instance) CommunityService.instance = new CommunityService();
    return CommunityService.instance;
  }

  public getCurrentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  public async fetchCommunities(maxResults = 40): Promise<CommunitySummary[]> {
    this.logger.info('CommunityService', 'fetchCommunities:start', { maxResults });
    try {
      const snapshot = await this.timeoutService.run(
        getDocs(query(collection(db, 'communityVariant'), limit(maxResults))),
        'Communities request',
      );
      const viewerId = auth.currentUser?.uid;
      const baseCommunities = snapshot.docs.map((document) => this.normalizeCommunity(document.id, document.data()));
      const ids = baseCommunities.map((community) => community.id);
      const [memberships, requests, counts] = await this.timeoutService.run(Promise.all([
        viewerId ? getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId), where('isMember', '==', true))) : null,
        viewerId ? getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId))) : null,
        Promise.all(ids.map((id) => getDoc(doc(db, 'communityVariantMembershipAndLikeCount', id)))),
      ]), 'Community membership request');
      const joinedIds = new Set(memberships?.docs.map((entry) => readString(entry.data().communityVariantId)) ?? []);
      const requestStatuses = new Map<string, CommunitySummary['requestStatus']>();
      requests?.docs.forEach((entry) => {
        const communityId = readString(entry.data().communityVariantId);
        const status = readString(entry.data().status);
        if (communityId && (status === 'pending' || status === 'approved' || status === 'declined')) requestStatuses.set(communityId, status);
      });
      const communities = baseCommunities.map((community, index) => {
        const countRecord = counts[index].exists() ? counts[index].data() : {};
        return {
          ...community,
          membershipCount: readNumber(countRecord.membershipCount) || community.membershipCount,
          membershipLikes: readNumber(countRecord.membershipLikes),
          isMember: joinedIds.has(community.id) || community.creatorId === viewerId,
          requestStatus: requestStatuses.get(community.id) ?? 'none',
        };
      });
      this.logger.success('CommunityService', 'fetchCommunities', { resultCount: communities.length });
      return communities;
    } catch (error: unknown) {
      this.logger.error('CommunityService', 'fetchCommunities', error);
      throw error;
    }
  }

  public async fetchCommunity(id: string): Promise<CommunitySummary> {
    this.logger.info('CommunityService', 'fetchCommunity:start', { id });
    try {
      return await this.fetchCommunityFromApi(id);
    } catch (error: unknown) {
      const canUseFirestore = error instanceof ApiServiceError
        ? error.code === 'REQUEST_TIMEOUT' || error.status >= 500
        : error instanceof TypeError;
      if (!canUseFirestore) throw error;
      this.logger.warn('CommunityService', 'fetchCommunity:firestore-fallback', {
        id,
        reason: error instanceof Error ? error.message : 'Network unavailable',
      });
      return this.fetchCommunityFromFirestore(id);
    }
  }

  private async fetchCommunityFromApi(id: string): Promise<CommunitySummary> {
    const response = await this.apiService.request<{ data?: unknown; resolvedId?: string; access?: { hasAccess?: boolean; isOwner?: boolean; isBanned?: boolean }; error?: string }>(
      `/api/communities/fetch?type=community&id=${encodeURIComponent(id)}`,
      { authenticated: Boolean(auth.currentUser) },
    );
    if (!response.data) throw new Error(response.error || 'Community not found');
    const base = this.normalizeCommunity(response.resolvedId || id, response.data);
    const viewerId = auth.currentUser?.uid;
    const membership = viewerId ? await getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId), where('communityVariantId', '==', base.id), where('isMember', '==', true))) : null;
    const requests = viewerId ? await getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId), where('communityVariantId', '==', base.id))) : null;
    const requestValue = requests?.docs[0]?.data().status;
    const community = {
      ...base,
      hasAccess: response.access?.hasAccess !== false,
      isOwner: response.access?.isOwner === true,
      isBanned: response.access?.isBanned === true,
      isMember: Boolean(membership && !membership.empty) || response.access?.isOwner === true,
      requestStatus: requestValue === 'pending' || requestValue === 'approved' || requestValue === 'declined' ? requestValue : 'none',
    };
    this.logger.success('CommunityService', 'fetchCommunity', { id });
    return community;
  }

  private async fetchCommunityFromFirestore(identifier: string): Promise<CommunitySummary> {
    const directSnapshot = await getDoc(doc(db, 'communityVariant', identifier));
    const slugSnapshot = directSnapshot.exists()
      ? null
      : await getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', identifier), limit(1)));
    const communityDocument = directSnapshot.exists() ? directSnapshot : slugSnapshot?.docs[0];
    if (!communityDocument?.exists()) throw new Error('Community not found');

    const viewerId = auth.currentUser?.uid;
    const resolvedId = communityDocument.id;
    const base = this.normalizeCommunity(resolvedId, communityDocument.data());
    const [memberships, requests, countSnapshot] = await Promise.all([
      viewerId ? getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId), where('communityVariantId', '==', resolvedId), limit(1))) : null,
      viewerId ? getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId), where('communityVariantId', '==', resolvedId), limit(1))) : null,
      getDoc(doc(db, 'communityVariantMembershipAndLikeCount', resolvedId)),
    ]);
    const membership = memberships?.docs[0]?.data();
    const requestStatus = readString(requests?.docs[0]?.data().status);
    const isOwner = Boolean(viewerId && base.creatorId === viewerId);
    const isMember = isOwner || membership?.isMember === true;
    const isBanned = membership?.isBanned === true || membership?.status === 'banned';
    const count = countSnapshot.data();
    const community: CommunitySummary = {
      ...base,
      membershipCount: readNumber(count?.membershipCount) || base.membershipCount,
      membershipLikes: readNumber(count?.membershipLikes) || base.membershipLikes,
      isOwner,
      isMember,
      isBanned,
      hasAccess: !isBanned && (!base.isPrivate || isMember),
      requestStatus: requestStatus === 'pending' || requestStatus === 'approved' || requestStatus === 'declined' ? requestStatus : 'none',
    };
    this.logger.success('CommunityService', 'fetchCommunity:firestore', { id: resolvedId, hasAccess: community.hasAccess });
    return community;
  }

  public async fetchJoinedByFriendsIds(): Promise<Set<string>> {
    if (!auth.currentUser) return new Set();
    const response = await this.apiService.request<JoinedByFriendsResponse>('/api/communities/joined-by-friends', { authenticated: true });
    if (!response.success) throw new Error(response.error || 'Communities joined by friends could not be loaded.');
    return new Set((response.data?.communityIds ?? []).filter((communityId): communityId is string => typeof communityId === 'string'));
  }

  public async fetchCategories(): Promise<CommunityCategory[]> {
    const snapshot = await getDocs(collection(db, 'communityCategories'));
    return snapshot.docs.flatMap((document): CommunityCategory[] => {
      const value = document.data();
      const name = readString(value.name) || readString(value.type) || readString(value.categoryName);
      if (!name) return [];
      return [{ id: document.id, name, type: readString(value.type) || name }];
    }).sort((first, second) => first.name.localeCompare(second.name));
  }

  public async joinOrRequestAccess(community: CommunitySummary): Promise<'joined' | 'requested'> {
    if (!auth.currentUser) throw new Error('Sign in to join a community');
    const action = community.isPrivate ? 'request' : 'join';
    const response = await this.apiService.request<{ success: boolean; result?: 'joined' | 'requested'; error?: string }>('/api/communities/membership', { method: 'POST', authenticated: true, body: { communityId: community.id, action } });
    if (!response.success || !response.result) throw new Error(response.error || 'Community membership could not be updated.');
    return response.result;
  }

  public async leaveCommunity(communityId: string): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>('/api/communities/membership', { method: 'POST', authenticated: true, body: { communityId, action: 'leave' } });
    if (!response.success) throw new Error(response.error || 'You could not leave this community.');
  }

  public async createCommunity(input: CreateCommunityInput): Promise<CommunitySummary> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to create a community');
    const title = input.title.trim();
    if (title.length < 3) throw new Error('Community name must have at least 3 characters');
    const communityRef = doc(collection(db, 'communityVariant'));
    const membershipRef = doc(collection(db, 'communityVariantMembership'));
    const batch = writeBatch(db);
    batch.set(communityRef, {
      title,
      description: input.description.trim(),
      isPrivate: input.isPrivate,
      categoryId: input.categoryId?.trim() || null,
      userId,
      postingPermission: 'members',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(membershipRef, { userId, communityVariantId: communityRef.id, isMember: true, role: 'admin', isAdmin: true, from: serverTimestamp(), to: null });
    batch.set(doc(db, 'communityVariantMembershipAndLikeCount', communityRef.id), { communityVariantId: communityRef.id, membershipCount: 1, membershipLikes: 0 });
    await batch.commit();
    return this.normalizeCommunity(communityRef.id, { ...input, title, userId, membershipCount: 1 });
  }

  private normalizeCommunity(id: string, value: unknown): CommunitySummary {
    const record: CommunitySource = typeof value === 'object' && value !== null ? value as CommunitySource : {};
    return {
      id,
      title: readString(record.title) || readString(record.name) || 'Untitled community',
      description: readString(record.description),
      imageUrl: readString(record.imageUrl) || readString(record.coverImage) || readString(record.bannerImageUrl) || null,
      membershipCount: readNumber(record.membershipCount) || readNumber(record.memberCount) || readNumber(record.membersCount),
      isPrivate: record.isPrivate === true || record.privacy === 'private',
      categoryId: readString(record.categoryId) || null,
      creatorId: readString(record.userId) || null,
      creatorName: readString(record.creatorName),
      isMember: record.isMember === true,
      requestStatus: readString(record.requestStatus) === 'pending' || readString(record.requestStatus) === 'approved' || readString(record.requestStatus) === 'declined' ? readString(record.requestStatus) as CommunitySummary['requestStatus'] : 'none',
      postCount: readNumber(record.postCount),
      membershipLikes: readNumber(record.membershipLikes),
      createdAt: readString(record.createdAt) || null,
      createdAtMs: readDateMs(record.createdAt),
      hasAccess: record.hasAccess !== false,
      isOwner: record.isOwner === true,
      isBanned: record.isBanned === true,
      postingPermission: readString(record.postingPermission) === 'admins' || readString(record.postingPermission) === 'owner' ? readString(record.postingPermission) as 'admins' | 'owner' : 'members',
    };
  }
}
