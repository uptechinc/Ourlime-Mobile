import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import { ApiService } from './ApiService';
import type { ApiRequestPriority } from './ApiService';
import type {
  CommunityCardModel,
  CommunityCategory,
  CommunityDirectoryPage,
  CommunityDirectoryQuery,
  CommunityDetailResource,
  CommunityJoinRequest,
  CommunityMember,
  CommunityMutationResult,
  CommunityPage,
  CommunityReactionResult,
  CommunityReportTarget,
  CreateCommunityInput,
  UpdateCommunityInput,
} from '@/lib/types/community';

export type CommunitySummary = CommunityCardModel;
export type { CommunityCategory, CreateCommunityInput } from '@/lib/types/community';

type ApiResult<TData> = {
  success?: boolean;
  data?: TData;
  error?: string;
  code?: string;
  suggestions?: string[];
};

export type CommunityAvailability = {
  nameAvailable: boolean;
  slugAvailable: boolean;
  normalizedSlug: string;
  suggestions: string[];
};

type CommunityCardSource = {
  id?: unknown;
  slug?: unknown;
  uniqueName?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  bannerImageUrl?: unknown;
  coverImage?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
  creatorId?: unknown;
  userId?: unknown;
  creatorName?: unknown;
  creatorUserName?: unknown;
  creatorProfilePicture?: unknown;
  creatorProfileImage?: unknown;
  isPrivate?: unknown;
  privacy?: unknown;
  isVerified?: unknown;
  verifiedMembersOnly?: unknown;
  postingPermission?: unknown;
  createdAt?: unknown;
  createdAtMs?: unknown;
  updatedAtMs?: unknown;
  memberCount?: unknown;
  membershipCount?: unknown;
  likeCount?: unknown;
  membershipLikes?: unknown;
  postCount?: unknown;
  topMembers?: unknown;
  friendMembers?: unknown;
  friendMemberCount?: unknown;
  membershipState?: unknown;
  viewerRole?: unknown;
  isLikedByViewer?: unknown;
  permissions?: unknown;
};

type PermissionSource = {
  canView?: unknown;
  canJoin?: unknown;
  canRequestAccess?: unknown;
  canCancelRequest?: unknown;
  canLeave?: unknown;
  canPost?: unknown;
  canHostEvent?: unknown;
  canCreatePoll?: unknown;
  canInvite?: unknown;
  canEdit?: unknown;
  canDelete?: unknown;
  canManageMembers?: unknown;
  canModerate?: unknown;
  canReport?: unknown;
};

type PersonSource = {
  userId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  userName?: unknown;
  profilePicture?: unknown;
};

type CommunityMemberSource = PersonSource & {
  id?: unknown;
  membershipId?: unknown;
  profileImage?: unknown;
  role?: unknown;
  joinedAt?: unknown;
  status?: unknown;
  isOwner?: unknown;
  isFriend?: unknown;
  isOnline?: unknown;
  permissions?: unknown;
};
type CommunityMemberPermissionSource = { canPromote?: unknown; canDemote?: unknown; canRemove?: unknown; canBan?: unknown };

type CommunityRequestSource = PersonSource & {
  id?: unknown;
  requestId?: unknown;
  profileImage?: unknown;
  requestedAt?: unknown;
  status?: unknown;
};

const readString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const readBoolean = (value: unknown): boolean => value === true;
const readDateMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
};
const toQueryString = (query: CommunityDirectoryQuery): string => {
  const parameters = new URLSearchParams({
    scope: query.scope,
    visibility: query.visibility,
    sort: query.sort,
    limit: String(query.limit),
  });
  if (query.categoryId) parameters.set('categoryId', query.categoryId);
  if (query.search.trim()) parameters.set('search', query.search.trim());
  if (query.cursor) parameters.set('cursor', query.cursor);
  return parameters.toString();
};

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

  public async fetchDirectory(query: CommunityDirectoryQuery, priority: ApiRequestPriority = 'foreground'): Promise<CommunityDirectoryPage> {
    this.logger.info('CommunityService', 'fetchDirectory:start', { scope: query.scope, sort: query.sort, hasCursor: Boolean(query.cursor), priority });
    try {
      const response = await this.apiService.request<ApiResult<CommunityDirectoryPage>>(`/api/communities?${toQueryString(query)}`, {
        authenticated: Boolean(auth.currentUser),
        priority,
        timeoutMs: 25_000,
      });
      if (response.success && response.data) {
        const page: CommunityDirectoryPage = {
          items: response.data.items.filter((community) => !accountLifecycleVisibilityService.isHidden(community)).map((community) => this.normalizeCommunity(community)),
          communityOfTheWeek: response.data.communityOfTheWeek && !accountLifecycleVisibilityService.isHidden(response.data.communityOfTheWeek)
            ? this.normalizeCommunity(response.data.communityOfTheWeek)
            : null,
          nextCursor: typeof response.data.nextCursor === 'string' ? response.data.nextCursor : null,
          hasMore: response.data.hasMore === true,
          totalCount: readNumber(response.data.totalCount),
        };
        this.logger.success('CommunityService', 'fetchDirectory', { resultCount: page.items.length, totalCount: page.totalCount });
        return page;
      }
    } catch (apiError: unknown) {
      this.logger.warn('CommunityService', 'fetchDirectory:api-failed', {
        error: apiError instanceof Error ? apiError.message : String(apiError),
      });
    }

    return this.fetchDirectoryFromFirestore(query);
  }

  private async fetchDirectoryFromFirestore(directoryQuery: CommunityDirectoryQuery): Promise<CommunityDirectoryPage> {
    this.logger.info('CommunityService', 'fetchDirectory:firestore-fallback:start', { scope: directoryQuery.scope, sort: directoryQuery.sort });
    try {
      const snap = await getDocs(query(collection(db, 'communityVariant'), limit(60)));
      const currentUserId = this.getCurrentUserId();

      const userMembershipMap = new Map<string, { role: string; isMember: boolean }>();
      const userPendingSet = new Set<string>();
      const userBannedSet = new Set<string>();
      const friendIds = new Set<string>();

      if (currentUserId) {
        const [membershipsSnap, requestsSnap, bansSnap, friendsAsUser1, friendsAsUser2] = await Promise.all([
          getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'communityRequests'), where('userId', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'bannedCommunityMembers'), where('userId', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'friends'), where('userId1', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'friends'), where('userId2', '==', currentUserId))).catch(() => null),
        ]);

        membershipsSnap?.docs.forEach((d) => {
          const mData = d.data();
          const cId = readString(mData.communityVariantId);
          if (cId && mData.isMember === true) {
            userMembershipMap.set(cId, { role: readString(mData.role).toLowerCase() || 'member', isMember: true });
          }
        });

        requestsSnap?.docs.forEach((d) => {
          const rData = d.data();
          const cId = readString(rData.communityVariantId);
          if (cId && rData.status === 'pending') userPendingSet.add(cId);
        });

        bansSnap?.docs.forEach((d) => {
          const bData = d.data();
          const cId = readString(bData.communityVariantId);
          if (cId) userBannedSet.add(cId);
        });

        friendsAsUser1?.docs.forEach((d) => {
          const fid = readString(d.data().userId2);
          if (fid) friendIds.add(fid);
        });
        friendsAsUser2?.docs.forEach((d) => {
          const fid = readString(d.data().userId1);
          if (fid) friendIds.add(fid);
        });
      }

      const items: CommunitySummary[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (accountLifecycleVisibilityService.isHidden(data)) continue;
        const id = docSnap.id;
        const slug = readString(data.uniqueName) || id;
        const title = readString(data.title) || readString(data.name) || slug;
        const description = readString(data.description);
        const imageUrl = readString(data.imageUrl) || readString(data.bannerImageUrl) || readString(data.coverImage) || null;
        const categoryId = readString(data.categoryId) || null;
        const creatorId = readString(data.userId) || readString(data.creatorId);
        const isPrivate = data.isPrivate === true || readString(data.privacy) === 'private';
        const isOwner = Boolean(currentUserId && creatorId === currentUserId);

        const membership = userMembershipMap.get(id);
        const isMember = isOwner || (membership?.isMember === true);
        const isPending = !isMember && userPendingSet.has(id);
        const isBanned = userBannedSet.has(id);

        const viewerRole: CommunitySummary['viewerRole'] = isOwner
          ? 'owner'
          : membership?.role === 'admin'
            ? 'admin'
            : membership?.role === 'moderator'
              ? 'moderator'
              : isMember
                ? 'member'
                : 'none';

        const membershipState: CommunitySummary['membershipState'] = isBanned
          ? 'banned'
          : isOwner
            ? 'owner'
            : isMember
              ? 'member'
              : isPending
                ? 'pending'
                : 'none';

        const hasAccess = !isBanned && (!isPrivate || isMember || isOwner);

        items.push({
          id,
          slug,
          title,
          description,
          imageUrl,
          categoryId,
          categoryName: '',
          creatorId,
          creatorName: isOwner ? 'You' : 'Community creator',
          creatorUserName: '',
          creatorProfilePicture: null,
          isPrivate,
          isVerified: readBoolean(data.isVerified),
          verifiedMembersOnly: readBoolean(data.verifiedMembersOnly),
          postingPermission: (readString(data.postingPermission) as CommunityCardModel['postingPermission']) || 'members',
          createdAt: null,
          createdAtMs: readDateMs(data.createdAt),
          updatedAtMs: readDateMs(data.updatedAt) || readDateMs(data.createdAt),
          memberCount: readNumber(data.memberCount) || 1,
          likeCount: readNumber(data.likeCount) || 0,
          postCount: readNumber(data.postCount) || 0,
          topMembers: [],
          friendMembers: [],
          friendMemberCount: 0,
          membershipState,
          viewerRole,
          isLikedByViewer: false,
          permissions: {
            canView: hasAccess,
            canJoin: Boolean(currentUserId && !isPrivate && !isMember && !isBanned),
            canRequestAccess: Boolean(currentUserId && isPrivate && !isMember && !isPending && !isBanned),
            canCancelRequest: isPending,
            canLeave: isMember && !isOwner,
            canPost: hasAccess,
            canHostEvent: hasAccess,
            canCreatePoll: hasAccess,
            canInvite: hasAccess && (isMember || isOwner),
            canEdit: isOwner,
            canDelete: isOwner,
            canManageMembers: isOwner || viewerRole === 'admin',
            canModerate: isOwner || viewerRole === 'admin' || viewerRole === 'moderator',
            canReport: Boolean(currentUserId && !isOwner),
          },
        });
      }

      let filteredItems = items;

      if (directoryQuery.scope === 'joined') {
        filteredItems = filteredItems.filter((item) => item.membershipState === 'member' || item.membershipState === 'owner');
      } else if (directoryQuery.scope === 'created') {
        filteredItems = filteredItems.filter((item) => item.creatorId === currentUserId || item.membershipState === 'owner');
      } else if (directoryQuery.scope === 'friends') {
        filteredItems = filteredItems.filter((item) => item.friendMemberCount > 0);
      } else if (directoryQuery.scope === 'new') {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        filteredItems = filteredItems.filter((item) => item.createdAtMs >= thirtyDaysAgo);
        filteredItems.sort((a, b) => b.createdAtMs - a.createdAtMs);
      }

      if (directoryQuery.search.trim()) {
        const term = directoryQuery.search.trim().toLowerCase();
        filteredItems = filteredItems.filter((item) => item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term));
      }
      if (directoryQuery.visibility === 'public') {
        filteredItems = filteredItems.filter((item) => !item.isPrivate);
      } else if (directoryQuery.visibility === 'private') {
        filteredItems = filteredItems.filter((item) => item.isPrivate);
      }
      if (directoryQuery.categoryId) {
        filteredItems = filteredItems.filter((item) => item.categoryId === directoryQuery.categoryId);
      }

      if (directoryQuery.sort === 'popular') {
        filteredItems.sort((a, b) => (b.memberCount * 2 + b.likeCount * 3 + b.postCount) - (a.memberCount * 2 + a.likeCount * 3 + a.postCount));
      } else if (directoryQuery.sort === 'newest') {
        filteredItems.sort((a, b) => b.createdAtMs - a.createdAtMs);
      } else if (directoryQuery.sort === 'active' || directoryQuery.sort === 'trending') {
        filteredItems.sort((a, b) => (b.postCount * 4 + b.likeCount * 2 + b.memberCount) - (a.postCount * 4 + a.likeCount * 2 + a.memberCount));
      }

      const paged = filteredItems.slice(0, directoryQuery.limit);
      const page: CommunityDirectoryPage = {
        items: paged,
        communityOfTheWeek: paged[0] ?? null,
        nextCursor: null,
        hasMore: false,
        totalCount: filteredItems.length,
      };
      this.logger.success('CommunityService', 'fetchDirectory:firestore-fallback:success', { count: page.items.length, total: page.totalCount });
      return page;
    } catch (fallbackError: unknown) {
      this.logger.error('CommunityService', 'fetchDirectory:firestore-fallback:error', fallbackError);
      throw fallbackError;
    }
  }

  public async fetchCommunities(maxResults = 40): Promise<CommunitySummary[]> {
    const page = await this.fetchDirectory({ scope: 'all', visibility: 'all', categoryId: null, search: '', sort: 'popular', cursor: null, limit: Math.min(maxResults, 40) }, 'background');
    return page.items;
  }

  public async fetchCommunity(identifier: string): Promise<CommunitySummary> {
    try {
      const response = await this.apiService.request<ApiResult<unknown> & { resolvedId?: string }>(`/api/communities/fetch?type=community&id=${encodeURIComponent(identifier)}`, {
        authenticated: Boolean(auth.currentUser),
        timeoutMs: 15_000,
      });
      if (response.data) return this.normalizeCommunity(response.data);
    } catch (error: unknown) {
      this.logger.warn('CommunityService', 'fetchCommunity:api-failed', { identifier, error: error instanceof Error ? error.message : String(error) });
    }
    return this.fetchCommunityFromFirestore(identifier);
  }

  public async fetchCommunityDetail(identifier: string): Promise<CommunityDetailResource> {
    try {
      const response = await this.apiService.request<ApiResult<unknown>>(`/api/communities/fetch?type=community&id=${encodeURIComponent(identifier)}`, {
        authenticated: Boolean(auth.currentUser),
        timeoutMs: 15_000,
      });
      if (response.data) {
        const source = typeof response.data === 'object' && response.data !== null ? response.data as CommunityCardSource & { rules?: unknown } : {};
        return {
          community: this.normalizeCommunity(source),
          rules: Array.isArray(source.rules) ? source.rules.filter((rule): rule is string => typeof rule === 'string' && Boolean(rule.trim())).map((rule) => rule.trim()) : [],
        };
      }
    } catch (error: unknown) {
      this.logger.warn('CommunityService', 'fetchCommunityDetail:api-failed', { identifier, error: error instanceof Error ? error.message : String(error) });
    }
    const community = await this.fetchCommunityFromFirestore(identifier);
    return { community, rules: [] };
  }

  private async fetchCommunityFromFirestore(identifier: string): Promise<CommunitySummary> {
    const docRef = doc(db, 'communityVariant', identifier);
    let docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      const querySnap = await getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', identifier), limit(1)));
      if (!querySnap.empty) docSnap = querySnap.docs[0];
    }
    if (!docSnap.exists()) throw new Error('Community not found.');

    const data = docSnap.data();
    const id = docSnap.id;
    const viewerId = this.getCurrentUserId();
    const creatorId = readString(data.userId) || readString(data.creatorId);
    const isOwner = Boolean(viewerId && creatorId && creatorId === viewerId);

    let isMember = isOwner;
    let isPending = false;
    let isBanned = false;
    let viewerRole: CommunitySummary['viewerRole'] = isOwner ? 'owner' : 'none';

    if (viewerId && !isOwner) {
      const [membershipSnap, requestSnap, banSnap] = await Promise.all([
        getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', id), where('userId', '==', viewerId), where('isMember', '==', true), limit(1))).catch(() => null),
        getDocs(query(collection(db, 'communityRequests'), where('communityVariantId', '==', id), where('userId', '==', viewerId), limit(1))).catch(() => null),
        getDocs(query(collection(db, 'bannedCommunityMembers'), where('communityVariantId', '==', id), where('userId', '==', viewerId), limit(1))).catch(() => null),
      ]);
      if (banSnap && !banSnap.empty) isBanned = true;
      if (membershipSnap && !membershipSnap.empty) {
        const mData = membershipSnap.docs[0].data();
        if (mData.isMember === true) {
          isMember = true;
          const role = readString(mData.role).toLowerCase();
          viewerRole = role === 'admin' ? 'admin' : role === 'moderator' ? 'moderator' : 'member';
        }
      }
      if (!isMember && requestSnap && !requestSnap.empty) {
        const rData = requestSnap.docs[0].data();
        if (rData.status === 'pending') isPending = true;
      }
    }

    const countDoc = await getDoc(doc(db, 'communityVariantMembershipAndLikeCount', id)).catch(() => null);
    const countData = countDoc?.exists() ? countDoc.data() : null;
    const isPrivate = data.isPrivate === true || readString(data.privacy) === 'private';
    const userLikes = Array.isArray(countData?.userLikes) ? countData.userLikes : [];
    const isLiked = Boolean(viewerId && userLikes.includes(viewerId));

    let creatorName = isOwner ? 'You' : 'Community creator';
    let creatorProfilePicture: string | null = null;
    if (creatorId) {
      const creatorDoc = await getDoc(doc(db, 'users', creatorId)).catch(() => null);
      if (creatorDoc?.exists()) {
        const creatorData = creatorDoc.data();
        creatorName = `${readString(creatorData?.firstName)} ${readString(creatorData?.lastName)}`.trim() || readString(creatorData?.userName) || (isOwner ? 'You' : 'Community creator');
        creatorProfilePicture = readString(creatorData?.profilePicture) || readString(creatorData?.profileImage) || null;
      }
    }

    const membershipState: CommunitySummary['membershipState'] = isBanned ? 'banned' : isOwner ? 'owner' : isMember ? 'member' : isPending ? 'pending' : 'none';
    const hasAccess = isOwner || (!isBanned && (!isPrivate || isMember));

    return {
      id,
      slug: readString(data.uniqueName) || id,
      title: readString(data.title) || readString(data.name) || 'Untitled community',
      description: readString(data.description),
      imageUrl: readString(data.imageUrl) || readString(data.bannerImageUrl) || readString(data.coverImage) || null,
      categoryId: readString(data.categoryId) || null,
      categoryName: '',
      creatorId,
      creatorName,
      creatorUserName: '',
      creatorProfilePicture,
      isPrivate,
      isVerified: readBoolean(data.isVerified),
      verifiedMembersOnly: readBoolean(data.verifiedMembersOnly),
      postingPermission: (readString(data.postingPermission) as CommunityCardModel['postingPermission']) || 'members',
      createdAt: null,
      createdAtMs: readDateMs(data.createdAt),
      updatedAtMs: readDateMs(data.updatedAt),
      memberCount: readNumber(countData?.membershipCount) || readNumber(data.memberCount) || 1,
      likeCount: readNumber(countData?.membershipLikes) || 0,
      postCount: readNumber(countData?.postCount) || 0,
      topMembers: [],
      friendMembers: [],
      friendMemberCount: 0,
      membershipState,
      viewerRole,
      isLikedByViewer: isLiked,
      permissions: {
        canView: hasAccess,
        canJoin: Boolean(!isOwner && viewerId && !isPrivate && !isMember && !isBanned),
        canRequestAccess: Boolean(!isOwner && viewerId && isPrivate && !isMember && !isPending && !isBanned),
        canCancelRequest: !isOwner && isPending,
        canLeave: isMember && !isOwner,
        canPost: hasAccess,
        canHostEvent: hasAccess,
        canCreatePoll: hasAccess,
        canInvite: hasAccess,
        canEdit: isOwner,
        canDelete: isOwner,
        canManageMembers: isOwner || viewerRole === 'admin',
        canModerate: isOwner || viewerRole === 'admin' || viewerRole === 'moderator',
        canReport: Boolean(viewerId && !isOwner),
      },
    };
  }

  public async fetchCategories(): Promise<CommunityCategory[]> {
    const snapshot = await getDocs(collection(db, 'communityCategories'));
    return snapshot.docs.flatMap((document): CommunityCategory[] => {
      const value = document.data();
      const name = readString(value.name) || readString(value.type) || readString(value.categoryName);
      if (!name) return [];
      return [{ id: document.id, name, type: readString(value.type) || name, bannerImageUrl: readString(value.bannerImageUrl) || null }];
    }).sort((first, second) => first.name.localeCompare(second.name));
  }

  public async checkAvailability(title: string, slug: string, excludeId?: string): Promise<CommunityAvailability> {
    const response = await this.apiService.request<ApiResult<CommunityAvailability>>(`/api/communities?mode=availability&title=${encodeURIComponent(title)}&slug=${encodeURIComponent(slug)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`, { authenticated: Boolean(auth.currentUser), priority: 'background' });
    if (!response.success || !response.data) throw new Error(response.error || 'Community name availability could not be checked.');
    return response.data;
  }

  public async joinOrRequestAccess(community: CommunitySummary): Promise<CommunityMutationResult> {
    const action = community.isPrivate ? 'request' : 'join';
    return this.updateMembership(community.id, action);
  }

  public async cancelRequest(communityId: string): Promise<CommunityMutationResult> {
    return this.updateMembership(communityId, 'cancel_request');
  }

  public async leaveCommunity(communityId: string): Promise<CommunityMutationResult> {
    return this.updateMembership(communityId, 'leave');
  }

  public async toggleCommunityLike(communityId: string, desiredLiked: boolean): Promise<CommunityReactionResult> {
    try {
      const response = await this.apiService.request<ApiResult<CommunityReactionResult>>('/api/communities/community-like', {
        method: 'POST',
        authenticated: true,
        body: { communityId, desiredLiked },
      });
      if (response.success && response.data) return response.data;
    } catch (error: unknown) {
      this.logger.warn('CommunityService', 'toggleCommunityLike:api-failed', { communityId, error: error instanceof Error ? error.message : String(error) });
    }

    const viewerId = this.getCurrentUserId();
    if (!viewerId) throw new Error('You must be signed in to like a community.');
    const countDocRef = doc(db, 'communityVariantMembershipAndLikeCount', communityId);
    const countSnap = await getDoc(countDocRef);
    const currentLikes = readNumber(countSnap.data()?.membershipLikes) || 0;
    const newLikes = desiredLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
    await setDoc(countDocRef, {
      communityVariantId: communityId,
      membershipLikes: newLikes,
    }, { merge: true }).catch(() => undefined);
    return { liked: desiredLiked, likeCount: newLikes };
  }

  public async createCommunity(input: CreateCommunityInput): Promise<CommunitySummary> {
    const response = await this.apiService.request<ApiResult<{ id: string; slug: string }>>('/api/communities', {
      method: 'POST',
      authenticated: true,
      body: input,
    });
    if (!response.success || !response.data) throw new Error(response.error || 'Community could not be created.');
    return this.fetchCommunity(response.data.id);
  }

  public async updateCommunity(communityId: string, updates: UpdateCommunityInput): Promise<CommunitySummary> {
    const response = await this.apiService.request<{ success?: boolean; status?: string; error?: string }>('/api/communities/edit', { method: 'POST', authenticated: true, body: { communityId, updates } });
    if (!response.success && response.status !== 'success') throw new Error(response.error || 'Community could not be updated.');
    return this.fetchCommunity(communityId);
  }

  public async deleteCommunity(communityId: string): Promise<void> {
    const response = await this.apiService.request<{ success?: boolean; error?: string; message?: string }>('/api/communities/delete', { method: 'POST', authenticated: true, body: { communityId } });
    if (response.success === false || response.error) throw new Error(response.error || 'Community could not be deleted.');
  }

  public async fetchMembers(communityId: string, cursor: string | null = null, search = ''): Promise<CommunityPage<CommunityMember>> {
    const response = await this.apiService.request<ApiResult<{ items?: unknown; nextCursor?: unknown; hasMore?: unknown; totalCount?: unknown }>>(`/api/communities/members?communityId=${encodeURIComponent(communityId)}&limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`, { authenticated: true });
    const sourceItems = response.data?.items;
    if (!Array.isArray(sourceItems)) throw new Error(response.error || 'Community members could not be loaded.');
    const items = sourceItems.flatMap((value): CommunityMember[] => {
      if (typeof value !== 'object' || value === null) return [];
      const source = value as CommunityMemberSource;
      const userId = readString(source.userId);
      if (!userId) return [];
      const roleValue = source.isOwner === true ? 'owner' : readString(source.role);
      const role: CommunityMember['role'] = roleValue === 'owner' || roleValue === 'admin' || roleValue === 'moderator' ? roleValue : 'member';
      const permissions: CommunityMemberPermissionSource = typeof source.permissions === 'object' && source.permissions !== null ? source.permissions as CommunityMemberPermissionSource : {};
      return [{ userId, membershipId: readString(source.membershipId) || readString(source.id), firstName: readString(source.firstName), lastName: readString(source.lastName), userName: readString(source.userName), profilePicture: readString(source.profilePicture) || readString(source.profileImage) || null, role, joinedAt: readString(source.joinedAt) || null, isFriend: readBoolean(source.isFriend), isOnline: readBoolean(source.isOnline), permissions: { canPromote: readBoolean(permissions.canPromote), canDemote: readBoolean(permissions.canDemote), canRemove: readBoolean(permissions.canRemove), canBan: readBoolean(permissions.canBan) } }];
    });
    return { items, nextCursor: readString(response.data?.nextCursor) || null, hasMore: response.data?.hasMore === true, totalCount: readNumber(response.data?.totalCount) || items.length };
  }

  public async fetchJoinRequests(communityId: string): Promise<CommunityPage<CommunityJoinRequest>> {
    const response = await this.apiService.request<ApiResult<unknown[]>>(`/api/communities/fetch?type=requests&id=${encodeURIComponent(communityId)}`, { authenticated: true });
    if (!Array.isArray(response.data)) throw new Error(response.error || 'Community requests could not be loaded.');
    const items = response.data.flatMap((value): CommunityJoinRequest[] => {
      if (typeof value !== 'object' || value === null) return [];
      const source = value as CommunityRequestSource;
      const userId = readString(source.userId);
      if (!userId) return [];
      const statusValue = readString(source.status);
      const status: CommunityJoinRequest['status'] = statusValue === 'approved' || statusValue === 'declined' || statusValue === 'canceled' ? statusValue : 'pending';
      return [{ userId, requestId: readString(source.requestId) || readString(source.id), firstName: readString(source.firstName), lastName: readString(source.lastName), userName: readString(source.userName), profilePicture: readString(source.profilePicture) || readString(source.profileImage) || null, requestedAt: readString(source.requestedAt) || null, status }];
    });
    return { items, nextCursor: null, hasMore: false, totalCount: items.length };
  }

  public async reviewJoinRequest(communityId: string, requestId: string, userId: string, action: 'approve' | 'decline'): Promise<void> {
    const response = await this.apiService.request<{ message?: string; error?: string }>('/api/communities/requests', { method: 'POST', authenticated: true, body: { communityId, requestId, userId, action } });
    if (!response.message) throw new Error(response.error || 'Join request could not be updated.');
  }

  public async updateMemberRole(communityId: string, targetUserId: string, newRole: Exclude<CommunityMember['role'], 'owner' | 'none'>): Promise<void> {
    const response = await this.apiService.request<ApiResult<unknown>>('/api/communities/update-role', {
      method: 'POST',
      authenticated: true,
      body: { communityId, targetUserId, newRole },
    });
    if (!response.success) throw new Error(response.error || 'The member role could not be updated.');
  }

  public async removeMember(communityId: string, userId: string): Promise<void> {
    const response = await this.apiService.request<{ error?: string; success?: boolean }>('/api/communities/remove-user', {
      method: 'POST',
      authenticated: true,
      body: { communityId, userId },
    });
    if (response.error || response.success === false) throw new Error(response.error || 'The member could not be removed.');
  }

  public async banMember(communityId: string, userId: string): Promise<void> {
    const response = await this.apiService.request<{ error?: string; success?: boolean }>('/api/communities/ban-user', {
      method: 'POST',
      authenticated: true,
      body: { communityId, userId },
    });
    if (response.error || response.success === false) throw new Error(response.error || 'The member could not be banned.');
  }

  public async reportContent(input: { communityId: string; targetId: string; targetType: CommunityReportTarget; reason: string; details?: string }): Promise<void> {
    const response = await this.apiService.request<ApiResult<{ reportId: string; alreadyReported: boolean }>>('/api/communities/reports', {
      method: 'POST',
      authenticated: true,
      body: input,
    });
    if (!response.success) throw new Error(response.error || 'The community report could not be submitted.');
  }

  private async updateMembership(communityId: string, action: 'join' | 'request' | 'cancel_request' | 'leave'): Promise<CommunityMutationResult> {
    try {
      const response = await this.apiService.request<ApiResult<{ state: CommunityMutationResult['membershipState']; memberCount: number }>>('/api/communities/membership', {
        method: 'POST',
        authenticated: true,
        body: { communityId, action },
        timeoutMs: 15_000,
      });
      if (response.success && response.data) {
        return { communityId, membershipState: response.data.state, memberCount: readNumber(response.data.memberCount) };
      }
    } catch (error: unknown) {
      this.logger.warn('CommunityService', 'updateMembership:api-failed', {
        communityId,
        action,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.updateMembershipInFirestore(communityId, action);
  }

  private async updateMembershipInFirestore(communityId: string, action: 'join' | 'request' | 'cancel_request' | 'leave'): Promise<CommunityMutationResult> {
    const viewerId = this.getCurrentUserId();
    if (!viewerId) throw new Error('You must be signed in to perform this action.');
    this.logger.info('CommunityService', 'updateMembership:firestore:start', { communityId, action, viewerId });

    const communityDocRef = doc(db, 'communityVariant', communityId);
    const communitySnap = await getDoc(communityDocRef);
    const communityData = communitySnap.exists() ? communitySnap.data() : null;
    const isOwner = communityData?.userId === viewerId || communityData?.creatorId === viewerId;
    const countDocRef = doc(db, 'communityVariantMembershipAndLikeCount', communityId);
    const countSnap = await getDoc(countDocRef);
    const currentMemberCount = readNumber(countSnap.data()?.membershipCount) || readNumber(communityData?.memberCount) || 1;

    const membershipDocRef = doc(db, 'communityVariantMembership', `${communityId}_${viewerId}`);
    const requestDocRef = doc(db, 'communityRequests', `${communityId}_${viewerId}`);

    if (action === 'join') {
      await setDoc(membershipDocRef, {
        userId: viewerId,
        communityVariantId: communityId,
        isMember: true,
        role: isOwner ? 'owner' : 'member',
        status: 'active',
        joinedAt: serverTimestamp(),
        from: serverTimestamp(),
        to: null,
      }, { merge: true });
      await deleteDoc(requestDocRef).catch(() => undefined);
      const newCount = currentMemberCount + 1;
      await setDoc(countDocRef, { communityVariantId: communityId, membershipCount: newCount }, { merge: true }).catch(() => undefined);
      this.logger.success('CommunityService', 'updateMembership:firestore:joined', { communityId, newCount });
      return { communityId, membershipState: isOwner ? 'owner' : 'member', memberCount: newCount };
    }

    if (action === 'request') {
      await setDoc(requestDocRef, {
        userId: viewerId,
        communityVariantId: communityId,
        status: 'pending',
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      this.logger.success('CommunityService', 'updateMembership:firestore:requested', { communityId });
      return { communityId, membershipState: 'pending', memberCount: currentMemberCount };
    }

    if (action === 'cancel_request') {
      await deleteDoc(requestDocRef).catch(() => undefined);
      this.logger.success('CommunityService', 'updateMembership:firestore:request-cancelled', { communityId });
      return { communityId, membershipState: 'none', memberCount: currentMemberCount };
    }

    if (action === 'leave') {
      if (isOwner) throw new Error('The community owner cannot leave the community.');
      await setDoc(membershipDocRef, {
        isMember: false,
        status: 'left',
        to: serverTimestamp(),
      }, { merge: true });
      const newCount = Math.max(0, currentMemberCount - 1);
      await setDoc(countDocRef, { communityVariantId: communityId, membershipCount: newCount }, { merge: true }).catch(() => undefined);
      this.logger.success('CommunityService', 'updateMembership:firestore:left', { communityId, newCount });
      return { communityId, membershipState: 'none', memberCount: newCount };
    }

    return { communityId, membershipState: 'none', memberCount: currentMemberCount };
  }

  private normalizeCommunity(value: unknown): CommunitySummary {
    const source: CommunityCardSource = typeof value === 'object' && value !== null ? value as CommunityCardSource : {};
    const permissionSource: PermissionSource = typeof source.permissions === 'object' && source.permissions !== null ? source.permissions as PermissionSource : {};
    const id = readString(source.id);
    const membershipValue = readString(source.membershipState);
    const membershipState: CommunitySummary['membershipState'] = membershipValue === 'owner' || membershipValue === 'member' || membershipValue === 'pending' || membershipValue === 'declined' || membershipValue === 'banned' ? membershipValue : 'none';
    const roleValue = readString(source.viewerRole);
    const viewerRole: CommunitySummary['viewerRole'] = roleValue === 'owner' || roleValue === 'admin' || roleValue === 'moderator' || roleValue === 'member' ? roleValue : 'none';
    const postingValue = readString(source.postingPermission);
    const postingPermission: CommunitySummary['postingPermission'] = postingValue === 'everyone' || postingValue === 'admins' || postingValue === 'owner' ? postingValue : 'members';

    const viewerId = this.getCurrentUserId();
    const creatorId = readString(source.creatorId) || readString(source.userId);
    const isOwner = membershipState === 'owner' || (Boolean(viewerId && creatorId) && creatorId === viewerId);
    const isMember = isOwner || membershipState === 'member';
    const isPrivate = readBoolean(source.isPrivate) || readString(source.privacy) === 'private';
    const isBanned = membershipState === 'banned';
    const hasAccess = isOwner || (permissionSource.canView !== undefined
      ? readBoolean(permissionSource.canView)
      : (!isPrivate || isMember));

    const finalMembershipState: CommunitySummary['membershipState'] = isBanned
      ? 'banned'
      : isOwner
        ? 'owner'
        : membershipState === 'member'
          ? 'member'
          : membershipState === 'pending'
            ? 'pending'
            : membershipState === 'declined'
              ? 'declined'
              : 'none';

    const finalViewerRole: CommunitySummary['viewerRole'] = isOwner
      ? 'owner'
      : viewerRole;

    return {
      id,
      slug: readString(source.slug) || readString(source.uniqueName) || id,
      title: readString(source.title) || readString(source.name) || 'Untitled community',
      description: readString(source.description),
      imageUrl: readString(source.imageUrl) || readString(source.bannerImageUrl) || readString(source.coverImage) || null,
      categoryId: readString(source.categoryId) || null,
      categoryName: readString(source.categoryName),
      creatorId,
      creatorName: isOwner && !readString(source.creatorName) ? 'You' : (readString(source.creatorName) || 'Community creator'),
      creatorUserName: readString(source.creatorUserName),
      creatorProfilePicture: readString(source.creatorProfilePicture) || readString(source.creatorProfileImage) || null,
      isPrivate,
      isVerified: readBoolean(source.isVerified),
      verifiedMembersOnly: readBoolean(source.verifiedMembersOnly),
      postingPermission,
      createdAt: readString(source.createdAt) || null,
      createdAtMs: readNumber(source.createdAtMs) || readDateMs(source.createdAt),
      updatedAtMs: readNumber(source.updatedAtMs),
      memberCount: readNumber(source.memberCount) || readNumber(source.membershipCount) || 1,
      likeCount: readNumber(source.likeCount) || readNumber(source.membershipLikes) || 0,
      postCount: readNumber(source.postCount) || 0,
      topMembers: this.normalizePeople(source.topMembers),
      friendMembers: this.normalizePeople(source.friendMembers),
      friendMemberCount: readNumber(source.friendMemberCount),
      membershipState: finalMembershipState,
      viewerRole: finalViewerRole,
      isLikedByViewer: readBoolean(source.isLikedByViewer),
      permissions: {
        canView: isOwner || (permissionSource.canView !== undefined ? readBoolean(permissionSource.canView) : hasAccess),
        canJoin: isOwner ? false : (permissionSource.canJoin !== undefined ? readBoolean(permissionSource.canJoin) : Boolean(viewerId && !isPrivate && !isMember && !isBanned)),
        canRequestAccess: isOwner ? false : (permissionSource.canRequestAccess !== undefined ? readBoolean(permissionSource.canRequestAccess) : Boolean(viewerId && isPrivate && !isMember && finalMembershipState !== 'pending' && !isBanned)),
        canCancelRequest: isOwner ? false : (permissionSource.canCancelRequest !== undefined ? readBoolean(permissionSource.canCancelRequest) : finalMembershipState === 'pending'),
        canLeave: isOwner ? false : (permissionSource.canLeave !== undefined ? readBoolean(permissionSource.canLeave) : (isMember && !isOwner)),
        canPost: isOwner ? true : (permissionSource.canPost !== undefined ? readBoolean(permissionSource.canPost) : (hasAccess && (postingPermission === 'everyone' || isMember))),
        canHostEvent: isOwner ? true : (permissionSource.canHostEvent !== undefined ? readBoolean(permissionSource.canHostEvent) : (hasAccess && (postingPermission === 'everyone' || isMember))),
        canCreatePoll: isOwner ? true : (permissionSource.canCreatePoll !== undefined ? readBoolean(permissionSource.canCreatePoll) : (hasAccess && (postingPermission === 'everyone' || isMember))),
        canInvite: isOwner ? true : (permissionSource.canInvite !== undefined ? readBoolean(permissionSource.canInvite) : (hasAccess && isMember)),
        canEdit: isOwner ? true : (permissionSource.canEdit !== undefined ? readBoolean(permissionSource.canEdit) : (finalViewerRole === 'admin')),
        canDelete: isOwner ? true : (permissionSource.canDelete !== undefined ? readBoolean(permissionSource.canDelete) : false),
        canManageMembers: isOwner ? true : (permissionSource.canManageMembers !== undefined ? readBoolean(permissionSource.canManageMembers) : (finalViewerRole === 'admin')),
        canModerate: isOwner ? true : (permissionSource.canModerate !== undefined ? readBoolean(permissionSource.canModerate) : (finalViewerRole === 'admin' || finalViewerRole === 'moderator')),
        canReport: isOwner ? false : (permissionSource.canReport !== undefined ? readBoolean(permissionSource.canReport) : Boolean(viewerId && !isOwner)),
      },
    };
  }

  private normalizePeople(value: unknown): CommunityCardModel['topMembers'] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): CommunityCardModel['topMembers'] => {
      if (typeof item !== 'object' || item === null) return [];
      const person = item as PersonSource;
      const userId = readString(person.userId);
      if (!userId) return [];
      return [{ userId, firstName: readString(person.firstName), lastName: readString(person.lastName), userName: readString(person.userName), profilePicture: readString(person.profilePicture) || null }];
    });
  }
}
