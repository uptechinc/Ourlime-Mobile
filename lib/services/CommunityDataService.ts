import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import { appServerService } from './AppServerService';
import type {
  CommunityCardModel,
  CommunityDashboardData,
  CommunityDirectoryPage,
  CommunityDirectoryQuery,
  CommunityJoinRequest,
  CommunityMember,
  CommunityMemberRole,
  CommunityMembershipState,
  CommunityPage,
  CommunityPermissionSet,
  CommunityPersonPreview,
  CommunityPoll,
  CommunityReactionResult,
  CommunityReportItem,
  CommunityReportStatus,
  CommunityReportTarget,
  CreateCommunityInput,
  UpdateCommunityInput,
} from '@/lib/types/community';

/** Mirrors Ourlime-Web lib/communities/serverAccess.ts. */
export type CommunityAccess = {
  communityId: string;
  communityData: DocumentData;
  viewerId: string | null;
  hasAccess: boolean;
  isOwner: boolean;
  isBanned: boolean;
  viewerRole: CommunityMemberRole;
  isSiteAdmin: boolean;
  viewerVerified: boolean;
  canManageMembers: boolean;
  canModerate: boolean;
};

export type CommunityAvailabilityResult = { nameAvailable: boolean; slugAvailable: boolean; normalizedSlug: string; suggestions: string[] };
export type CommunityMembershipAction = 'join' | 'request' | 'cancel-request' | 'leave';
export type CommunityMembershipResult = 'joined' | 'requested' | 'request-cancelled' | 'left';
export type CommunityDashboardAction = 'assign' | 'dismiss' | 'resolve' | 'hide';
export type CommunityEventRecord = {
  id: string; title: string; summary: string; description: string; startDate: string; endDate: string; location: string;
  userId: string; likeCount: number; attendeeCount: number; userRSVP: boolean; recurrence: string; image?: string;
  media: { type: 'image' | 'video'; url: string }[]; communityVariantId: string; permissions: { canEdit: boolean; canDelete: boolean };
};
export type CommunityEventInput = {
  title?: string; summary?: string; description?: string; startDate?: string; endDate?: string; location?: string;
  recurrence?: string; image?: string | null; media?: { type: 'image' | 'video'; url: string }[];
};

const FIRESTORE_IN_LIMIT = 30;
const MAX_SOURCE_COMMUNITIES = 250;
const WRITE_BATCH_LIMIT = 450;

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const readNonNegativeNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null);
const readTimestampMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};
const toIsoString = (value: unknown): string | null => {
  const millis = readTimestampMs(value);
  return millis > 0 ? new Date(millis).toISOString() : null;
};
const chunk = <TValue>(values: TValue[], size = FIRESTORE_IN_LIMIT): TValue[][] => {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
};
const toSlug = (value: string): string => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const encodeCursor = (offset: number): string => String(offset);
const decodeCursor = (cursor: string | null): number => {
  const offset = Number(cursor);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
};
const personName = (user: DocumentData | undefined, fallback: string): string =>
  `${readString(user?.firstName)} ${readString(user?.lastName)}`.trim() || readString(user?.userName) || fallback;

/**
 * Communities for the app, reading and writing Firestore directly. Each method ports the logic of
 * the matching Ourlime-Web /api/communities route (the app never calls the website's API).
 * Emails that the website sends (declined request, removed member) are not sent from the app.
 */
export class CommunityDataService {
  private static instance: CommunityDataService;

  private constructor() {}

  public static getInstance(): CommunityDataService {
    if (!CommunityDataService.instance) CommunityDataService.instance = new CommunityDataService();
    return CommunityDataService.instance;
  }

  private viewerId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  private requireViewerId(): string {
    const viewerId = this.viewerId();
    if (!viewerId) throw new Error('You must be signed in.');
    return viewerId;
  }

  // ── Access (web serverAccess.ts) ──

  public async resolveAccess(requestedId: string): Promise<CommunityAccess | null> {
    let snapshot = await getDoc(doc(db, 'communityVariant', requestedId));
    let communityId = requestedId;
    if (!snapshot.exists()) {
      const byName = await getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', requestedId), limit(1)));
      if (byName.empty) return null;
      communityId = byName.docs[0].id;
      snapshot = await getDoc(byName.docs[0].ref);
    }
    const communityData = snapshot.data() ?? {};
    const viewerId = this.viewerId();
    const isOwner = Boolean(viewerId && communityData.userId === viewerId);
    let hasAccess = !communityData.isPrivate || isOwner;
    let isBanned = false;
    let viewerRole: CommunityMemberRole = isOwner ? 'owner' : 'none';
    let isSiteAdmin = false;
    let viewerVerified = false;
    if (viewerId) {
      const [bans, memberships, viewer] = await Promise.all([
        getDocs(query(collection(db, 'bannedCommunityMembers'), where('communityVariantId', '==', communityId), where('userId', '==', viewerId), limit(1))),
        getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', communityId), where('userId', '==', viewerId), where('isMember', '==', true), limit(1))),
        getDoc(doc(db, 'users', viewerId)),
      ]);
      isBanned = !bans.empty;
      const membership = memberships.docs[0]?.data();
      viewerRole = isOwner ? 'owner' : membership?.role === 'admin' || membership?.isAdmin === true ? 'admin' : membership?.role === 'moderator' ? 'moderator' : membership ? 'member' : 'none';
      const viewerData = viewer.data() ?? {};
      isSiteAdmin = viewerData.isAdmin === true || viewerData.role === 'admin' || viewerData.accountType === 'admin';
      viewerVerified = viewerData.isVerified === true || viewerData.identityVerified === true || viewerData.verificationStatus === 'verified';
      hasAccess = !isBanned && (hasAccess || Boolean(membership));
    }
    const canManageMembers = isOwner || viewerRole === 'admin';
    return { communityId, communityData, viewerId, hasAccess, isOwner, isBanned, viewerRole, isSiteAdmin, viewerVerified, canManageMembers, canModerate: canManageMembers || viewerRole === 'moderator' };
  }

  public canCreateContent(access: CommunityAccess | null): boolean {
    if (!access?.viewerId || !access.hasAccess || access.isBanned) return false;
    if (access.communityData.verifiedMembersOnly === true && !access.viewerVerified) return false;
    if (access.isOwner) return true;
    const permission = readString(access.communityData.postingPermission) || 'members';
    if (permission === 'everyone') return true;
    if (permission === 'owner') return false;
    if (permission === 'admins') return access.viewerRole === 'admin' || access.viewerRole === 'moderator';
    return access.viewerRole === 'member' || access.viewerRole === 'admin' || access.viewerRole === 'moderator';
  }

  private async requireAccess(communityId: string): Promise<CommunityAccess> {
    const access = await this.resolveAccess(communityId);
    if (!access) throw new Error('Community not found.');
    return access;
  }

  // ── Directory (web communityDirectoryServer.ts) ──

  public async getDirectoryPage(directoryQuery: CommunityDirectoryQuery & { identifier?: string }): Promise<CommunityDirectoryPage> {
    const viewerId = this.viewerId();
    const source = await getDocs(query(collection(db, 'communityVariant'), limit(MAX_SOURCE_COMMUNITIES)));
    const sourceDocuments = source.docs.filter((document) => {
      const data = document.data();
      return data.isDeleted !== true && readString(data.status) !== 'deleted' && !data.accountLifecycleHiddenAt;
    });
    if (sourceDocuments.length === 0) return { items: [], communityOfTheWeek: null, nextCursor: null, hasMore: false, totalCount: 0 };
    const communityIds = sourceDocuments.map((document) => document.id);

    const [countDocuments, memberships, friendIds, requests, bans, viewerDocument] = await Promise.all([
      Promise.all(communityIds.map((communityId) => getDoc(doc(db, 'communityVariantMembershipAndLikeCount', communityId)))),
      this.loadMemberships(communityIds),
      this.loadFriendIds(viewerId),
      viewerId ? getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId))) : Promise.resolve(null),
      viewerId ? getDocs(query(collection(db, 'bannedCommunityMembers'), where('userId', '==', viewerId))) : Promise.resolve(null),
      viewerId ? getDoc(doc(db, 'users', viewerId)) : Promise.resolve(null),
    ]);
    const membershipsByCommunity = new Map<string, DocumentData[]>();
    memberships.forEach((membership) => {
      const communityId = readString(membership.communityVariantId);
      if (communityId) membershipsByCommunity.set(communityId, [...(membershipsByCommunity.get(communityId) ?? []), membership]);
    });
    const requestStatus = new Map<string, string>();
    requests?.docs.forEach((document) => requestStatus.set(readString(document.data().communityVariantId), readString(document.data().status)));
    const bannedIds = new Set((bans?.docs ?? []).map((document) => readString(document.data().communityVariantId)).filter(Boolean));
    const countByCommunity = new Map(countDocuments.map((document) => [document.id, document.data()]));
    const creatorIds = sourceDocuments.map((document) => readString(document.data().userId)).filter(Boolean);
    const memberUserIds = memberships.filter((membership) => membership.isMember === true).map((membership) => readString(membership.userId)).filter(Boolean);
    const userIds = [...new Set([...creatorIds, ...memberUserIds])];
    const [users, pictures] = await Promise.all([this.loadUsers(userIds), this.loadProfilePictures(userIds)]);
    const viewerData = viewerDocument?.data();
    const viewerVerified = viewerData?.isVerified === true || viewerData?.identityVerified === true || readString(viewerData?.verificationStatus).toLowerCase() === 'verified';

    const missingPostCounts = sourceDocuments.filter((document) => readNonNegativeNumber(countByCommunity.get(document.id)?.postCount) === null).map((document) => document.id);
    const postCounts = new Map<string, number>(await Promise.all(missingPostCounts.map(async (communityId): Promise<[string, number]> => {
      const counted = await getCountFromServer(query(collection(db, 'communityVariantDetails'), where('communityVariantId', '==', communityId))).catch(() => null);
      return [communityId, counted?.data().count ?? 0];
    })));

    const cards = sourceDocuments.map((document): CommunityCardModel => {
      const data = document.data();
      const activeMemberships = (membershipsByCommunity.get(document.id) ?? []).filter((membership) => membership.isMember === true);
      const activeMemberIds = [...new Set(activeMemberships.map((membership) => readString(membership.userId)).filter(Boolean))];
      const viewerMembership = activeMemberships.find((membership) => readString(membership.userId) === viewerId);
      const creatorId = readString(data.userId);
      const isOwner = Boolean(viewerId && creatorId === viewerId);
      const isMember = isOwner || Boolean(viewerMembership);
      const isBanned = bannedIds.has(document.id);
      const status = requestStatus.get(document.id) ?? '';
      const isPrivate = data.isPrivate === true || readString(data.privacy) === 'private';
      const viewerRole = this.resolveRole(viewerMembership, isOwner);
      const countData = countByCommunity.get(document.id);
      const storedMemberCount = readNonNegativeNumber(countData?.membershipCount);
      const derivedMemberCount = activeMemberIds.length + (creatorId && !activeMemberIds.includes(creatorId) ? 1 : 0);
      const memberCount = storedMemberCount === null || (storedMemberCount === 0 && derivedMemberCount > 0) ? derivedMemberCount : storedMemberCount;
      const postingValue = readString(data.postingPermission);
      const postingPermission: CommunityCardModel['postingPermission'] = postingValue === 'everyone' || postingValue === 'admins' || postingValue === 'owner' ? postingValue : 'members';
      const topMemberIds = [...new Set([creatorId, ...activeMemberIds].filter(Boolean))].slice(0, 3);
      const friendMemberIds = activeMemberIds.filter((userId) => friendIds.has(userId));
      const creator = this.personPreview(creatorId, users, pictures);
      const userLikes = Array.isArray(countData?.userLikes) ? countData.userLikes.filter((userId: unknown): userId is string => typeof userId === 'string') : [];
      const membershipState: CommunityMembershipState = isBanned ? 'banned' : isOwner ? 'owner' : isMember ? 'member' : status === 'pending' ? 'pending' : status === 'declined' ? 'declined' : 'none';
      return {
        id: document.id,
        slug: readString(data.uniqueName) || document.id,
        title: readString(data.title) || readString(data.name) || 'Untitled community',
        description: readString(data.description),
        imageUrl: readString(data.bannerImageUrl) || readString(data.imageUrl) || readString(data.coverImage) || null,
        categoryId: readString(data.categoryId) || null,
        categoryName: '',
        creatorId,
        creatorName: `${creator.firstName} ${creator.lastName}`.trim() || creator.userName || 'Unknown user',
        creatorUserName: creator.userName,
        creatorProfilePicture: creator.profilePicture,
        isPrivate,
        isVerified: data.isVerified === true,
        verifiedMembersOnly: data.verifiedMembersOnly === true,
        postingPermission,
        createdAt: toIsoString(data.createdAt),
        createdAtMs: readTimestampMs(data.createdAt),
        updatedAtMs: readTimestampMs(data.updatedAt) || readTimestampMs(data.createdAt),
        memberCount,
        likeCount: readNonNegativeNumber(countData?.membershipLikes) ?? 0,
        postCount: readNonNegativeNumber(countData?.postCount) ?? postCounts.get(document.id) ?? 0,
        topMembers: topMemberIds.map((userId) => this.personPreview(userId, users, pictures)),
        friendMembers: friendMemberIds.slice(0, 3).map((userId) => this.personPreview(userId, users, pictures)),
        friendMemberCount: friendMemberIds.length,
        membershipState,
        viewerRole,
        isLikedByViewer: Boolean(viewerId && userLikes.includes(viewerId)),
        permissions: this.resolvePermissions({
          hasAccess: !isBanned && (!isPrivate || isMember || isOwner),
          isOwner, isBanned, isMember, isPrivate, isPending: status === 'pending', viewerRole, postingPermission,
          viewerId, viewerVerified, verifiedMembersOnly: data.verifiedMembersOnly === true,
        }),
      };
    });

    const categoryIds = [...new Set(cards.map((card) => card.categoryId).filter((categoryId): categoryId is string => Boolean(categoryId)))];
    const categoryDocuments = await Promise.all(categoryIds.map((categoryId) => getDoc(doc(db, 'communityCategories', categoryId)).catch(() => null)));
    const categoryNames = new Map(categoryDocuments.flatMap((document) => (document ? [[document.id, readString(document.data()?.name) || readString(document.data()?.type)] as [string, string]] : [])));
    const hydrated = cards.map((card) => ({ ...card, categoryName: card.categoryId ? categoryNames.get(card.categoryId) ?? '' : '' }));
    const weekScore = (card: CommunityCardModel) => card.likeCount * 3 + card.memberCount * 2 + card.postCount * 5;
    const communityOfTheWeek = [...hydrated].sort((first, second) => weekScore(second) - weekScore(first))[0] ?? null;

    const search = directoryQuery.search.trim().toLowerCase();
    const filtered = hydrated.filter((card) => {
      if (directoryQuery.identifier && card.id !== directoryQuery.identifier && card.slug !== directoryQuery.identifier) return false;
      if (directoryQuery.scope === 'joined' && card.membershipState !== 'member' && card.membershipState !== 'owner') return false;
      if (directoryQuery.scope === 'friends' && card.friendMemberCount === 0) return false;
      if (directoryQuery.scope === 'created' && card.creatorId !== viewerId) return false;
      if (directoryQuery.visibility === 'public' && card.isPrivate) return false;
      if (directoryQuery.visibility === 'private' && !card.isPrivate) return false;
      if (directoryQuery.categoryId && card.categoryId !== directoryQuery.categoryId) return false;
      return !search || `${card.title} ${card.description} ${card.categoryName}`.toLowerCase().includes(search);
    }).sort((first, second) => {
      if (directoryQuery.scope === 'new' || directoryQuery.sort === 'newest') return second.createdAtMs - first.createdAtMs;
      if (directoryQuery.sort === 'active') return second.postCount - first.postCount || second.updatedAtMs - first.updatedAtMs;
      if (directoryQuery.sort === 'trending') return (second.likeCount * 2 + second.memberCount + second.postCount * 3) - (first.likeCount * 2 + first.memberCount + first.postCount * 3);
      return second.memberCount - first.memberCount || second.likeCount - first.likeCount;
    });
    const offset = decodeCursor(directoryQuery.cursor);
    const items = filtered.slice(offset, offset + directoryQuery.limit);
    const nextOffset = offset + items.length;
    return { items, communityOfTheWeek, nextCursor: nextOffset < filtered.length ? encodeCursor(nextOffset) : null, hasMore: nextOffset < filtered.length, totalCount: filtered.length };
  }

  /** Web fetch?type=community: the card (redacted when the viewer has no access) plus rules. */
  public async getCommunityDetail(identifier: string): Promise<{ card: CommunityCardModel; rules: string[]; isBanned: boolean } | null> {
    const access = await this.resolveAccess(identifier);
    if (!access) return null;
    const page = await this.getDirectoryPage({ scope: 'all', visibility: 'all', categoryId: null, search: '', sort: 'popular', cursor: null, limit: 1, identifier: access.communityId });
    const card = page.items[0];
    if (!card) return null;
    const rules = access.hasAccess && Array.isArray(access.communityData.rules)
      ? access.communityData.rules.filter((rule: unknown): rule is string => typeof rule === 'string')
      : [];
    return { card, rules, isBanned: access.isBanned };
  }

  private resolveRole(membership: DocumentData | undefined, isOwner: boolean): CommunityMemberRole {
    if (isOwner) return 'owner';
    const role = readString(membership?.role).toLowerCase();
    if (role === 'admin' || membership?.isAdmin === true) return 'admin';
    if (role === 'moderator') return 'moderator';
    return membership?.isMember === true ? 'member' : 'none';
  }

  private resolvePermissions(options: {
    hasAccess: boolean; isOwner: boolean; isBanned: boolean; isMember: boolean; isPrivate: boolean; isPending: boolean;
    viewerRole: CommunityMemberRole; postingPermission: CommunityCardModel['postingPermission']; viewerId: string | null;
    viewerVerified: boolean; verifiedMembersOnly: boolean;
  }): CommunityPermissionSet {
    const isManager = options.isOwner || options.viewerRole === 'admin' || options.viewerRole === 'moderator';
    const meetsVerification = !options.verifiedMembersOnly || options.viewerVerified;
    const canPost = options.hasAccess && meetsVerification && (
      options.postingPermission === 'everyone'
      || (options.postingPermission === 'members' && (options.isMember || isManager))
      || (options.postingPermission === 'admins' && isManager)
      || (options.postingPermission === 'owner' && options.isOwner)
    );
    return {
      canView: options.hasAccess,
      canJoin: Boolean(options.viewerId && !options.isPrivate && !options.isMember && !options.isBanned),
      canRequestAccess: Boolean(options.viewerId && options.isPrivate && !options.isMember && !options.isPending && !options.isBanned && meetsVerification),
      canCancelRequest: options.isPending,
      canLeave: options.isMember && !options.isOwner,
      canPost,
      canHostEvent: canPost,
      canCreatePoll: canPost,
      canInvite: options.hasAccess && (options.isMember || isManager),
      canEdit: options.isOwner || options.viewerRole === 'admin',
      canDelete: options.isOwner,
      canManageMembers: options.isOwner || options.viewerRole === 'admin',
      canModerate: isManager,
      canReport: Boolean(options.viewerId && !options.isOwner),
    };
  }

  private async loadMemberships(communityIds: string[]): Promise<DocumentData[]> {
    const snapshots = await Promise.all(chunk(communityIds).map((ids) => getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', 'in', ids)))));
    return snapshots.flatMap((snapshot) => snapshot.docs.map((document) => document.data()));
  }

  private async loadFriendIds(viewerId: string | null): Promise<Set<string>> {
    if (!viewerId) return new Set();
    const [asFirst, asSecond] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', viewerId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', viewerId), where('friendshipStatus', '==', 'accepted'))),
    ]);
    const friendIds = new Set<string>();
    asFirst.docs.forEach((document) => { const friendId = readString(document.data().userId2); if (friendId) friendIds.add(friendId); });
    asSecond.docs.forEach((document) => { const friendId = readString(document.data().userId1); if (friendId) friendIds.add(friendId); });
    return friendIds;
  }

  private async loadUsers(userIds: string[]): Promise<Map<string, DocumentData>> {
    const snapshots = await Promise.all(userIds.map((userId) => getDoc(doc(db, 'users', userId)).catch(() => null)));
    return new Map(snapshots.flatMap((snapshot) => (snapshot?.exists() ? [[snapshot.id, snapshot.data()] as [string, DocumentData]] : [])));
  }

  /** Web loadCommunityProfilePictures: the selected profile image per user. */
  public async loadProfilePictures(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const selections = await Promise.all(chunk(userIds).map((ids) => getDocs(query(collection(db, 'profileImageSetAs'), where('userId', 'in', ids), where('setAs', '==', 'profile')))));
    const ownerByImage = new Map<string, string>();
    selections.forEach((snapshot) => snapshot.docs.forEach((document) => {
      const imageId = readString(document.data().profileImageId);
      const userId = readString(document.data().userId);
      if (imageId && userId) ownerByImage.set(imageId, userId);
    }));
    const images = await Promise.all([...ownerByImage.keys()].map((imageId) => getDoc(doc(db, 'profileImages', imageId)).catch(() => null)));
    const pictures = new Map<string, string>();
    images.forEach((image) => {
      const userId = image ? ownerByImage.get(image.id) : undefined;
      const url = readString(image?.data()?.imageURL);
      if (userId && url) pictures.set(userId, url);
    });
    return pictures;
  }

  private personPreview(userId: string, users: Map<string, DocumentData>, pictures: Map<string, string>): CommunityPersonPreview {
    const user = users.get(userId);
    return {
      userId,
      firstName: readString(user?.firstName),
      lastName: readString(user?.lastName),
      userName: readString(user?.userName),
      profilePicture: pictures.get(userId) || readString(user?.profilePicture) || readString(user?.profileImage) || readString(user?.avatar) || readString(user?.photoURL) || null,
    };
  }

  // ── Create / availability / edit / delete ──

  public async checkAvailability(title: string, slugInput: string, excludeId?: string): Promise<CommunityAvailabilityResult> {
    const requestedTitle = title.trim();
    const requestedSlug = toSlug(slugInput.trim() || requestedTitle);
    if (!requestedSlug) return { nameAvailable: requestedTitle.length >= 3, slugAvailable: false, normalizedSlug: '', suggestions: [] };
    const [slugMatch, titleMatch] = await Promise.all([
      getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', requestedSlug), limit(1))),
      requestedTitle ? getDocs(query(collection(db, 'communityVariant'), where('titleLower', '==', requestedTitle.toLowerCase()), limit(1))) : Promise.resolve(null),
    ]);
    const suffix = Math.floor(100 + Math.random() * 900);
    return {
      nameAvailable: requestedTitle.length >= 3 && Boolean(titleMatch?.empty || titleMatch?.docs[0]?.id === excludeId),
      slugAvailable: slugMatch.empty || slugMatch.docs[0]?.id === excludeId,
      normalizedSlug: requestedSlug,
      suggestions: slugMatch.empty ? [] : [`${requestedSlug}-${suffix}`, `${requestedSlug}-community`],
    };
  }

  /** Web POST /api/communities. */
  public async createCommunity(input: CreateCommunityInput, isKnownCategory: (categoryId: string) => boolean): Promise<{ id: string; slug: string }> {
    const viewerId = this.requireViewerId();
    const title = input.title.trim();
    const description = input.description.trim();
    const slug = toSlug(input.slug.trim() || title);
    if (title.length < 3 || title.length > 80) throw new Error('Community name must contain 3 to 80 characters.');
    if (description.length > 300) throw new Error('Community description must contain at most 300 characters.');
    if (slug.length < 3) throw new Error('Choose a valid community URL.');
    if (!input.termsAccepted) throw new Error('Accept the community naming and impersonation terms.');
    const [slugMatch, titleMatch, creator] = await Promise.all([
      getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', slug), limit(1))),
      getDocs(query(collection(db, 'communityVariant'), where('titleLower', '==', title.toLowerCase()), limit(1))),
      getDoc(doc(db, 'users', viewerId)),
    ]);
    if (!slugMatch.empty) throw new Error('That community URL is already in use.');
    if (!titleMatch.empty) throw new Error('A community already uses that name.');
    const categoryId = input.categoryId?.trim() || null;
    if (categoryId && !isKnownCategory(categoryId)) {
      const category = await getDoc(doc(db, 'communityCategories', categoryId));
      if (!category.exists()) throw new Error('Select a valid community category.');
    }
    const communityRef = doc(collection(db, 'communityVariant'));
    const batch = writeBatch(db);
    batch.set(communityRef, {
      title, titleLower: title.toLowerCase(), uniqueName: slug, description, categoryId,
      bannerImageUrl: input.imageUrl, imageUrl: input.imageUrl, isPrivate: input.isPrivate === true,
      verifiedMembersOnly: input.verifiedMembersOnly === true, postingPermission: input.postingPermission,
      userId: viewerId, creatorName: personName(creator.data(), 'Community owner'),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'communityVariantMembership', `${communityRef.id}_${viewerId}`), {
      userId: viewerId, communityVariantId: communityRef.id, isMember: true, role: 'admin', isAdmin: true, from: serverTimestamp(), joinedAt: serverTimestamp(), to: null,
    });
    batch.set(doc(db, 'communityVariantMembershipAndLikeCount', communityRef.id), { communityVariantId: communityRef.id, membershipCount: 1, membershipLikes: 0, postCount: 0, userLikes: [] });
    await batch.commit();
    return { id: communityRef.id, slug };
  }

  /** Web POST /api/communities/edit (owner only). */
  public async updateCommunity(communityId: string, updates: UpdateCommunityInput): Promise<void> {
    const access = await this.requireAccess(communityId);
    if (!access.viewerId || !access.isOwner) throw new Error('Community owner access required.');
    const title = updates.title === undefined ? null : updates.title.trim();
    const description = updates.description === undefined ? null : updates.description.trim();
    const slug = updates.slug === undefined ? null : toSlug(updates.slug);
    if (title !== null && (title.length < 3 || title.length > 80)) throw new Error('Community name must contain 3 to 80 characters.');
    if (description !== null && description.length > 300) throw new Error('Description must contain at most 300 characters.');
    if (slug) {
      const match = await getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', slug), limit(1)));
      if (!match.empty && match.docs[0].id !== access.communityId) throw new Error('That community URL is already in use.');
    }
    const updateData: DocumentData = { updatedAt: serverTimestamp() };
    if (title !== null) { updateData.title = title; updateData.titleLower = title.toLowerCase(); }
    if (description !== null) updateData.description = description;
    if (slug !== null) updateData.uniqueName = slug;
    if (updates.imageUrl !== undefined) { updateData.imageUrl = updates.imageUrl || null; updateData.bannerImageUrl = updates.imageUrl || null; }
    if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId || null;
    if (typeof updates.isPrivate === 'boolean') updateData.isPrivate = updates.isPrivate;
    if (typeof updates.verifiedMembersOnly === 'boolean') updateData.verifiedMembersOnly = updates.verifiedMembersOnly;
    if (updates.postingPermission) updateData.postingPermission = updates.postingPermission;
    if (updates.rules) updateData.rules = updates.rules.map((rule) => rule.trim()).filter(Boolean).slice(0, 20);
    await updateDoc(doc(db, 'communityVariant', access.communityId), updateData);
  }

  /** Web POST /api/communities/delete + CommunityDeletionService cascade (owner only). */
  public async deleteCommunity(communityId: string): Promise<number> {
    const access = await this.requireAccess(communityId);
    if (!access.viewerId || !access.isOwner) throw new Error('Community owner access required.');
    const id = access.communityId;
    const references = new Map<string, DocumentReference>();
    const add = (documents: QueryDocumentSnapshot[]) => documents.forEach((document) => references.set(document.ref.path, document.ref));
    references.set(`communityVariant/${id}`, doc(db, 'communityVariant', id));
    references.set(`communityVariantMembershipAndLikeCount/${id}`, doc(db, 'communityVariantMembershipAndLikeCount', id));
    const byField = async (collectionName: string, field: string, value: string) => (await getDocs(query(collection(db, collectionName), where(field, '==', value)))).docs;
    const byValues = async (collectionName: string, field: string, values: string[]) => (await Promise.all(chunk(values).map((ids) => getDocs(query(collection(db, collectionName), where(field, 'in', ids)))))).flatMap((snapshot) => snapshot.docs);
    const [memberships, requests, bans, posts, events, polls, reports] = await Promise.all([
      byField('communityVariantMembership', 'communityVariantId', id), byField('communityRequests', 'communityVariantId', id),
      byField('bannedCommunityMembers', 'communityVariantId', id), byField('communityVariantDetails', 'communityVariantId', id),
      byField('events', 'communityVariantId', id), byField('polls', 'communityId', id), byField('communityReports', 'communityId', id),
    ]);
    [memberships, requests, bans, posts, events, polls, reports].forEach(add);
    const postIds = posts.map((post) => post.id);
    const eventIds = events.map((event) => event.id);
    const [postMedia, postLikes, postComments, eventAttendees, eventComments] = await Promise.all([
      byValues('communityVariantDetailsSummary', 'communityVariantDetailsId', postIds), byValues('communityVariantDetailsLikes', 'postId', postIds),
      byValues('communityVariantDetailsComments', 'communityVariantDetailsId', postIds), byValues('eventAttendees', 'eventId', eventIds),
      byValues('eventVariantComments', 'eventId', eventIds),
    ]);
    [postMedia, postLikes, postComments, eventAttendees, eventComments].forEach(add);
    postIds.forEach((postId) => references.set(`communityVariantDetailsCounter/${postId}`, doc(db, 'communityVariantDetailsCounter', postId)));
    add(await byValues('communityVariantDetailsCommentsReplies', 'communityVariantDetailsCommentsId', postComments.map((comment) => comment.id)));
    const allReferences = [...references.values()];
    for (let index = 0; index < allReferences.length; index += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      allReferences.slice(index, index + WRITE_BATCH_LIMIT).forEach((reference) => batch.delete(reference));
      await batch.commit();
    }
    return allReferences.length;
  }

  // ── Membership (web /membership, /requests, /update-role, /remove-user, /ban-user) ──

  public async updateMembership(communityId: string, action: CommunityMembershipAction): Promise<CommunityMembershipResult> {
    const viewerId = this.requireViewerId();
    const communitySnap = await getDoc(doc(db, 'communityVariant', communityId));
    if (!communitySnap.exists()) throw new Error('Community not found.');
    const community = communitySnap.data();
    const isPrivate = community.isPrivate === true || community.privacy === 'private';
    if (community.userId === viewerId && action === 'leave') throw new Error('The community owner cannot leave their own community.');

    if (action === 'request') {
      if (!isPrivate) throw new Error('This community does not require approval.');
      const existing = await getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId), where('communityVariantId', '==', communityId), limit(1)));
      const requestRef = existing.docs[0]?.ref ?? doc(collection(db, 'communityRequests'));
      const wasPending = existing.docs[0]?.data().status === 'pending';
      await setDoc(requestRef, { userId: viewerId, communityVariantId: communityId, status: 'pending', requestedAt: serverTimestamp(), declinedAt: deleteField() }, { merge: true });
      if (!wasPending && readString(community.userId)) {
        const requester = (await getDoc(doc(db, 'users', viewerId))).data() ?? {};
        void notificationHelpers.addNotification({
          userId: readString(community.userId),
          type: 'community_join_request',
          title: 'New community join request',
          message: `${personName(requester, 'Someone')} requested to join ${readString(community.title) || 'your community'}.`,
          isRead: false,
          metadata: {
            sourceUserId: viewerId, communityId, requestId: requestRef.id,
            actionUrl: `/communities/${readString(community.uniqueName) || communityId}?dashboard=members`,
            communityTitle: readString(community.title),
            communityAvatar: readString(community.imageUrl) || readString(community.bannerImageUrl) || null,
            communityBanner: readString(community.bannerImageUrl) || null,
            sourceProfileImage: readString(requester.profileImage),
          },
          userDetails: { firstName: readString(requester.firstName), lastName: readString(requester.lastName), userName: readString(requester.userName), profileImage: readString(requester.profileImage) },
        }).catch(() => undefined);
      }
      return 'requested';
    }

    if (action === 'cancel-request') {
      const pending = await getDocs(query(collection(db, 'communityRequests'), where('userId', '==', viewerId), where('communityVariantId', '==', communityId), where('status', '==', 'pending')));
      if (!pending.empty) {
        const batch = writeBatch(db);
        pending.docs.forEach((request) => batch.delete(request.ref));
        await batch.commit();
      }
      return 'request-cancelled';
    }

    const memberships = await getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId), where('communityVariantId', '==', communityId), where('isMember', '==', true)));
    const countRef = doc(db, 'communityVariantMembershipAndLikeCount', communityId);
    if (action === 'join') {
      if (isPrivate) throw new Error('Request access to join this private community.');
      if (memberships.empty) {
        const batch = writeBatch(db);
        batch.set(doc(collection(db, 'communityVariantMembership')), { userId: viewerId, communityVariantId: communityId, isMember: true, role: 'member', isAdmin: false, from: serverTimestamp(), to: null });
        batch.set(countRef, { communityVariantId: communityId, membershipCount: increment(1) }, { merge: true });
        await batch.commit();
      }
      return 'joined';
    }
    if (!memberships.empty) {
      const batch = writeBatch(db);
      memberships.docs.forEach((membership) => batch.update(membership.ref, { isMember: false, to: serverTimestamp() }));
      batch.set(countRef, { membershipCount: increment(-1) }, { merge: true });
      await batch.commit();
    }
    return 'left';
  }

  public async fetchJoinRequests(communityId: string): Promise<CommunityPage<CommunityJoinRequest>> {
    const access = await this.requireAccess(communityId);
    if (!access.canManageMembers) throw new Error('Community member-management access required.');
    const requests = await getDocs(query(collection(db, 'communityRequests'), where('communityVariantId', '==', access.communityId), where('status', '==', 'pending')));
    const userIds = requests.docs.map((request) => readString(request.data().userId)).filter(Boolean);
    const [users, pictures] = await Promise.all([this.loadUsers(userIds), this.loadProfilePictures(userIds)]);
    const items = requests.docs.flatMap((request): CommunityJoinRequest[] => {
      const userId = readString(request.data().userId);
      if (!userId) return [];
      return [{ ...this.personPreview(userId, users, pictures), requestId: request.id, requestedAt: toIsoString(request.data().requestedAt), status: 'pending' }];
    });
    return { items, nextCursor: null, hasMore: false, totalCount: items.length };
  }

  /** Web reviewJoinRequestTransactional + notification (no email from the app). */
  public async reviewJoinRequest(requestId: string, action: 'approve' | 'decline'): Promise<number> {
    const requestRef = doc(db, 'communityRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('Join request not found.');
    const communityId = readString(requestSnap.data().communityVariantId);
    const userId = readString(requestSnap.data().userId);
    if (!communityId || !userId) throw new Error('Join request is invalid.');
    const access = await this.requireAccess(communityId);
    if (!access.canManageMembers) throw new Error('Community member-management access required.');

    const memberships = await getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', communityId)));
    const activeIds = new Set(memberships.docs.flatMap((membership) => (membership.data().isMember === true && readString(membership.data().userId) ? [readString(membership.data().userId)] : [])));
    const ownerId = readString(access.communityData.userId);
    if (ownerId) activeIds.add(ownerId);
    const canonicalRef = doc(db, 'communityVariantMembership', `${communityId}_${userId}`);
    const batch = writeBatch(db);
    if (action === 'approve') {
      activeIds.add(userId);
      memberships.docs.filter((membership) => membership.data().userId === userId && membership.id !== canonicalRef.id).forEach((membership) => batch.delete(membership.ref));
      batch.set(canonicalRef, { userId, communityVariantId: communityId, isMember: true, isAdmin: false, role: 'member', from: serverTimestamp(), to: null }, { merge: true });
      batch.update(requestRef, { status: 'approved', approvedAt: serverTimestamp() });
    } else {
      batch.update(requestRef, { status: 'declined', declinedAt: serverTimestamp() });
    }
    batch.set(doc(db, 'communityVariantMembershipAndLikeCount', communityId), { membershipCount: activeIds.size, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    const community = access.communityData;
    const communityTitle = readString(community.title) || 'Community';
    void notificationHelpers.addNotification({
      userId,
      type: action === 'approve' ? 'community_accepted' : 'community_rejected',
      title: action === 'approve' ? 'Join Request Accepted' : 'Join Request Declined',
      message: action === 'approve' ? `Your request to join "${communityTitle}" has been accepted!` : `Your request to join "${communityTitle}" has been declined.`,
      isRead: false,
      metadata: {
        communityId, actionUrl: `/communities/${readString(community.uniqueName) || communityId}`, communityTitle,
        communityAvatar: readString(community.imageUrl) || readString(community.bannerImageUrl) || null,
        communityBanner: readString(community.bannerImageUrl) || null,
      },
    }).catch(() => undefined);
    if (action === 'decline') void appServerService.call('sendCommunityMemberEmail', { communityId, userId, kind: 'declined' }).catch(() => undefined);
    return activeIds.size;
  }

  public async updateMemberRole(communityId: string, targetUserId: string, newRole: 'admin' | 'moderator' | 'member'): Promise<void> {
    const access = await this.requireAccess(communityId);
    if (!access.isOwner || !access.viewerId) throw new Error('Community owner access required.');
    if (targetUserId === access.viewerId) throw new Error('The community owner role cannot be changed.');
    const memberships = await getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', access.communityId), where('userId', '==', targetUserId), where('isMember', '==', true)));
    if (memberships.empty) throw new Error('User is not an active community member.');
    const batch = writeBatch(db);
    memberships.docs.forEach((membership) => batch.set(membership.ref, { role: newRole, isAdmin: newRole === 'admin' }, { merge: true }));
    await batch.commit();
  }

  /** Web removeCommunityMemberTransactional (+ ban record when banning) and the removal notification. */
  public async removeMember(communityId: string, userId: string, ban: boolean): Promise<number> {
    const access = await this.requireAccess(communityId);
    if (ban ? !access.canModerate : !access.canManageMembers) throw new Error(ban ? 'Community moderation access required.' : 'Community member-management access required.');
    if (!access.viewerId) throw new Error('You must be signed in.');
    const id = access.communityId;
    const [memberships, posts] = await Promise.all([
      getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', id))),
      getDocs(query(collection(db, 'communityVariantDetails'), where('communityVariantId', '==', id), where('userId', '==', userId))),
    ]);
    const activeIds = new Set(memberships.docs.flatMap((membership) => (membership.data().isMember === true && readString(membership.data().userId) ? [readString(membership.data().userId)] : [])));
    const ownerId = readString(access.communityData.userId);
    if (ownerId) activeIds.add(ownerId);
    activeIds.delete(userId);
    const batch = writeBatch(db);
    memberships.docs.filter((membership) => membership.data().userId === userId).forEach((membership) => batch.delete(membership.ref));
    posts.docs.forEach((post) => batch.delete(post.ref));
    batch.set(doc(db, 'communityVariantMembershipAndLikeCount', id), { membershipCount: activeIds.size, updatedAt: serverTimestamp() }, { merge: true });
    if (ban) batch.set(doc(db, 'bannedCommunityMembers', `${id}_${userId}`), { communityVariantId: id, userId, bannedBy: access.viewerId, bannedAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    const communityTitle = readString(access.communityData.title) || 'Community';
    void notificationHelpers.addNotification({
      userId,
      type: 'community_removed',
      title: 'Removed from Community',
      message: `You have been removed from the community "${communityTitle}".`,
      isRead: false,
      metadata: { communityId: id, actionUrl: `/communities/${readString(access.communityData.uniqueName) || id}` },
    }).catch(() => undefined);
    void appServerService.call('sendCommunityMemberEmail', { communityId: id, userId, kind: 'removed' }).catch(() => undefined);
    return activeIds.size;
  }

  // ── Likes, members, reports ──

  public async toggleCommunityLike(communityId: string, desiredLiked: boolean): Promise<CommunityReactionResult> {
    const viewerId = this.requireViewerId();
    const communityRef = doc(db, 'communityVariant', communityId);
    const countRef = doc(db, 'communityVariantMembershipAndLikeCount', communityId);
    return runTransaction(db, async (transaction) => {
      const [community, counts] = await Promise.all([transaction.get(communityRef), transaction.get(countRef)]);
      if (!community.exists()) throw new Error('Community not found.');
      const existing = Array.isArray(counts.data()?.userLikes) ? (counts.data()?.userLikes as unknown[]).filter((userId): userId is string => typeof userId === 'string') : [];
      const likes = new Set(existing);
      if (desiredLiked) likes.add(viewerId); else likes.delete(viewerId);
      const userLikes = [...likes];
      transaction.set(countRef, { communityVariantId: communityId, membershipLikes: userLikes.length, userLikes }, { merge: true });
      return { liked: likes.has(viewerId), likeCount: userLikes.length };
    });
  }

  /** Web GET /api/communities/members. */
  public async fetchMembers(communityId: string, cursor: string | null, search: string, pageSize = 30): Promise<CommunityPage<CommunityMember>> {
    const access = await this.requireAccess(communityId);
    if (!access.hasAccess) throw new Error('Community access required.');
    const [membershipSnap, friendIds] = await Promise.all([
      getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', access.communityId), where('isMember', '==', true))),
      this.loadFriendIds(access.viewerId),
    ]);
    const byUser = new Map<string, QueryDocumentSnapshot>();
    membershipSnap.docs.forEach((membership) => { const userId = readString(membership.data().userId); if (userId && !byUser.has(userId)) byUser.set(userId, membership); });
    const users = await this.loadUsers([...byUser.keys()]);
    const needle = search.trim().toLowerCase().slice(0, 100);
    const searchable = [...byUser.entries()].filter(([userId]) => {
      const user = users.get(userId);
      return user && (!needle || `${readString(user.firstName)} ${readString(user.lastName)} ${readString(user.userName)}`.toLowerCase().includes(needle));
    });
    const offset = decodeCursor(cursor);
    const visible = searchable.slice(offset, offset + pageSize);
    const pictures = await this.loadProfilePictures(visible.map(([userId]) => userId));
    const now = Date.now();
    const items = visible.map(([userId, membership]): CommunityMember => {
      const data = membership.data();
      const user = users.get(userId) ?? {};
      const role: CommunityMemberRole = userId === access.communityData.userId ? 'owner' : data.role === 'admin' || data.isAdmin === true ? 'admin' : data.role === 'moderator' ? 'moderator' : 'member';
      const lastActiveMs = readTimestampMs(user.lastActive);
      return {
        ...this.personPreview(userId, users, pictures),
        membershipId: membership.id,
        role,
        joinedAt: toIsoString(data.from) ?? toIsoString(data.joinedAt),
        isFriend: friendIds.has(userId),
        isOnline: user.onlineStatus === 'online' && lastActiveMs > 0 && now - lastActiveMs < 120_000,
        permissions: { canPromote: access.isOwner, canDemote: access.isOwner, canRemove: access.canManageMembers && role !== 'owner', canBan: access.canModerate && role !== 'owner' },
      };
    });
    const nextOffset = offset + items.length;
    return { items, nextCursor: nextOffset < searchable.length ? encodeCursor(nextOffset) : null, hasMore: nextOffset < searchable.length, totalCount: searchable.length };
  }

  /** Web POST /api/communities/reports (one open report per user and target). */
  public async reportContent(input: { communityId: string; targetId: string; targetType: CommunityReportTarget; reason: string; details?: string }): Promise<{ reportId: string; alreadyReported: boolean }> {
    const viewerId = this.requireViewerId();
    const reason = input.reason.trim().slice(0, 200);
    if (!input.targetId || !reason) throw new Error('Community, content, and report reason are required.');
    const access = await this.requireAccess(input.communityId);
    if (!access.hasAccess || access.isBanned) throw new Error('Community access required.');
    const collectionName = input.targetType === 'event' ? 'events' : input.targetType === 'poll' ? 'polls' : 'communityVariantDetails';
    const target = await getDoc(doc(db, collectionName, input.targetId));
    const targetCommunityId = readString(target.data()?.communityId) || readString(target.data()?.communityVariantId);
    if (!target.exists() || targetCommunityId !== access.communityId) throw new Error('Reported community content was not found.');
    const reportId = `${access.communityId}_${input.targetType}_${input.targetId}_${viewerId}`;
    const reportRef = doc(db, 'communityReports', reportId);
    const existing = await getDoc(reportRef);
    if (existing.exists() && existing.data().status !== 'resolved' && existing.data().status !== 'dismissed') return { reportId, alreadyReported: true };
    await setDoc(reportRef, {
      communityId: access.communityId, [`${input.targetType}Id`]: input.targetId, reportedBy: viewerId, reason,
      details: (input.details ?? '').trim().slice(0, 2000), status: 'pending', reportedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { reportId, alreadyReported: false };
  }

  // ── Dashboard (web /api/communities/dashboard) ──

  public async getDashboard(communityId: string): Promise<CommunityDashboardData> {
    const access = await this.requireAccess(communityId);
    if (!access.viewerId || !access.canModerate) throw new Error('Community moderation access required.');
    const id = access.communityId;
    const [members, requests, posts, events, polls, reports] = await Promise.all([
      getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', id), where('isMember', '==', true))),
      getDocs(query(collection(db, 'communityRequests'), where('communityVariantId', '==', id), where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'communityVariantDetails'), where('communityVariantId', '==', id), limit(100))),
      getDocs(query(collection(db, 'events'), where('communityVariantId', '==', id), limit(100))),
      getDocs(query(collection(db, 'polls'), where('communityId', '==', id), limit(100))),
      getDocs(query(collection(db, 'communityReports'), where('communityId', '==', id), limit(100))),
    ]);
    const userIds = new Set<string>();
    const rawActivities = [
      ...posts.docs.map((document) => ({ id: document.id, type: 'post' as const, source: document.data() })),
      ...events.docs.map((document) => ({ id: document.id, type: 'event' as const, source: document.data() })),
      ...polls.docs.map((document) => ({ id: document.id, type: 'poll' as const, source: document.data() })),
    ].map((item) => {
      const creatorId = readString(item.source.userId) || readString(item.source.createdById) || readString(item.source.createdBy);
      if (creatorId) userIds.add(creatorId);
      return { id: item.id, type: item.type, title: String(item.source.title ?? item.source.question ?? item.source.caption ?? item.source.content ?? 'Untitled'), creatorId, createdAt: toIsoString(item.source.createdAt ?? item.source.timestamp) ?? new Date(0).toISOString() };
    });
    reports.docs.forEach((document) => { const reportedBy = readString(document.data().reportedBy); if (reportedBy) userIds.add(reportedBy); });
    const users = await this.loadUsers([...userIds]);
    const nameOf = (userId: string, fallback: string) => {
      const user = users.get(userId);
      return readString(user?.userName) || personName(user, '') || fallback;
    };
    const activities = rawActivities.map((activity) => ({ ...activity, creatorName: nameOf(activity.creatorId, 'Unknown member') })).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    const reportItems: CommunityReportItem[] = reports.docs.map((document) => {
      const source = document.data();
      const targetType: CommunityReportTarget = source.postId ? 'post' : source.eventId ? 'event' : 'poll';
      const targetId = String(source.postId ?? source.eventId ?? source.pollId ?? '');
      const status: CommunityReportStatus = source.status === 'in_review' || source.status === 'resolved' || source.status === 'dismissed' ? source.status : 'pending';
      return {
        id: document.id, targetId, targetType, title: activities.find((activity) => activity.id === targetId)?.title ?? 'Reported content',
        reportedBy: readString(source.reportedBy), reporterName: nameOf(readString(source.reportedBy), 'Community member'),
        reason: readString(source.reason), details: readString(source.details), status,
        reportedAt: toIsoString(source.reportedAt ?? source.timestamp) ?? new Date(0).toISOString(), assignedTo: readString(source.assignedTo) || null,
      };
    }).sort((first, second) => second.reportedAt.localeCompare(first.reportedAt));
    const activeMemberIds = new Set(members.docs.flatMap((document) => (readString(document.data().userId) ? [readString(document.data().userId)] : [])));
    const ownerId = readString(access.communityData.userId);
    if (ownerId) activeMemberIds.add(ownerId);
    return {
      memberCount: activeMemberIds.size, postCount: posts.size, eventCount: events.size, pollCount: polls.size, pendingRequestCount: requests.size,
      openReportCount: reportItems.filter((report) => report.status === 'pending' || report.status === 'in_review').length, activities, reports: reportItems,
    };
  }

  public async moderateReports(input: { communityId: string; reportIds: string[]; action: CommunityDashboardAction; resolutionNote?: string; targetId?: string; targetType?: CommunityReportTarget }): Promise<void> {
    const access = await this.requireAccess(input.communityId);
    if (!access.viewerId || !access.canModerate) throw new Error('Community moderation access required.');
    const reportIds = input.reportIds.slice(0, 50);
    if (!reportIds.length) throw new Error('Reports and a moderation action are required.');
    const snapshots = await Promise.all(reportIds.map((reportId) => getDoc(doc(db, 'communityReports', reportId))));
    if (snapshots.some((snapshot) => !snapshot.exists() || snapshot.data()?.communityId !== access.communityId)) throw new Error('One or more reports do not belong to this community.');
    const status: CommunityReportStatus = input.action === 'assign' ? 'in_review' : input.action === 'dismiss' ? 'dismissed' : 'resolved';
    const batch = writeBatch(db);
    snapshots.forEach((snapshot) => batch.update(snapshot.ref, {
      status, assignedTo: input.action === 'assign' ? access.viewerId : null, reviewedBy: access.viewerId,
      reviewedAt: serverTimestamp(), resolutionNote: (input.resolutionNote ?? '').trim().slice(0, 500),
    }));
    if (input.action === 'hide' && input.targetId) {
      const collectionName = input.targetType === 'event' ? 'events' : input.targetType === 'poll' ? 'polls' : 'communityVariantDetails';
      const targetRef = doc(db, collectionName, input.targetId);
      const target = await getDoc(targetRef);
      const targetCommunityId = target.data()?.communityId ?? target.data()?.communityVariantId;
      if (!target.exists() || targetCommunityId !== access.communityId) throw new Error('Reported content does not belong to this community.');
      batch.set(targetRef, { hidden: true, hiddenBy: access.viewerId, hiddenAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }

  // ── Polls (web /api/communities/polls) ──

  private async viewerRoleIn(communityId: string, viewerId: string): Promise<CommunityMemberRole> {
    const community = await getDoc(doc(db, 'communityVariant', communityId));
    if (community.data()?.userId === viewerId) return 'owner';
    const membership = await getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', communityId), where('userId', '==', viewerId), where('isMember', '==', true), limit(1)));
    if (membership.empty) return 'none';
    const data = membership.docs[0].data();
    return data.role === 'admin' || data.isAdmin === true ? 'admin' : data.role === 'moderator' ? 'moderator' : 'member';
  }

  public async fetchPolls(communityId: string): Promise<CommunityPage<CommunityPoll>> {
    const access = await this.requireAccess(communityId);
    if (!access.hasAccess) throw new Error('Community access required.');
    const polls = await getDocs(query(collection(db, 'polls'), where('communityId', '==', access.communityId)));
    const viewerRole = access.viewerId ? await this.viewerRoleIn(access.communityId, access.viewerId) : 'none';
    const now = Date.now();
    const items = polls.docs.filter((document) => document.data().hidden !== true).map((document): CommunityPoll => {
      const data = document.data();
      const responses = data.responses && typeof data.responses === 'object' ? data.responses as { [userId: string]: unknown } : {};
      const selected = access.viewerId ? responses[access.viewerId] : undefined;
      const selectedIndexes = Array.isArray(selected) ? selected.map(Number) : selected === undefined ? [] : [Number(selected)];
      const options: DocumentData[] = Array.isArray(data.options) ? data.options : [];
      const expiresAtMs = readTimestampMs(data.endTime) || readTimestampMs(data.expiresAt);
      const votes = (option: DocumentData) => Math.max(0, Math.trunc(readNonNegativeNumber(option.votes) ?? 0));
      return {
        id: document.id,
        communityId: access.communityId,
        creatorId: readString(data.createdBy),
        question: readString(data.question),
        options: options.map((option, index) => ({ id: String(index), text: readString(option.option) || readString(option.text), voteCount: votes(option), selectedByViewer: selectedIndexes.includes(index) })),
        createdAt: new Date(readTimestampMs(data.timestamp) || now).toISOString(),
        expiresAt: new Date(expiresAtMs || now).toISOString(),
        isExpired: expiresAtMs > 0 && expiresAtMs <= now,
        totalVotes: options.reduce((total, option) => total + votes(option), 0),
        allowMultiple: data.allowMultiple === true,
        permissions: {
          canVote: Boolean(access.viewerId && (!expiresAtMs || expiresAtMs > now)),
          canDelete: Boolean(access.viewerId && (data.createdBy === access.viewerId || viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'moderator')),
        },
      };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    return { items, nextCursor: null, hasMore: false, totalCount: items.length };
  }

  public async createPoll(input: { communityId: string; question: string; options: string[]; durationHours: number; allowMultiple: boolean }): Promise<string> {
    const viewerId = this.requireViewerId();
    const access = await this.requireAccess(input.communityId);
    if (!access.hasAccess) throw new Error('Community access required.');
    if (!this.canCreateContent(access)) throw new Error('You do not have permission to create polls in this community.');
    const question = input.question.trim();
    const options = input.options.map((option) => option.trim()).filter(Boolean);
    const durationHours = Math.min(Math.max(input.durationHours, 1 / 60), 24 * 30);
    if (!question || options.length < 2 || options.length > 5) throw new Error('A question and two to five options are required.');
    const poll = await addDoc(collection(db, 'polls'), {
      communityId: access.communityId, createdBy: viewerId, question, options: options.map((option) => ({ option, votes: 0 })),
      allowMultiple: input.allowMultiple === true, duration: durationHours,
      endTime: Timestamp.fromMillis(Date.now() + Math.round(durationHours * 60 * 60 * 1000)),
      timestamp: serverTimestamp(), responses: {}, responseUserNames: {},
    });
    return poll.id;
  }

  public async votePoll(communityId: string, pollId: string, optionIndex: number): Promise<void> {
    const viewerId = this.requireViewerId();
    const access = await this.requireAccess(communityId);
    if (!access.hasAccess) throw new Error('Community access required.');
    const pollRef = doc(db, 'polls', pollId);
    await runTransaction(db, async (transaction) => {
      const poll = await transaction.get(pollRef);
      if (!poll.exists() || poll.data().communityId !== access.communityId) throw new Error('Poll option not found.');
      const data = poll.data();
      const expiresAtMs = readTimestampMs(data.endTime) || readTimestampMs(data.expiresAt);
      if (expiresAtMs && expiresAtMs <= Date.now()) throw new Error('This poll has expired.');
      const options: { option: string; votes: number }[] = (Array.isArray(data.options) ? data.options : []).map((option: DocumentData) => ({ option: readString(option.option) || readString(option.text), votes: Math.max(0, Math.trunc(readNonNegativeNumber(option.votes) ?? 0)) }));
      if (!options[optionIndex]) throw new Error('Poll option not found.');
      const responses = data.responses && typeof data.responses === 'object' ? { ...(data.responses as { [userId: string]: string | string[] }) } : {};
      const previous = responses[viewerId];
      const previousIndexes = Array.isArray(previous) ? previous.map(Number) : previous === undefined ? [] : [Number(previous)];
      if (data.allowMultiple === true) {
        const nextIndexes = previousIndexes.includes(optionIndex) ? previousIndexes.filter((index) => index !== optionIndex) : [...previousIndexes, optionIndex];
        previousIndexes.forEach((index) => { if (options[index]) options[index].votes = Math.max(0, options[index].votes - 1); });
        nextIndexes.forEach((index) => { if (options[index]) options[index].votes += 1; });
        responses[viewerId] = nextIndexes.map(String);
      } else {
        if (previousIndexes.length > 0) throw new Error('You have already voted in this poll.');
        options[optionIndex].votes += 1;
        responses[viewerId] = String(optionIndex);
      }
      transaction.update(pollRef, { options, responses, updatedAt: serverTimestamp() });
    });
  }

  public async deletePoll(communityId: string, pollId: string): Promise<void> {
    const viewerId = this.requireViewerId();
    const access = await this.requireAccess(communityId);
    if (!access.hasAccess) throw new Error('Community poll not found.');
    const [poll, role] = await Promise.all([getDoc(doc(db, 'polls', pollId)), this.viewerRoleIn(access.communityId, viewerId)]);
    if (!poll.exists() || poll.data().communityId !== access.communityId) throw new Error('Community poll not found.');
    if (poll.data().createdBy !== viewerId && role !== 'owner' && role !== 'admin' && role !== 'moderator') throw new Error('You cannot delete this poll.');
    await deleteDoc(poll.ref);
  }

  // ── Events (web /api/communities/events) ──

  private readMedia(value: unknown): { type: 'image' | 'video'; url: string }[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): { type: 'image' | 'video'; url: string }[] => {
      if (!item || typeof item !== 'object') return [];
      const source = item as { type?: unknown; url?: unknown };
      const url = readString(source.url);
      return url ? [{ type: source.type === 'video' ? 'video' : 'image', url }] : [];
    }).slice(0, 10);
  }

  public async fetchEvents(communityId: string): Promise<CommunityEventRecord[]> {
    const access = await this.requireAccess(communityId);
    if (!access.hasAccess) throw new Error('Community access required.');
    const snapshot = await getDocs(query(collection(db, 'events'), where('communityVariantId', '==', access.communityId), limit(100)));
    const eventIds = snapshot.docs.map((document) => document.id);
    const attendees = (await Promise.all(chunk(eventIds).map((ids) => getDocs(query(collection(db, 'eventAttendees'), where('eventId', 'in', ids)))))).flatMap((result) => result.docs);
    const attendeeCounts = new Map<string, number>();
    const viewerEventIds = new Set<string>();
    attendees.forEach((attendee) => {
      const eventId = readString(attendee.data().eventId);
      if (!eventId) return;
      attendeeCounts.set(eventId, (attendeeCounts.get(eventId) ?? 0) + 1);
      if (access.viewerId && attendee.data().userId === access.viewerId) viewerEventIds.add(eventId);
    });
    const epoch = new Date(0).toISOString();
    return snapshot.docs.filter((document) => document.data().hidden !== true && !document.data().accountLifecycleHiddenAt).map((document): CommunityEventRecord => {
      const event = document.data();
      const userId = readString(event.userId) || readString(event.creatorId);
      const canManage = Boolean(access.viewerId && (userId === access.viewerId || access.canModerate));
      return {
        id: document.id, title: readString(event.title) || 'Untitled event', summary: readString(event.summary) || readString(event.description),
        description: readString(event.description), startDate: toIsoString(event.startDate) ?? epoch, endDate: toIsoString(event.endDate) ?? epoch,
        location: readString(event.location) || 'Online', userId, likeCount: readNonNegativeNumber(event.likeCount) ?? 0,
        attendeeCount: attendeeCounts.get(document.id) ?? 0, userRSVP: viewerEventIds.has(document.id), recurrence: readString(event.recurrence) || 'none',
        image: readString(event.image) || undefined, media: this.readMedia(event.media), communityVariantId: access.communityId,
        permissions: { canEdit: canManage, canDelete: canManage },
      };
    }).filter((event) => event.startDate !== epoch).sort((first, second) => first.startDate.localeCompare(second.startDate));
  }

  public async createEvent(communityId: string, input: CommunityEventInput): Promise<string> {
    const access = await this.requireAccess(communityId);
    if (!this.canCreateContent(access)) throw new Error('Community event permission required.');
    const title = (input.title ?? '').trim();
    const summary = (input.summary || input.description || '').trim();
    const startDate = new Date(input.startDate ?? '');
    const endDate = new Date(input.endDate ?? '');
    if (!title || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) throw new Error('Enter a title and valid event dates.');
    const reference = await addDoc(collection(db, 'events'), {
      communityVariantId: access.communityId, title: title.slice(0, 120), summary: summary.slice(0, 1000), description: summary.slice(0, 1000),
      startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate), location: (input.location ?? '').trim().slice(0, 200) || 'Online',
      recurrence: ['daily', 'weekly', 'monthly'].includes(input.recurrence ?? '') ? input.recurrence : 'none', image: input.image || null,
      media: this.readMedia(input.media), userId: access.viewerId, creatorId: access.viewerId, likeCount: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    return reference.id;
  }

  private async requireEvent(communityId: string, eventId: string): Promise<{ access: CommunityAccess; data: DocumentData }> {
    const access = await this.requireAccess(communityId);
    const event = await getDoc(doc(db, 'events', eventId));
    if (!access.viewerId || !event.exists() || event.data().communityVariantId !== access.communityId) throw new Error('Community event not found.');
    return { access, data: event.data() };
  }

  public async updateEvent(communityId: string, eventId: string, input: CommunityEventInput): Promise<void> {
    const { access, data } = await this.requireEvent(communityId, eventId);
    if (data.userId !== access.viewerId && !access.canModerate) throw new Error('Event edit permission required.');
    const updates: DocumentData = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title.trim().slice(0, 120);
    if (input.summary !== undefined || input.description !== undefined) { updates.summary = (input.summary || input.description || '').trim().slice(0, 1000); updates.description = updates.summary; }
    if (input.startDate !== undefined) {
      const startDate = new Date(input.startDate);
      if (Number.isNaN(startDate.getTime())) throw new Error('Enter a valid event start date.');
      updates.startDate = Timestamp.fromDate(startDate);
    }
    if (input.endDate !== undefined) {
      const endDate = new Date(input.endDate);
      if (Number.isNaN(endDate.getTime())) throw new Error('Enter a valid event end date.');
      updates.endDate = Timestamp.fromDate(endDate);
    }
    if (input.location !== undefined) updates.location = input.location.trim().slice(0, 200);
    if (input.recurrence !== undefined) updates.recurrence = input.recurrence;
    if (input.image !== undefined) updates.image = input.image || null;
    if (Array.isArray(input.media)) updates.media = this.readMedia(input.media);
    await updateDoc(doc(db, 'events', eventId), updates);
  }

  public async deleteEvent(communityId: string, eventId: string): Promise<void> {
    const { access, data } = await this.requireEvent(communityId, eventId);
    if (data.userId !== access.viewerId && !access.canModerate) throw new Error('Event delete permission required.');
    await deleteDoc(doc(db, 'events', eventId));
  }

  public async toggleAttendance(communityId: string, eventId: string, desiredAttending?: boolean): Promise<{ isAttending: boolean; attendeeCount: number; onWaitlist?: boolean; position?: number }> {
    const { access, data } = await this.requireEvent(communityId, eventId);
    const viewerId = access.viewerId as string;
    const existing = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId), where('userId', '==', viewerId)));
    const attend = desiredAttending ?? existing.empty;
    if (attend && typeof data.capacity === 'number' && existing.size >= data.capacity) {
      const waitlist = await getDocs(query(collection(db, 'eventWaitlists'), where('eventId', '==', eventId)));
      const position = waitlist.size + 1;
      await addDoc(collection(db, 'eventWaitlists'), { eventId, userId: viewerId, createdAt: new Date(), position });
      return { isAttending: false, attendeeCount: existing.size, onWaitlist: true, position };
    }
    const batch = writeBatch(db);
    existing.docs.forEach((attendee) => batch.delete(attendee.ref));
    if (attend) batch.set(doc(db, 'eventAttendees', `${eventId}_${viewerId}`), { eventId, userId: viewerId, createdAt: new Date() });
    await batch.commit();
    const updated = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId)));
    return { isAttending: attend, attendeeCount: updated.size };
  }
}

export const communityDataService = CommunityDataService.getInstance();
