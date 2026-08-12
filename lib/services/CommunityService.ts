import { addDoc, collection, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { ApiService } from './ApiService';

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
  hasAccess: boolean;
  isOwner: boolean;
  isBanned: boolean;
  postingPermission: 'members' | 'admins' | 'owner';
};

export type CreateCommunityInput = {
  title: string;
  description: string;
  isPrivate: boolean;
  categoryId?: string;
};

const readString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

export class CommunityService {
  private static instance: CommunityService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly apiService = ApiService.getInstance();

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
      const snapshot = await getDocs(query(collection(db, 'communityVariant'), limit(maxResults)));
      const viewerId = auth.currentUser?.uid;
      const baseCommunities = snapshot.docs.map((document) => this.normalizeCommunity(document.id, document.data()));
      const ids = baseCommunities.map((community) => community.id);
      const [memberships, requests, counts] = await Promise.all([
        viewerId ? getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId), where('isMember', '==', true))) : null,
        viewerId ? getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId))) : null,
        Promise.all(ids.map((id) => getDoc(doc(db, 'communityVariantMembershipAndLikeCount', id)))),
      ]);
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
    const response = await this.apiService.request<{ data?: unknown; resolvedId?: string; access?: { hasAccess?: boolean; isOwner?: boolean; isBanned?: boolean }; error?: string }>(
      `/api/communities/fetch?type=community&id=${encodeURIComponent(id)}`,
      { authenticated: Boolean(auth.currentUser) }
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

  public async joinOrRequestAccess(community: CommunitySummary): Promise<'joined' | 'requested'> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to join a community');
    if (community.isPrivate) {
      const existing = await getDocs(query(collection(db, 'communityRequests'), where('userId', '==', userId), where('communityVariantId', '==', community.id)));
      if (existing.empty) {
        await addDoc(collection(db, 'communityRequests'), { userId, communityVariantId: community.id, status: 'pending', requestedAt: serverTimestamp() });
      } else {
        await updateDoc(existing.docs[0].ref, { status: 'pending', requestedAt: serverTimestamp(), declinedAt: null });
      }
      return 'requested';
    }
    const existing = await getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', userId), where('communityVariantId', '==', community.id), where('isMember', '==', true)));
    if (existing.empty) {
      await addDoc(collection(db, 'communityVariantMembership'), { userId, communityVariantId: community.id, isMember: true, role: 'member', isAdmin: false, from: serverTimestamp(), to: null });
      await setDoc(doc(db, 'communityVariantMembershipAndLikeCount', community.id), { communityVariantId: community.id, membershipCount: increment(1), membershipLikes: community.membershipLikes }, { merge: true });
    }
    return 'joined';
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
    const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
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
      hasAccess: record.hasAccess !== false,
      isOwner: record.isOwner === true,
      isBanned: record.isBanned === true,
      postingPermission: readString(record.postingPermission) === 'admins' || readString(record.postingPermission) === 'owner' ? readString(record.postingPermission) as 'admins' | 'owner' : 'members',
    };
  }
}
