import { collection, getDocs, orderBy, query as firestoreQuery } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { communityDataService, type CommunityMembershipAction } from './CommunityDataService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import type { ResourcePriority } from '@/lib/types/resourceState';
import type {
  CommunityCardModel,
  CommunityCapabilities,
  CommunityCategory,
  CommunityDirectoryPage,
  CommunityDirectoryQuery,
  CommunityDetailResource,
  CommunityJoinRequest,
  CommunityMember,
  CommunityMutationResult,
  CommunityPage,
  CommunityReactionResult,
  CommunityValidationResult,
  CommunityReportTarget,
  CreateCommunityInput,
  UpdateCommunityInput,
} from '@/lib/types/community';

export type CommunitySummary = CommunityCardModel;
export type { CommunityCategory, CreateCommunityInput } from '@/lib/types/community';

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


// Kept identical to Ourlime-Web lib/utils/communityCategories.ts.
const DEFAULT_COMMUNITY_CATEGORIES: CommunityCategory[] = [
  ['arts', 'Arts'], ['business', 'Business'], ['creativity', 'Creativity'], ['education', 'Education'], ['entertainment', 'Entertainment'],
  ['general-interest', 'General Interest'], ['lifestyle', 'Lifestyle'], ['music', 'Music'], ['social', 'Social'], ['sports', 'Sports'],
].map(([id, name]) => ({ id, name, type: name, bannerImageUrl: null }));

const readString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const readBoolean = (value: unknown): boolean => value === true;
const readDateMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
};

export class CommunityService {
  private static instance: CommunityService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly data = communityDataService;

  private constructor() {}

  public static getInstance(): CommunityService {
    if (!CommunityService.instance) CommunityService.instance = new CommunityService();
    return CommunityService.instance;
  }

  public getCurrentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  public getCapabilities(viewerRole: CommunityCardModel['viewerRole'], isOwner = viewerRole === 'owner'): CommunityCapabilities {
    return {
      canEdit: isOwner || viewerRole === 'admin',
      canDelete: isOwner,
      canManageMembers: isOwner || viewerRole === 'admin',
      canModerate: isOwner || viewerRole === 'admin' || viewerRole === 'moderator',
    };
  }

  public validateCreateInput(input: CreateCommunityInput, availability: CommunityAvailability | null): CommunityValidationResult {
    if (input.title.trim().length < 3 || input.title.trim().length > 80) {
      return { valid: false, field: 'title', message: 'Community name must contain 3 to 80 characters.' };
    }
    if (input.slug.trim().length < 3) return { valid: false, field: 'slug', message: 'Choose a valid community URL.' };
    if (!availability?.nameAvailable || !availability.slugAvailable) {
      return { valid: false, field: 'availability', message: 'Choose an available community name and URL before continuing.' };
    }
    if (!input.categoryId) return { valid: false, field: 'category', message: 'Select a community category.' };
    if (!input.termsAccepted) return { valid: false, field: 'terms', message: 'Accept the community naming and impersonation terms.' };
    return { valid: true };
  }

  /** Directory page built from Firestore (port of the website's /api/communities listing). */
  public async fetchDirectory(query: CommunityDirectoryQuery, priority: ResourcePriority = 'foreground'): Promise<CommunityDirectoryPage> {
    this.logger.info('CommunityService', 'fetchDirectory:start', { scope: query.scope, sort: query.sort, hasCursor: Boolean(query.cursor), priority });
    const page = await this.data.getDirectoryPage(query);
    const result: CommunityDirectoryPage = {
      items: page.items.filter((community) => !accountLifecycleVisibilityService.isHidden(community)).map((community) => this.normalizeCommunity(community)),
      communityOfTheWeek: page.communityOfTheWeek && !accountLifecycleVisibilityService.isHidden(page.communityOfTheWeek) ? this.normalizeCommunity(page.communityOfTheWeek) : null,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      totalCount: page.totalCount,
    };
    this.logger.success('CommunityService', 'fetchDirectory', { resultCount: result.items.length, totalCount: result.totalCount });
    return result;
  }

  public async fetchCommunities(maxResults = 40): Promise<CommunitySummary[]> {
    const page = await this.fetchDirectory({ scope: 'all', visibility: 'all', categoryId: null, search: '', sort: 'popular', cursor: null, limit: Math.min(maxResults, 40) }, 'background');
    return page.items;
  }

  public async fetchCommunity(identifier: string): Promise<CommunitySummary> {
    return (await this.fetchCommunityDetail(identifier)).community;
  }

  /** Resolves a doc id or slug, like the website detail page. */
  public async fetchCommunityDetail(identifier: string): Promise<CommunityDetailResource> {
    const detail = await this.data.getCommunityDetail(identifier);
    if (!detail) throw new Error('Community not found.');
    const community = this.normalizeCommunity(detail.isBanned ? { ...detail.card, membershipState: 'banned' } : detail.card);
    return { community, rules: detail.rules.map((rule) => rule.trim()).filter(Boolean) };
  }

  /** Website fetchCommunityCategories: admin categories merged with the built-in defaults. */
  public async fetchCategories(): Promise<CommunityCategory[]> {
    let custom: CommunityCategory[] = [];
    try {
      const snapshot = await getDocs(firestoreQuery(collection(db, 'communityCategories'), orderBy('name', 'asc')));
      custom = snapshot.docs.flatMap((document): CommunityCategory[] => {
        const value = document.data();
        const id = readString(value.slug) || document.id;
        const name = readString(value.name);
        return id && name ? [{ id, name, type: name, bannerImageUrl: readString(value.bannerImageUrl) || null }] : [];
      });
    } catch (error: unknown) {
      this.logger.warn('CommunityService', 'fetchCategories:failed', { error: error instanceof Error ? error.message : String(error) });
    }
    const merged = [...custom, ...DEFAULT_COMMUNITY_CATEGORIES.filter((fallback) => !custom.some((category) => category.id === fallback.id))];
    return merged.sort((first, second) => first.name.localeCompare(second.name));
  }

  public async checkAvailability(title: string, slug: string, excludeId?: string): Promise<CommunityAvailability> {
    return this.data.checkAvailability(title, slug, excludeId);
  }

  public async joinOrRequestAccess(community: CommunitySummary): Promise<CommunityMutationResult> {
    return this.updateMembership(community.id, community.isPrivate ? 'request' : 'join', community.memberCount);
  }

  public async cancelRequest(communityId: string, currentMemberCount = 0): Promise<CommunityMutationResult> {
    return this.updateMembership(communityId, 'cancel-request', currentMemberCount);
  }

  public async leaveCommunity(communityId: string, currentMemberCount = 0): Promise<CommunityMutationResult> {
    return this.updateMembership(communityId, 'leave', currentMemberCount);
  }

  public async toggleCommunityLike(communityId: string, desiredLiked: boolean): Promise<CommunityReactionResult> {
    return this.data.toggleCommunityLike(communityId, desiredLiked);
  }

  public async createCommunity(input: CreateCommunityInput): Promise<CommunitySummary> {
    const created = await this.data.createCommunity(input, (categoryId) => DEFAULT_COMMUNITY_CATEGORIES.some((category) => category.id === categoryId));
    return this.fetchCommunity(created.id);
  }

  public async updateCommunity(communityId: string, updates: UpdateCommunityInput): Promise<CommunitySummary> {
    await this.data.updateCommunity(communityId, updates);
    return this.fetchCommunity(communityId);
  }

  public async deleteCommunity(communityId: string): Promise<void> {
    await this.data.deleteCommunity(communityId);
  }

  public async fetchMembers(communityId: string, cursor: string | null = null, search = ''): Promise<CommunityPage<CommunityMember>> {
    return this.data.fetchMembers(communityId, cursor, search);
  }

  public async fetchJoinRequests(communityId: string): Promise<CommunityPage<CommunityJoinRequest>> {
    return this.data.fetchJoinRequests(communityId);
  }

  public async reviewJoinRequest(communityId: string, requestId: string, userId: string, action: 'approve' | 'decline'): Promise<void> {
    void communityId;
    void userId;
    await this.data.reviewJoinRequest(requestId, action);
  }

  public async updateMemberRole(communityId: string, targetUserId: string, newRole: Exclude<CommunityMember['role'], 'owner' | 'none'>): Promise<void> {
    await this.data.updateMemberRole(communityId, targetUserId, newRole);
  }

  public async removeMember(communityId: string, userId: string): Promise<void> {
    await this.data.removeMember(communityId, userId, false);
  }

  public async banMember(communityId: string, userId: string): Promise<void> {
    await this.data.removeMember(communityId, userId, true);
  }

  public async reportContent(input: { communityId: string; targetId: string; targetType: CommunityReportTarget; reason: string; details?: string }): Promise<void> {
    await this.data.reportContent(input);
  }

  /**
   * Returns as soon as the membership write lands (the button stops saying "Updating…"); the new member count is
   * worked out from the current one. Screens re-fetch the community in the background to correct any drift.
   */
  private async updateMembership(communityId: string, action: CommunityMembershipAction, currentMemberCount: number): Promise<CommunityMutationResult> {
    const result = await this.data.updateMembership(communityId, action);
    const membershipState: CommunityMutationResult['membershipState'] = result === 'joined' ? 'member' : result === 'requested' ? 'pending' : 'none';
    const delta = result === 'joined' ? 1 : result === 'left' ? -1 : 0;
    this.logger.success('CommunityService', 'updateMembership', { communityId, action, result });
    return { communityId, membershipState, memberCount: Math.max(0, currentMemberCount + delta) };
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

    const capabilities = this.getCapabilities(finalViewerRole, isOwner);
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
        canEdit: capabilities.canEdit,
        canDelete: capabilities.canDelete,
        canManageMembers: capabilities.canManageMembers,
        canModerate: capabilities.canModerate,
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
