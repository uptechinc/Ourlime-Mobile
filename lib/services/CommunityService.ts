import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
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
  categoryId?: unknown;
  categoryName?: unknown;
  creatorId?: unknown;
  userId?: unknown;
  creatorName?: unknown;
  creatorUserName?: unknown;
  creatorProfilePicture?: unknown;
  creatorProfileImage?: unknown;
  isPrivate?: unknown;
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
    const response = await this.apiService.request<ApiResult<CommunityDirectoryPage>>(`/api/communities?${toQueryString(query)}`, {
      authenticated: Boolean(auth.currentUser),
      priority,
    });
    if (!response.success || !response.data) throw new Error(response.error || 'Communities could not be loaded.');
    const page: CommunityDirectoryPage = {
      items: response.data.items.map((community) => this.normalizeCommunity(community)),
      communityOfTheWeek: response.data.communityOfTheWeek ? this.normalizeCommunity(response.data.communityOfTheWeek) : null,
      nextCursor: typeof response.data.nextCursor === 'string' ? response.data.nextCursor : null,
      hasMore: response.data.hasMore === true,
      totalCount: readNumber(response.data.totalCount),
    };
    this.logger.success('CommunityService', 'fetchDirectory', { resultCount: page.items.length, totalCount: page.totalCount });
    return page;
  }

  public async fetchCommunities(maxResults = 40): Promise<CommunitySummary[]> {
    const page = await this.fetchDirectory({ scope: 'all', visibility: 'all', categoryId: null, search: '', sort: 'popular', cursor: null, limit: Math.min(maxResults, 40) }, 'background');
    return page.items;
  }

  public async fetchCommunity(identifier: string): Promise<CommunitySummary> {
    const response = await this.apiService.request<ApiResult<unknown> & { resolvedId?: string }>(`/api/communities/fetch?type=community&id=${encodeURIComponent(identifier)}`, {
      authenticated: Boolean(auth.currentUser),
    });
    if (!response.data) throw new Error(response.error || 'Community not found.');
    return this.normalizeCommunity(response.data);
  }

  public async fetchCommunityDetail(identifier: string): Promise<CommunityDetailResource> {
    const response = await this.apiService.request<ApiResult<unknown>>(`/api/communities/fetch?type=community&id=${encodeURIComponent(identifier)}`, { authenticated: Boolean(auth.currentUser) });
    if (!response.data) throw new Error(response.error || 'Community not found.');
    const source = typeof response.data === 'object' && response.data !== null ? response.data as CommunityCardSource & { rules?: unknown } : {};
    return {
      community: this.normalizeCommunity(source),
      rules: Array.isArray(source.rules) ? source.rules.filter((rule): rule is string => typeof rule === 'string' && Boolean(rule.trim())).map((rule) => rule.trim()) : [],
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
    const response = await this.apiService.request<ApiResult<CommunityReactionResult>>('/api/communities/community-like', {
      method: 'POST',
      authenticated: true,
      body: { communityId, desiredLiked },
    });
    if (!response.success || !response.data) throw new Error(response.error || 'Community like could not be updated.');
    return response.data;
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
    const response = await this.apiService.request<ApiResult<{ state: CommunityMutationResult['membershipState']; memberCount: number }>>('/api/communities/membership', {
      method: 'POST',
      authenticated: true,
      body: { communityId, action },
    });
    if (!response.success || !response.data) throw new Error(response.error || 'Community membership could not be updated.');
    return { communityId, membershipState: response.data.state, memberCount: readNumber(response.data.memberCount) };
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
    return {
      id,
      slug: readString(source.slug) || readString(source.uniqueName) || id,
      title: readString(source.title) || readString(source.name) || 'Untitled community',
      description: readString(source.description),
      imageUrl: readString(source.imageUrl) || readString(source.bannerImageUrl) || null,
      categoryId: readString(source.categoryId) || null,
      categoryName: readString(source.categoryName),
      creatorId: readString(source.creatorId) || readString(source.userId),
      creatorName: readString(source.creatorName) || 'Unknown user',
      creatorUserName: readString(source.creatorUserName),
      creatorProfilePicture: readString(source.creatorProfilePicture) || readString(source.creatorProfileImage) || null,
      isPrivate: readBoolean(source.isPrivate),
      isVerified: readBoolean(source.isVerified),
      verifiedMembersOnly: readBoolean(source.verifiedMembersOnly),
      postingPermission,
      createdAt: readString(source.createdAt) || null,
      createdAtMs: readNumber(source.createdAtMs) || readDateMs(source.createdAt),
      updatedAtMs: readNumber(source.updatedAtMs),
      memberCount: readNumber(source.memberCount) || readNumber(source.membershipCount),
      likeCount: readNumber(source.likeCount) || readNumber(source.membershipLikes),
      postCount: readNumber(source.postCount),
      topMembers: this.normalizePeople(source.topMembers),
      friendMembers: this.normalizePeople(source.friendMembers),
      friendMemberCount: readNumber(source.friendMemberCount),
      membershipState,
      viewerRole,
      isLikedByViewer: readBoolean(source.isLikedByViewer),
      permissions: {
        canView: readBoolean(permissionSource.canView),
        canJoin: readBoolean(permissionSource.canJoin),
        canRequestAccess: readBoolean(permissionSource.canRequestAccess),
        canCancelRequest: readBoolean(permissionSource.canCancelRequest),
        canLeave: readBoolean(permissionSource.canLeave),
        canPost: readBoolean(permissionSource.canPost),
        canHostEvent: readBoolean(permissionSource.canHostEvent),
        canCreatePoll: readBoolean(permissionSource.canCreatePoll),
        canInvite: readBoolean(permissionSource.canInvite),
        canEdit: readBoolean(permissionSource.canEdit),
        canDelete: readBoolean(permissionSource.canDelete),
        canManageMembers: readBoolean(permissionSource.canManageMembers),
        canModerate: readBoolean(permissionSource.canModerate),
        canReport: readBoolean(permissionSource.canReport),
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
