import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { AvatarService } from './AvatarService';
import { communityDataService } from './CommunityDataService';
import { DeepLinkService } from './DeepLinkService';
import { PostMediaService, isCancellationError, type MediaUploadProgress, type PostUploadStage } from './PostMediaService';
import type { PageResult } from '@/lib/types/serviceResults';
import { buildFeedQuery } from '@/lib/posts/FeedQuery';
import { postAuthorizationService } from '@/lib/services/PostAuthorizationService';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';

export type PostMediaType = 'image' | 'video';
export type PostType = 'regular' | 'poll' | 'event';
export type PostVisibility = 'public' | 'friends' | 'friends_followers' | 'private';
export type FeedFilter = 'all' | 'photo' | 'video' | 'audio' | 'poll' | 'event' | 'document' | 'link' | 'trending' | 'saved';
export type FeedScope = 'home' | 'friends' | 'communities';
export type PostOrigin = 'home' | 'community';
export type CommunityReactionResult = { liked: boolean; likeCount: number };

export type PostMediaDraft = {
  uri: string;
  type: PostMediaType;
  fileName: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  durationSeconds?: number;
  thumbnailUri?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
};
export type PostMedia = {
  id: string;
  type: PostMediaType;
  typeUrl: string;
  fileName: string;
  thumbnailUrl?: string;
  displayOrder?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  durationSeconds?: number;
};
export type PostUser = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  accountType?: string;
  identityVerificationStatus?: string;
  verificationStatus?: string;
};
export type PollOption = { id: string; text: string; votes: number };
export type PollVoteResult = { userVoteOptionId: string | null; pollOptions: PollOption[]; totalVotes: number };
export type PostLocation = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  coordinates?: { latitude?: number; longitude?: number };
};
export type PostStats = { likes: number; comments: number; shares: number };
export type PostRelationshipStatus = {
  isFollowing: boolean;
  friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined';
};
export type RepostedFrom = {
  postId: string;
  userId: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
};

export type PostItem = {
  id: string;
  origin: PostOrigin;
  userId: string;
  user: PostUser;
  type: PostType;
  caption: string;
  description: string;
  visibility: PostVisibility;
  hashtags: string[];
  media: PostMedia[];
  thumbnailUrl?: string;
  stats: PostStats;
  likedUserIds: string[];
  likedUsers?: PostUser[];
  mentions: string[];
  friendReferences: string[];
  createdAt: string;
  pollDuration?: number;
  pollEndTime?: string;
  pollOptions?: PollOption[];
  pollVotes?: Record<string, string>;
  location?: PostLocation;
  repostedFrom?: RepostedFrom;
  repostedByViewer?: boolean;
  repostedByUserIds?: string[];
  reposters?: PostUser[];
  relationshipStatus?: PostRelationshipStatus;
  communityId?: string;
  communityName?: string;
  communitySlug?: string;
  communityAvatar?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  category?: string;
  isSaved?: boolean;
};

export type FeedPage = Omit<PageResult<PostItem>, 'items'> & { posts: PostItem[] };
export type PostLikesPage = { users: PostUser[]; nextCursor: string | null; hasMore: boolean };

export type PostEditPayload = {
  caption?: string;
  description?: string;
  hashtags?: string[];
  mentions?: string[];
  friendReferences?: string[];
  location?: PostLocation | null;
  visibility?: PostVisibility;
};

export type CreatePostInput = {
  userId: string;
  user: PostUser;
  type: PostType;
  caption: string;
  description: string;
  visibility: PostVisibility;
  hashtags: string[];
  media: PostMediaDraft[];
  mentions: string[];
  friendReferences: string[];
  pollOptions?: Array<{ id: string; text: string }>;
  pollDuration?: number;
  location?: PostLocation;
  signal?: AbortSignal;
  onUploadProgress?: (progress: MediaUploadProgress) => void;
  onStage?: (stage: PostUploadStage, index?: number) => void;
  communityId?: string;
  communityName?: string;
};

type UnknownRecord = Record<string, unknown>;
type DataDocument = { id: string; data: UnknownRecord };
type RelationshipSets = { friends: Set<string>; following: Set<string>; blockedUsers: Set<string> };
type FeedApiResponse = {
  success: boolean;
  data?: unknown[];
  error?: string;
  pagination?: {
    nextCursor?: string | null;
    hasMore?: boolean;
  };
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const readNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const readDate = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date(0).toISOString();
};
const timestampMillis = (value: unknown): number => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
};

export class PostService {
  private static instance: PostService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly avatarService = AvatarService.getInstance();
  private readonly deepLinkService = DeepLinkService.getInstance();
  private readonly mediaService = PostMediaService.getInstance();

  private readonly pendingReposts = new Map<string, Promise<string>>();

  private constructor() {}

  public static getInstance(): PostService {
    if (!PostService.instance) PostService.instance = new PostService();
    return PostService.instance;
  }

  public async fetchPosts(fetchLimit = 20): Promise<PostItem[]> {
    return (await this.fetchFeedPage({ limit: fetchLimit })).posts;
  }

  public async getAuthorPostCount(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const snapshot = await getCountFromServer(
        query(collection(db, 'feedPosts'), where('userId', '==', userId)),
      );
      return snapshot.data().count;
    } catch {
      try {
        const snap = await getDocs(
          query(collection(db, 'feedPosts'), where('userId', '==', userId)),
        );
        return snap.size;
      } catch {
        return 0;
      }
    }
  }

  /** Community feed read from Firestore (same data the website's community posts route returns). */
  public async fetchCommunityPosts(communityId: string): Promise<PostItem[]> {
    const viewerId = auth.currentUser?.uid ?? null;
    const access = await communityDataService.resolveAccess(communityId);
    if (!access) throw new Error('Community not found.');
    if (!access.hasAccess) throw new Error('Community access required.');
    const snapshot = await getDocs(query(collection(db, 'communityVariantDetails'), where('communityVariantId', '==', access.communityId)));
    const documents: DataDocument[] = snapshot.docs
      .map((document) => ({ id: document.id, data: isRecord(document.data()) ? document.data() : {} }))
      .filter((document) => document.data.hidden !== true)
      .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));
    const postIds = documents.map((document) => document.id);
    const [mediaDocuments, viewerLikes, counters, users] = await Promise.all([
      this.getDocumentsByField('communityVariantDetailsSummary', 'communityVariantDetailsId', postIds),
      viewerId ? getDocs(query(collection(db, 'communityVariantDetailsLikes'), where('userId', '==', viewerId))) : Promise.resolve(null),
      Promise.all(postIds.map((postId) => getDoc(doc(db, 'communityVariantDetailsCounter', postId)).catch(() => null))),
      this.loadUserCards(documents.map((document) => readString(document.data.userId))),
    ]);
    const mediaByPost = new Map<string, PostMedia[]>();
    mediaDocuments.forEach((document) => {
      const postId = readString(document.data.communityVariantDetailsId);
      const typeUrl = readString(document.data.typeUrl);
      if (!postId || !typeUrl) return;
      mediaByPost.set(postId, [...(mediaByPost.get(postId) ?? []), {
        id: document.id,
        type: document.data.type === 'video' ? 'video' : 'image',
        typeUrl,
        fileName: readString(document.data.fileName),
        thumbnailUrl: readString(document.data.thumbnailUrl) || undefined,
      }]);
    });
    const likedPostIds = new Set((viewerLikes?.docs ?? []).map((like) => readString(like.data().postId)));
    const posts = documents.map((document, index) => {
      const userId = readString(document.data.userId);
      const likeCount = Math.max(0, Number(counters[index]?.data()?.likeCount) || 0);
      return this.mapPost(
        { id: document.id, data: { ...document.data, communityId: access.communityId, communityName: readString(access.communityData.title) } },
        users.get(userId) ?? this.emptyUser(userId),
        mediaByPost.get(document.id) ?? [],
        { likeCount, commentCount: document.data.commentCount, shareCount: document.data.shareCount },
        viewerId && likedPostIds.has(document.id) ? [viewerId] : [],
      );
    });
    this.logger.success('PostService', 'community-posts:firestore', { communityId, renderedPostCount: posts.length });
    return posts;
  }

  public async fetchFeedPage(options: {
    limit?: number;
    cursor?: string | null;
    filter?: FeedFilter;
    scope?: FeedScope;
    authorId?: string;
    signal?: AbortSignal;
  } = {}): Promise<FeedPage> {
    try {
      return await this.fetchFeedPageFromFirestore(options);
    } catch (fsError: unknown) {
      if (options.signal?.aborted) throw fsError;
      this.logger.error('PostService', 'feed-firestore:error', fsError);
      throw fsError instanceof Error ? fsError : new Error('Unable to load the feed.');
    }
  }

  private async fetchFeedPageFromFirestore(options: {
    limit?: number;
    cursor?: string | null;
    filter?: FeedFilter;
    scope?: FeedScope;
    authorId?: string;
  }): Promise<FeedPage> {
    const fetchLimit = options.limit ?? 20;
    const scanLimit = Math.min(fetchLimit * 2, 40);
    const viewerId = auth.currentUser?.uid ?? null;

    if (options.scope === 'communities') {
      let communityIds: string[] = [];
      if (viewerId) {
        const [membershipsSnap, memberIdSnap, createdSnapUserId, createdSnapCreatorId] = await Promise.all([
          getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', viewerId))).catch(() => null),
          getDocs(query(collection(db, 'communityVariantMembership'), where('memberId', '==', viewerId))).catch(() => null),
          getDocs(query(collection(db, 'communityVariant'), where('userId', '==', viewerId))).catch(() => null),
          getDocs(query(collection(db, 'communityVariant'), where('creatorId', '==', viewerId))).catch(() => null),
        ]);
        membershipsSnap?.docs.forEach((d) => {
          const m = d.data();
          if (m.isMember !== false && m.status !== 'banned' && m.isBanned !== true) {
            const cid = readString(m.communityVariantId) || readString(m.communityId);
            if (cid) communityIds.push(cid);
          }
        });
        memberIdSnap?.docs.forEach((d) => {
          const m = d.data();
          if (m.isMember !== false && m.status !== 'banned' && m.isBanned !== true) {
            const cid = readString(m.communityVariantId) || readString(m.communityId);
            if (cid) communityIds.push(cid);
          }
        });
        createdSnapUserId?.docs.forEach((d) => communityIds.push(d.id));
        createdSnapCreatorId?.docs.forEach((d) => communityIds.push(d.id));
      }
      if (communityIds.length === 0) {
        const publicSnap = await getDocs(query(collection(db, 'communityVariant'), limit(30))).catch(() => null);
        publicSnap?.docs.forEach((d) => {
          const data = d.data();
          if (data.isPrivate !== true && data.privacy !== 'private') {
            communityIds.push(d.id);
          }
        });
      }
      communityIds = [...new Set(communityIds.filter(Boolean))];

      if (communityIds.length === 0) {
        return { posts: [], nextCursor: null, hasMore: false };
      }

      const chunks = Array.from({ length: Math.ceil(communityIds.length / 30) }, (_, index) => communityIds.slice(index * 30, index * 30 + 30));
      const [variantSnapshots, idSnapshots] = await Promise.all([
        Promise.all(
          chunks.map((chunkIds) =>
            getDocs(query(collection(db, 'communityVariantDetails'), where('communityVariantId', 'in', chunkIds), limit(scanLimit))).catch(() => null)
          )
        ),
        Promise.all(
          chunks.map((chunkIds) =>
            getDocs(query(collection(db, 'communityVariantDetails'), where('communityId', 'in', chunkIds), limit(scanLimit))).catch(() => null)
          )
        ),
      ]);

      const allDocsMap = new Map<string, DataDocument>();
      variantSnapshots.forEach((s) => {
        s?.docs.forEach((docSnap) => {
          allDocsMap.set(docSnap.id, { id: docSnap.id, data: isRecord(docSnap.data()) ? docSnap.data() : {} });
        });
      });
      idSnapshots.forEach((s) => {
        s?.docs.forEach((docSnap) => {
          allDocsMap.set(docSnap.id, { id: docSnap.id, data: isRecord(docSnap.data()) ? docSnap.data() : {} });
        });
      });

      let rawDocuments: DataDocument[] = Array.from(allDocsMap.values())
        .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));

      if (rawDocuments.length === 0) {
        const [recentCommunityDetails, recentFeedCommunityPosts] = await Promise.all([
          getDocs(query(collection(db, 'communityVariantDetails'), limit(scanLimit))).catch(() => null),
          getDocs(query(collection(db, 'feedPosts'), limit(scanLimit))).catch(() => null),
        ]);
        if (recentCommunityDetails && !recentCommunityDetails.empty) {
          rawDocuments = recentCommunityDetails.docs
            .map((d) => ({ id: d.id, data: isRecord(d.data()) ? d.data() : {} }))
            .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));
        } else if (recentFeedCommunityPosts && !recentFeedCommunityPosts.empty) {
          rawDocuments = recentFeedCommunityPosts.docs
            .map((d) => ({ id: d.id, data: isRecord(d.data()) ? d.data() : {} }))
            .filter((d) => Boolean(d.data.communityId || d.data.communityVariantId || d.data.origin === 'community'))
            .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));
        }
      }

      const postIds = rawDocuments.map((d) => d.id);
      const uniqueCommunityIds = [...new Set(rawDocuments.map((d) => readString(d.data.communityVariantId) || readString(d.data.communityId)).filter(Boolean))];
      const [mediaDocuments, likeDocuments, counters, communityDocuments] = await Promise.all([
        this.getDocumentsByField('communityVariantDetailsSummary', 'communityVariantDetailsId', postIds),
        viewerId ? this.getDocumentsByField('communityVariantDetailsLikes', 'postId', postIds) : Promise.resolve([]),
        Promise.all(postIds.map((postId) => getDoc(doc(db, 'communityVariantDetailsCounter', postId)))),
        Promise.all(uniqueCommunityIds.map((cId) => getDoc(doc(db, 'communityVariant', cId)))),
      ]);

      const communityMap = new Map<string, UnknownRecord>();
      communityDocuments.forEach((cd) => {
        if (cd.exists()) communityMap.set(cd.id, cd.data() as UnknownRecord);
      });

      const mediaByPost = new Map<string, PostMedia[]>();
      mediaDocuments.forEach((document) => {
        const postId = readString(document.data.communityVariantDetailsId);
        const typeUrl = readString(document.data.typeUrl);
        if (!postId || !typeUrl) return;
        const items = mediaByPost.get(postId) ?? [];
        items.push({
          id: document.id,
          type: document.data.type === 'video' ? 'video' : 'image',
          typeUrl,
          fileName: readString(document.data.fileName),
          thumbnailUrl: readString(document.data.thumbnailUrl) || undefined,
          trimStartSeconds: typeof document.data.trimStartSeconds === 'number' ? document.data.trimStartSeconds : undefined,
          trimEndSeconds: typeof document.data.trimEndSeconds === 'number' ? document.data.trimEndSeconds : undefined,
          durationSeconds: typeof document.data.durationSeconds === 'number' ? document.data.durationSeconds : undefined,
        });
        mediaByPost.set(postId, items);
      });

      const likedUsersByPost = new Map<string, string[]>();
      likeDocuments.forEach((document) => {
        const postId = readString(document.data.postId);
        const userId = readString(document.data.userId);
        if (postId && userId) likedUsersByPost.set(postId, [...(likedUsersByPost.get(postId) ?? []), userId]);
      });

      const filteredDocuments = rawDocuments.filter((document) => {
        if (!this.hasRenderablePostContent(document.data, mediaByPost.get(document.id) ?? [])) return false;
        const filter = options.filter ?? 'all';
        if (filter === 'all') return true;
        if (filter === 'poll' || filter === 'event') return document.data.type === filter;
        const media = mediaByPost.get(document.id) ?? [];
        if (filter === 'photo') return media.some((item) => item.type === 'image');
        if (filter === 'video') return media.some((item) => item.type === 'video');
        if (filter === 'link') {
          const text = `${readString(document.data.caption)} ${readString(document.data.description)}`;
          return /https?:\/\/[^\s]+/i.test(text);
        }
        if (filter === 'document') return media.some((item) => item.fileName?.endsWith('.pdf') || item.fileName?.endsWith('.doc'));
        if (filter === 'trending' || filter === 'saved') return true;
        return false;
      });

      const pageDocuments = filteredDocuments.slice(0, fetchLimit);
      const usersMap = await this.loadUserCards(pageDocuments.map((document) => readString(document.data.userId)));
      const posts = pageDocuments.map((document, index) => {
        const userId = readString(document.data.userId);
        const counter = counters[index]?.data() ?? {};
        const cId = readString(document.data.communityVariantId) || readString(document.data.communityId);
        const community = communityMap.get(cId) ?? {};
        const basePost = this.mapPost(
          document,
          usersMap.get(userId) ?? this.emptyUser(userId),
          mediaByPost.get(document.id) ?? [],
          { ...document.data, ...counter },
          likedUsersByPost.get(document.id) ?? [],
        );
        return {
          ...basePost,
          origin: 'community' as const,
          communityId: cId,
          communityName: readString(community.title, readString(community.name, 'Community')),
          communitySlug: readString(community.uniqueName, readString(community.slug, cId)),
          communityAvatar: readString(community.imageUrl, readString(community.bannerImageUrl, readString(community.coverImage))),
        };
      });

      this.logger.success('PostService', 'feed-firestore:communities', {
        renderedPostCount: posts.length,
        hasMore: filteredDocuments.length > fetchLimit,
      });

      return {
        posts,
        nextCursor: null,
        hasMore: false,
      };
    }

    const postsReference = collection(db, 'feedPosts');
    const snapshot = options.authorId
      ? await getDocs(query(postsReference, where('userId', '==', options.authorId), limit(scanLimit)))
      : await getDocs(query(postsReference, orderBy('createdAt', 'desc'), limit(scanLimit)));
    const rawDocuments: DataDocument[] = snapshot.docs
      .map((document) => ({
        id: document.id,
        data: isRecord(document.data()) ? document.data() : {},
      }))
      .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));

    const relationships = await this.loadRelationships(viewerId);
    const eligibleDocuments = rawDocuments.filter((document) => {
      if (!this.canViewPost(document.data, viewerId, relationships)) return false;
      const isRepost = document.data.isRepost === true || isRecord(document.data.repostedFrom);
      const reposterId = readString(document.data.userId);
      if (isRepost && !options.authorId && reposterId !== viewerId && !relationships.friends.has(reposterId)) return false;
      if (options.scope === 'friends') return relationships.friends.has(readString(document.data.userId));
      return true;
    });
    // A repost is distribution of the original, never a second authored post.
    const repostAuthorsByPost = new Map<string, Set<string>>();
    const originalsById = new Map<string, DataDocument>();
    const resolvedEntries: { entry: DataDocument; original: DataDocument | null }[] = [];
    for (let offset = 0; offset < eligibleDocuments.length; offset += 4) {
      resolvedEntries.push(...await Promise.all(eligibleDocuments.slice(offset, offset + 4).map(async (entry) => ({
        entry,
        original: await this.resolveOriginalPost(entry),
      }))));
    }
    for (const { entry, original } of resolvedEntries) {
      if (!original || !this.canViewPost(original.data, viewerId, relationships)) continue;
      originalsById.set(original.id, original);
      if (entry.id !== original.id) {
        const reposters = repostAuthorsByPost.get(original.id) ?? new Set<string>();
        reposters.add(readString(entry.data.userId));
        repostAuthorsByPost.set(original.id, reposters);
      }
    }
    // Order by each post's own date, not by when it was reposted: reposting must not move a post to the top of the
    // feed (Instagram-style), it only adds "You reposted" to it in place.
    const visibleDocuments = [...originalsById.values()]
      .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));
    const postIds = visibleDocuments.map((document) => document.id);
    const [mediaDocuments, countDocuments, likeDocuments, viewerRepostedPostIds, currentRepostMarkers, legacyRepostMarkers] = await Promise.all([
      this.getDocumentsByField('feedsPostSummary', 'feedsPostId', postIds),
      this.getDocumentsByField('likesCount', 'feedsPostId', postIds),
      this.getDocumentsByField('feedsPostLikeCount', 'feedsPostId', postIds),
      this.loadViewerRepostedPostIds(viewerId),
      this.getDocumentsByField('postReposts', 'originalPostId', postIds),
      this.getDocumentsByField('postReposts', 'postId', postIds),
    ]);
    for (const marker of [...currentRepostMarkers, ...legacyRepostMarkers]) {
      const reposterId = readString(marker.data.userId);
      if (!reposterId || (reposterId !== viewerId && reposterId !== options.authorId && !relationships.friends.has(reposterId))) continue;
      const originalId = readString(marker.data.originalPostId) || readString(marker.data.postId);
      const reposters = repostAuthorsByPost.get(originalId) ?? new Set<string>();
      reposters.add(reposterId);
      repostAuthorsByPost.set(originalId, reposters);
    }

    const mediaByPost = new Map<string, PostMedia[]>();
    mediaDocuments.forEach((document) => {
      const postId = readString(document.data.feedsPostId);
      const typeUrl = readString(document.data.typeUrl);
      if (!postId || !typeUrl) return;
      const mediaItems = mediaByPost.get(postId) ?? [];
      mediaItems.push({
        id: document.id,
        type: document.data.type === 'video' ? 'video' : 'image',
        typeUrl,
        fileName: readString(document.data.fileName),
        thumbnailUrl: readString(document.data.thumbnailUrl) || undefined,
        trimStartSeconds: typeof document.data.trimStartSeconds === 'number' ? document.data.trimStartSeconds : undefined,
        trimEndSeconds: typeof document.data.trimEndSeconds === 'number' ? document.data.trimEndSeconds : undefined,
        durationSeconds: typeof document.data.durationSeconds === 'number' ? document.data.durationSeconds : undefined,
      });
      mediaByPost.set(postId, mediaItems);
    });
    const countsByPost = new Map(countDocuments.map((document) => [readString(document.data.feedsPostId), document.data]));
    const likedUsersByPost = new Map<string, string[]>();
    likeDocuments.forEach((document) => {
      if (document.data.likes !== true) return;
      const postId = readString(document.data.feedsPostId);
      const userId = readString(document.data.userId);
      if (!postId || !userId) return;
      likedUsersByPost.set(postId, [...(likedUsersByPost.get(postId) ?? []), userId]);
    });

    const filteredDocuments = visibleDocuments.filter((document) => {
      if (!this.hasRenderablePostContent(document.data, mediaByPost.get(document.id) ?? [])) return false;
      const filter = options.filter ?? 'all';
      if (filter === 'all') return true;
      if (filter === 'poll' || filter === 'event') return document.data.type === filter;
      const media = mediaByPost.get(document.id) ?? [];
      if (filter === 'photo') return media.some((item) => item.type === 'image');
      if (filter === 'video') return media.some((item) => item.type === 'video');
      if (filter === 'link') {
        const text = `${readString(document.data.caption)} ${readString(document.data.description)}`;
        return /https?:\/\/[^\s]+/i.test(text);
      }
      if (filter === 'document') return media.some((item) => item.fileName?.endsWith('.pdf') || item.fileName?.endsWith('.doc'));
      if (filter === 'trending' || filter === 'saved') return true;
      return false;
    });
    const pageDocuments = filteredDocuments.slice(0, fetchLimit);
    const usersMap = await this.loadUserCards([
      ...pageDocuments.map((document) => readString(document.data.userId)),
      ...[...repostAuthorsByPost.values()].flatMap((userIds) => [...userIds]),
    ]);
    const posts = pageDocuments.map((document) => {
      const userId = readString(document.data.userId);
      const post = this.mapPost(
        document,
        usersMap.get(userId) ?? this.emptyUser(userId),
        mediaByPost.get(document.id) ?? [],
        countsByPost.get(document.id) ?? document.data,
        likedUsersByPost.get(document.id) ?? [],
      );
      const reposterIds = [...(repostAuthorsByPost.get(document.id) ?? [])];
      return {
        ...post,
        repostedByViewer: viewerRepostedPostIds.has(document.id),
        repostedByUserIds: reposterIds,
        reposters: reposterIds.flatMap((reposterId) => {
          const reposter = usersMap.get(reposterId);
          return reposter ? [reposter] : [];
        }),
      };
    });

    this.logger.success('PostService', 'feed-firestore', {
      collection: 'feedPosts',
      scope: options.scope ?? 'home',
      renderedPostCount: posts.length,
      hasMore: filteredDocuments.length > fetchLimit || snapshot.docs.length >= scanLimit,
    });

    return {
      posts,
      nextCursor: null,
      hasMore: false,
    };
  }

  private async resolveOriginalPost(entry: DataDocument): Promise<DataDocument | null> {
    let current = entry;
    const visited = new Set<string>();
    for (let depth = 0; depth < 10; depth += 1) {
      if (visited.has(current.id)) return null;
      visited.add(current.id);
      const source = isRecord(current.data.repostedFrom) ? current.data.repostedFrom : null;
      const originalId = source ? readString(source.postId) : '';
      if (!originalId) return current.data.isRepost === true ? null : current;
      const snapshot = await getDoc(doc(db, 'feedPosts', originalId));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      current = { id: snapshot.id, data: isRecord(data) ? data : {} };
    }
    return null;
  }

  private async loadViewerRepostedPostIds(viewerId: string | null): Promise<Set<string>> {
    if (!viewerId) return new Set<string>();
    const snapshot = await getDocs(
      query(collection(db, 'postReposts'), where('userId', '==', viewerId), limit(200)),
    ).catch(() => null);
    if (!snapshot) return new Set<string>();
    return new Set(snapshot.docs.flatMap((document): string[] => {
      const marker = document.data();
      const originalPostId = readString(marker.originalPostId) || readString(marker.postId);
      return originalPostId ? [originalPostId] : [];
    }));
  }

  public async createPost(input: CreatePostInput): Promise<PostItem> {
    this.validateCreateInput(input);
    await postAuthorizationService.requireVerifiedUser(input.userId);
    const draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startedAt = Date.now();
    let stage: 'media-upload' | 'post-persistence' = 'media-upload';
    let publicationStarted = false;
    let uploadedPaths: string[] = [];
    this.logger.info('PostService', 'create:start', {
      userId: input.userId,
      draftId,
      type: input.type,
      mediaCount: input.media.length,
      hashtagCount: input.hashtags.length,
    });
    try {
      const upload = await this.mediaService.uploadMediaBatch({
        postId: draftId,
        userId: input.userId,
        media: input.media,
        signal: input.signal,
        onProgress: input.onUploadProgress,
        onStage: input.onStage,
      });
      const media = upload.media;
      uploadedPaths = upload.storagePaths;
      if (input.signal?.aborted) throw new Error('Post submission cancelled.');
      stage = 'post-persistence';
      input.onStage?.('publishing');
      this.logger.info('PostService', 'create:persist:start', { draftId, mediaCount: media.length });
      const pollDuration = input.type === 'poll' ? input.pollDuration ?? 24 : undefined;
      const pollEndTime = pollDuration ? new Date(Date.now() + pollDuration * 60 * 60 * 1000).toISOString() : undefined;
      const pollOptions = input.type === 'poll'
        ? (input.pollOptions ?? []).map((option) => ({ ...option, votes: 0 }))
        : undefined;
      if (input.communityId) {
        if (input.type !== 'regular') throw new Error('Community polls and events use their dedicated creation tools');
        publicationStarted = true;
        const communityPost = await addDoc(collection(db, 'communityVariantDetails'), {
          title: input.caption.trim(),
          caption: input.caption.trim(),
          content: input.caption.trim(),
          description: input.description.trim(),
          visibility: 'community',
          createdAt: serverTimestamp(),
          userId: input.userId,
          communityVariantId: input.communityId,
          hashtags: input.hashtags,
          mentions: input.mentions,
        });
        const mediaRecords = await Promise.all(media.map(async (mediaItem, mediaIndex) => {
          const summary = await addDoc(collection(db, 'communityVariantDetailsSummary'), {
            type: mediaItem.type,
            typeUrl: mediaItem.typeUrl,
            fileName: mediaItem.fileName,
            displayOrder: mediaItem.displayOrder ?? mediaIndex,
            ...(mediaItem.thumbnailUrl ? { thumbnailUrl: mediaItem.thumbnailUrl } : {}),
            ...(typeof mediaItem.trimStartSeconds === 'number' ? { trimStartSeconds: mediaItem.trimStartSeconds } : {}),
            ...(typeof mediaItem.trimEndSeconds === 'number' ? { trimEndSeconds: mediaItem.trimEndSeconds } : {}),
            ...(typeof mediaItem.durationSeconds === 'number' ? { durationSeconds: mediaItem.durationSeconds } : {}),
            communityVariantDetailsId: communityPost.id,
          });
          return { ...mediaItem, id: summary.id };
        }));
        return {
          id: communityPost.id,
          origin: 'community',
          userId: input.userId,
          user: input.user,
          type: 'regular',
          caption: input.caption.trim(),
          description: input.description.trim(),
          visibility: 'public',
          hashtags: input.hashtags,
          media: mediaRecords,
          mentions: input.mentions,
          friendReferences: input.friendReferences,
          stats: { likes: 0, comments: 0, shares: 0 },
          likedUserIds: [],
          createdAt: new Date().toISOString(),
          communityId: input.communityId,
          communityName: input.communityName,
        };
      }
      publicationStarted = true;
      return await this.createPostInFirestore(input, media, pollDuration, pollEndTime, pollOptions);
    } catch (error: unknown) {
      if (isCancellationError(error, input.signal)) {
        this.logger.info('PostService', 'create:cancelled', { userId: input.userId, draftId, stage, elapsedMs: Date.now() - startedAt });
      } else {
        this.logger.error('PostService', 'create', error, { userId: input.userId, draftId, stage, elapsedMs: Date.now() - startedAt });
      }
      // A timed-out write may still have committed on the server. Retain its
      // uploaded media instead of breaking a post whose outcome is uncertain.
      if (!publicationStarted && uploadedPaths.length > 0) await this.mediaService.cleanup(uploadedPaths);
      throw error;
    }
  }

  public validateCreateInput(input: Pick<CreatePostInput, 'type' | 'caption' | 'description' | 'hashtags' | 'media' | 'pollOptions'>): void {
    const visibleText = `${input.caption} ${input.description}`.replace(/@[\w.-]+/g, '').trim();
    const hasText = visibleText.length > 0;
    const hasMedia = input.media.length > 0;
    const hasHashtags = input.hashtags.some((hashtag) => hashtag.trim().length > 0);
    if (input.type === 'poll') {
      const validOptions = (input.pollOptions ?? []).filter((option) => option.text.trim().length > 0);
      if (!hasText || validOptions.length < 2) throw new Error('Add a question and at least two poll options before posting.');
      return;
    }
    if (input.type === 'event') {
      if (!hasText) throw new Error('Add an event title before posting.');
      return;
    }
    if (!hasText && !hasMedia && !hasHashtags) throw new Error('Add text, a hashtag, a photo, or a video before posting.');
  }

  private hasRenderablePostContent(data: UnknownRecord, media: PostMedia[]): boolean {
    const text = [data.caption, data.description, data.title, data.content]
      .some((value) => readString(value).trim().length > 0);
    const hashtags = Array.isArray(data.hashtags)
      && data.hashtags.some((hashtag) => typeof hashtag === 'string' && hashtag.trim().length > 0);
    const pollOptions = Array.isArray(data.pollOptions)
      && data.pollOptions.some((option) => isRecord(option) && readString(option.text).trim().length > 0);
    return text || hashtags || pollOptions || media.length > 0;
  }

  private async createPostInFirestore(
    input: CreatePostInput,
    media: PostMedia[],
    pollDuration?: number,
    pollEndTime?: string,
    pollOptions?: { id: string; text: string; votes: number }[]
  ): Promise<PostItem> {
    const postRef = doc(collection(db, 'feedPosts'));
    const countRef = doc(collection(db, 'likesCount'));
    const basePostData: Record<string, unknown> = {
      userId: input.userId,
      caption: input.caption.trim(),
      description: input.description.trim(),
      visibility: input.visibility,
      hashtags: input.hashtags || [],
      mentions: input.mentions || [],
      friendReferences: input.friendReferences || [],
      type: input.type || 'regular',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(input.location ? { location: input.location } : {}),
      ...(input.type === 'poll' ? {
        pollOptions: (input.pollOptions ?? []).map((o) => ({ id: o.id, text: o.text.trim() })),
        pollDuration: pollDuration ?? 1,
        pollEndTime: pollEndTime ?? null,
        pollVotes: {},
      } : {}),
    };

    const batch = writeBatch(db);
    batch.set(postRef, basePostData);
    batch.set(countRef, {
      feedsPostId: postRef.id,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    try {
      await updateDoc(doc(db, 'users', input.userId), { postsCount: increment(1) });
    } catch {
      // User doc update is best-effort
    }

    const mediaRecords = await Promise.all(
      media.map(async (mediaItem, mediaIndex) => {
        const summary = await addDoc(collection(db, 'feedsPostSummary'), {
          feedsPostId: postRef.id,
          type: mediaItem.type,
          typeUrl: mediaItem.typeUrl,
          fileName: mediaItem.fileName,
          displayOrder: mediaItem.displayOrder ?? mediaIndex,
          ...(mediaItem.thumbnailUrl ? { thumbnailUrl: mediaItem.thumbnailUrl } : {}),
          ...(typeof mediaItem.trimStartSeconds === 'number' ? { trimStartSeconds: mediaItem.trimStartSeconds } : {}),
          ...(typeof mediaItem.trimEndSeconds === 'number' ? { trimEndSeconds: mediaItem.trimEndSeconds } : {}),
          ...(typeof mediaItem.durationSeconds === 'number' ? { durationSeconds: mediaItem.durationSeconds } : {}),
        });
        return { ...mediaItem, id: summary.id };
      })
    );

    this.logger.success('PostService', 'create', {
      postId: postRef.id,
      mediaCount: media.length,
      transport: 'firestore-fallback',
    });

    return {
      id: postRef.id,
      origin: 'home',
      userId: input.userId,
      user: input.user,
      type: input.type,
      caption: input.caption.trim(),
      description: input.description.trim(),
      visibility: input.visibility,
      hashtags: input.hashtags,
      media: mediaRecords,
      mentions: input.mentions,
      friendReferences: input.friendReferences,
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
      pollOptions,
      pollDuration,
      pollEndTime,
      pollVotes: {},
      location: input.location,
    };
  }

  public async fetchPost(postId: string): Promise<PostItem> {
    const reference = await getDoc(doc(db, 'feedPosts', postId));
    if (reference.exists()) {
      const data = reference.data();
      const original = await this.resolveOriginalPost({ id: reference.id, data: isRecord(data) ? data : {} });
      if (!original) throw new Error('The original post is no longer available.');
      if (original.id !== postId) return this.fetchPost(original.id);
    }
    try {
      let snap = await getDoc(doc(db, 'feedPosts', postId));
      let isCommunity = false;
      if (!snap.exists()) {
        snap = await getDoc(doc(db, 'communityVariantDetails', postId));
        if (snap.exists()) isCommunity = true;
      }
      if (!snap.exists()) {
        snap = await getDoc(doc(db, 'posts', postId));
      }
      if (snap.exists()) {
        const rawData = snap.data();
        const data = isRecord(rawData) ? rawData : {};
        if (
          data.deletionSource === 'admin_moderation' ||
          data.status === 'admin_deleted' ||
          data.deletedByAdmin === true ||
          data.moderated === true ||
          data.banned === true
        ) {
          throw new Error('This post was removed by an admin.');
        }
        if (data.isDeleted === true || data.status === 'deleted') {
          throw new Error('This post was deleted.');
        }
        const postDoc = { id: snap.id, data };
        const userId = readString(data.userId);
        const [userCards, mediaDocs, countDocs, likeDocs] = await Promise.all([
          this.loadUserCards([userId]),
          isCommunity
            ? this.getDocumentsByField('communityVariantDetailsSummary', 'communityVariantDetailsId', [postId])
            : this.getDocumentsByField('feedsPostSummary', 'feedsPostId', [postId]),
          isCommunity
            ? this.getDocumentsByField('communityVariantDetailsCounter', '__name__', [postId])
            : this.getDocumentsByField('likesCount', 'feedsPostId', [postId]),
          isCommunity
            ? this.getDocumentsByField('communityVariantDetailsLikes', 'postId', [postId])
            : this.getDocumentsByField('feedsPostLikeCount', 'feedsPostId', [postId]),
        ]);
        const userCard = userCards.get(userId) ?? this.emptyUser(userId);
        const mediaItems = mediaDocs.map((d) => ({
          id: d.id,
          type: (readString(d.data.type) === 'video' ? 'video' : 'image') as PostMediaType,
          typeUrl: readString(d.data.typeUrl),
          fileName: readString(d.data.fileName),
          thumbnailUrl: readString(d.data.thumbnailUrl) || undefined,
          trimStartSeconds: typeof d.data.trimStartSeconds === 'number' ? d.data.trimStartSeconds : undefined,
          trimEndSeconds: typeof d.data.trimEndSeconds === 'number' ? d.data.trimEndSeconds : undefined,
          durationSeconds: typeof d.data.durationSeconds === 'number' ? d.data.durationSeconds : undefined,
        }));
        const counter = countDocs[0]?.data ?? data;
        const likedUserIds = likeDocs.filter((d) => d.data.likes === true).map((d) => readString(d.data.userId)).filter(Boolean);
        return this.mapPost(postDoc, userCard, mediaItems, counter, likedUserIds);
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === 'This post was removed by an admin.' || error.message === 'This post was deleted.')) {
        throw error;
      }
      console.error('[PostService.fetchPost] Error:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('This post could not be loaded.');
    }
    throw new Error('This post was deleted.');
  }

  public async updatePost(postId: string, origin: PostOrigin, updates: PostEditPayload, communityId?: string): Promise<void> {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('Must be logged in to edit a post.');
    if (origin === 'community') {
      if (!communityId) throw new Error('This community post is missing its community.');
      const caption = (updates.caption ?? '').trim();
      const visibility = updates.visibility === 'private' ? 'private' : updates.visibility === 'friends' || updates.visibility === 'friends_followers' ? 'friends' : 'public';
      if (caption.length > 280) throw new Error('Post content exceeds the allowed length');
      if (!caption) throw new Error('Add a title or post content');
      const postRef = doc(db, 'communityVariantDetails', postId);
      const snap = await getDoc(postRef);
      if (!snap.exists()) throw new Error('Post not found');
      const access = await communityDataService.resolveAccess(communityId);
      if (!access?.hasAccess || snap.data().communityVariantId !== access.communityId) throw new Error('Post does not belong to this community');
      if (snap.data().userId !== currentUserId) throw new Error('Only the post author can edit this post');
      const title = caption.slice(0, 75);
      const description = updates.description?.trim() ?? '';
      await updateDoc(postRef, { title, caption, content: caption, description, visibility, updatedAt: new Date().toISOString() });
      return;
    }

    const postRef = doc(db, 'feedPosts', postId);
    const snap = await getDoc(postRef);

    if (!snap.exists()) throw new Error('Post not found.');
    if (snap.data().userId !== currentUserId) throw new Error('You do not have permission to edit this post.');

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.caption !== undefined) updateData.caption = updates.caption.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
    if (updates.hashtags !== undefined) updateData.hashtags = updates.hashtags;
    if (updates.mentions !== undefined) updateData.mentions = updates.mentions;
    if (updates.friendReferences !== undefined) updateData.friendReferences = updates.friendReferences;
    if (updates.location !== undefined) updateData.location = updates.location;

    await updateDoc(postRef, updateData);
  }

  public async toggleLike(post: Pick<PostItem, 'id' | 'origin'> & Partial<Pick<PostItem, 'stats' | 'likedUserIds'>>, userId: string, desiredLiked?: boolean): Promise<CommunityReactionResult> {
    if (post.origin === 'community') {
      const wasLiked = (post.likedUserIds ?? []).includes(userId);
      const shouldLike = desiredLiked ?? !wasLiked;
      const postSnap = await getDoc(doc(db, 'communityVariantDetails', post.id));
      if (!postSnap.exists()) throw new Error('Post not found.');
      const access = await communityDataService.resolveAccess(readString(postSnap.data().communityVariantId));
      if (!access?.hasAccess) throw new Error('Community access required.');
      const existingLikes = await getDocs(query(collection(db, 'communityVariantDetailsLikes'), where('postId', '==', post.id), where('userId', '==', userId)));
      const isAlreadyLiked = !existingLikes.empty;
      const counterRef = doc(db, 'communityVariantDetailsCounter', post.id);
      const batch = writeBatch(db);
      if (shouldLike && !isAlreadyLiked) {
        batch.set(doc(collection(db, 'communityVariantDetailsLikes')), { postId: post.id, userId, timestamp: serverTimestamp() });
        batch.set(counterRef, { likeCount: increment(1) }, { merge: true });
      } else if (!shouldLike && isAlreadyLiked) {
        existingLikes.docs.forEach((like) => batch.delete(like.ref));
        batch.set(counterRef, { likeCount: increment(-1) }, { merge: true });
      }
      await batch.commit();
      const baseCount = post.stats?.likes ?? 0;
      const likeCount = Math.max(0, baseCount + (shouldLike && !wasLiked ? 1 : !shouldLike && wasLiked ? -1 : 0));
      return { liked: shouldLike, likeCount };
    }

    const likeRef = doc(db, 'feedsPostLikeCount', `${post.id}_${userId}`);
    const [likeSnap, countSnap] = await Promise.all([
      getDoc(likeRef),
      getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', post.id), limit(1))),
    ]);
    const isAlreadyLiked = likeSnap.exists() && (likeSnap.data() as UnknownRecord)?.likes === true;
    const shouldLike = desiredLiked !== undefined ? desiredLiked : !isAlreadyLiked;
    const countDoc = !countSnap.empty ? countSnap.docs[0] : null;
    const currentCount = countDoc ? Number((countDoc.data() as UnknownRecord)?.likeCount || 0) : 0;
    const nextCount = shouldLike ? currentCount + (isAlreadyLiked ? 0 : 1) : Math.max(0, currentCount - (isAlreadyLiked ? 1 : 0));

    const batch = writeBatch(db);
    if (shouldLike) {
      batch.set(likeRef, { feedsPostId: post.id, userId, likes: true, timestamp: serverTimestamp() });
    } else {
      batch.delete(likeRef);
    }
    if (countDoc) {
      batch.set(countDoc.ref, { likeCount: nextCount, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      const newCountRef = doc(collection(db, 'likesCount'));
      batch.set(newCountRef, {
        feedsPostId: post.id,
        likeCount: nextCount,
        commentCount: 0,
        shareCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    if (shouldLike && !isAlreadyLiked) {
      void this.fetchPost(post.id).then((p) => {
        if (p && p.userId && p.userId !== userId) {
          const u = auth.currentUser;
          addDoc(collection(db, `users/${p.userId}/notifications`), {
            type: 'like',
            actorUserId: userId,
            actorName: u?.displayName || u?.email?.split('@')[0] || 'User',
            actorProfileImage: u?.photoURL || null,
            content: 'liked your post',
            postId: post.id,
            createdAt: serverTimestamp(),
            read: false,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    this.logger.success('PostService', 'like-firestore', { postId: post.id, userId, desiredLiked, liked: shouldLike });
    return { liked: shouldLike, likeCount: nextCount };
  }

  public async fetchPostLikes(postId: string, origin: PostOrigin, cursor?: string | null): Promise<PostLikesPage> {
    if (origin === 'community') {
      const likes = await getDocs(query(collection(db, 'communityVariantDetailsLikes'), where('postId', '==', postId), limit(50)));
      const userIds = Array.from(new Set(likes.docs.map((like) => readString(like.data().userId)).filter(Boolean)));
      const usersMap = await this.loadUserCards(userIds);
      const users = userIds.map((id) => usersMap.get(id)).filter((user): user is PostUser => Boolean(user));
      return { users, nextCursor: null, hasMore: false };
    }

    let docs: { data(): Record<string, unknown> }[];
    try {
      const q = query(
        collection(db, 'feedsPostLikeCount'),
        where('feedsPostId', '==', postId),
        where('likes', '==', true),
        orderBy('timestamp', 'desc'),
        limit(21)
      );
      const snap = await getDocs(q);
      docs = snap.docs as unknown as { data(): Record<string, unknown> }[];
    } catch {
      const fallbackSnap = await getDocs(
        query(
          collection(db, 'feedsPostLikeCount'),
          where('feedsPostId', '==', postId),
          where('likes', '==', true),
          limit(50)
        )
      );
      docs = (fallbackSnap.docs as unknown as { data(): Record<string, unknown> }[]).sort(
        (a, b) => timestampMillis(b.data().timestamp) - timestampMillis(a.data().timestamp)
      );
    }

    const hasMore = docs.length > 20;
    const pageDocs = docs.slice(0, 20);
    const userIds = Array.from(new Set(pageDocs.map((d) => readString(d.data().userId)).filter(Boolean)));
    const usersMap = await this.loadUserCards(userIds);
    const users = userIds.map((id) => usersMap.get(id)).filter((u): u is PostUser => Boolean(u));
    return {
      users,
      nextCursor: null,
      hasMore,
    };
  }

  public async voteOnPoll(postId: string, userId: string, optionId: string): Promise<{ selectedOptionId: string; counts: Record<string, number>; total: number }> {
    const postRef = doc(db, 'feedPosts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) throw new Error('Poll not found');
    const postData = (snap.data() || {}) as Record<string, unknown>;
    if (postData.type !== 'poll') throw new Error('Post is not a poll');
    const pollEndTime = postData.pollEndTime ? new Date(readString(postData.pollEndTime)).getTime() : null;
    if (pollEndTime !== null && !isNaN(pollEndTime) && pollEndTime <= Date.now()) {
      throw new Error('This poll has ended');
    }
    const currentVotes = isRecord(postData.pollVotes) ? { ...postData.pollVotes } : {};
    currentVotes[userId] = optionId;
    await updateDoc(postRef, { pollVotes: currentVotes });
    const counts = Object.values(currentVotes).reduce<Record<string, number>>((acc, val) => {
      const k = String(val);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    this.logger.success('PostService', 'poll-vote-firestore', { postId, userId, optionId });
    return {
      selectedOptionId: optionId,
      counts,
      total: Object.keys(currentVotes).length,
    };
  }

  public async recordShare(postId: string): Promise<{ path: string; shareCount: number }> {
    const countSnap = await getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1))).catch(() => null);
    let shareCount = 1;
    if (countSnap && !countSnap.empty) {
      const countDoc = countSnap.docs[0];
      shareCount = (Number((countDoc.data() as UnknownRecord)?.shareCount) || 0) + 1;
      await updateDoc(countDoc.ref, { shareCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
    } else {
      await addDoc(collection(db, 'likesCount'), {
        feedsPostId: postId,
        likeCount: 0,
        commentCount: 0,
        shareCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    return { path: `/post/${encodeURIComponent(postId)}`, shareCount };
  }

  public getPostUrl(postId: string): string {
    return this.deepLinkService.getPostShareUrl(postId);
  }

  public async repost(postId: string): Promise<string> {
    const key = `${auth.currentUser?.uid ?? ''}:${postId}`;
    const pending = this.pendingReposts.get(key);
    if (pending) return pending;
    const operation = this.createRepost(postId);
    this.pendingReposts.set(key, operation);
    try {
      return await operation;
    } finally {
      this.pendingReposts.delete(key);
    }
  }

  private async createRepost(postId: string): Promise<string> {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('You must be signed in to repost');

    const [sourceSnapshot, viewerSnapshot] = await Promise.all([
      getDoc(doc(db, 'feedPosts', postId)),
      getDoc(doc(db, 'users', currentUserId)),
    ]);
    if (!sourceSnapshot.exists()) throw new Error('Post not found');
    const sourceData = sourceSnapshot.data();
    const source = await this.resolveOriginalPost({ id: postId, data: isRecord(sourceData) ? sourceData : {} });
    if (!source) throw new Error('The original post is no longer available.');
    const viewerData = viewerSnapshot.data();
    const publicRelationships: RelationshipSets = {
      friends: new Set<string>(),
      following: new Set<string>(),
      blockedUsers: new Set(isRecord(viewerData) ? readStringArray(viewerData.blockList) : []),
    };
    if (readString(source.data.visibility, 'public') !== 'public' ||
        !this.canViewPost(source.data, currentUserId, publicRelationships)) {
      throw new Error('Only available public posts can be reposted.');
    }
    postId = source.id;

    const repostMarkerRef = doc(db, 'postReposts', `${currentUserId}_${postId}`);
    const original = source.data;
    const originalAuthorId = readString(original.userId);
    const [markerSnap, authorsMap, origCountSnap] = await Promise.all([
      getDoc(repostMarkerRef),
      this.loadUserCards([originalAuthorId]),
      getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1))),
    ]);
    if (markerSnap.exists()) {
      throw new Error('You already reposted this post');
    }
    const originalAuthor = authorsMap.get(originalAuthorId);

    const newPostRef = doc(collection(db, 'feedPosts'));
    const batch = writeBatch(db);

    batch.set(newPostRef, {
      ...original,
      userId: currentUserId,
      visibility: 'public',
      isRepost: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      repostedFrom: {
        postId,
        userId: originalAuthorId,
        userName: originalAuthor?.userName || '',
        firstName: originalAuthor?.firstName || '',
        lastName: originalAuthor?.lastName || '',
        profileImage: originalAuthor?.profileImage || '',
      },
    });

    batch.set(repostMarkerRef, {
      userId: currentUserId,
      originalPostId: postId,
      repostPostId: newPostRef.id,
      createdAt: serverTimestamp(),
    });

    if (!origCountSnap.empty) {
      batch.update(origCountSnap.docs[0].ref, { shareCount: increment(1), updatedAt: serverTimestamp() });
    }

    if (originalAuthorId && originalAuthorId !== currentUserId) {
      const u = auth.currentUser;
      batch.set(doc(collection(db, `users/${originalAuthorId}/notifications`)), {
        type: 'repost',
        actorUserId: currentUserId,
        actorName: u?.displayName || u?.email?.split('@')[0] || 'User',
        actorProfileImage: u?.photoURL || null,
        content: 'reposted your post',
        postId,
        createdAt: serverTimestamp(),
        read: false,
      });
    }

    await batch.commit();
    return newPostRef.id;
  }

  public async removeRepost(postId: string): Promise<void> {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('You must be signed in');
    const repostMarkerRef = doc(db, 'postReposts', `${currentUserId}_${postId}`);
    const markerSnap = await getDoc(repostMarkerRef);
    if (markerSnap.exists()) {
      const repostPostId = readString((markerSnap.data() as UnknownRecord)?.repostPostId);
      if (repostPostId) {
        await deleteDoc(doc(db, 'feedPosts', repostPostId)).catch(() => {});
      }
      await deleteDoc(repostMarkerRef).catch(() => {});
    }
    const q = query(
      collection(db, 'feedPosts'),
      where('userId', '==', currentUserId),
      where('repostedFrom.postId', '==', postId)
    );
    const snap = await getDocs(q).catch(() => null);
    if (snap) {
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    }
    const countSnap = await getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1))).catch(() => null);
    if (countSnap && !countSnap.empty) {
      await updateDoc(countSnap.docs[0].ref, { shareCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  public async updateVisibility(postId: string, visibility: 'public' | 'private'): Promise<void> {
    await updateDoc(doc(db, 'feedPosts', postId), { visibility, updatedAt: serverTimestamp() });
  }

  public async deletePost(postId: string, origin: PostOrigin = 'home'): Promise<void> {
    if (origin === 'community') {
      await this.deleteCommunityPost(postId);
      return;
    }
    const currentUserId = auth.currentUser?.uid;
    const postRef = doc(db, 'feedPosts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      await deleteDoc(postRef);
      if (currentUserId) {
        await updateDoc(doc(db, 'users', currentUserId), { postsCount: increment(-1) }).catch(() => {});
      }
      return;
    }
    const commRef = doc(db, 'communityVariantDetails', postId);
    const commSnap = await getDoc(commRef);
    if (commSnap.exists()) {
      await deleteDoc(commRef);
      return;
    }
    throw new Error('The post could not be deleted.');
  }

  private async getDocumentsByField(collectionName: string, field: string, values: string[]): Promise<DataDocument[]> {
    const uniqueValues = [...new Set(values.filter(Boolean))];
    if (uniqueValues.length === 0) return [];
    this.logger.info('PostService', 'join-query:start', { collection: collectionName, field, valueCount: uniqueValues.length });
    const snapshots = await Promise.all(
      Array.from({ length: Math.ceil(uniqueValues.length / 30) }, (_, index) => uniqueValues.slice(index * 30, index * 30 + 30))
        .map((valueChunk) => getDocs(query(collection(db, collectionName), where(field, 'in', valueChunk))))
    );
    const documents = snapshots.flatMap((snapshot) => snapshot.docs.map((document) => ({
      id: document.id,
      data: isRecord(document.data()) ? document.data() : {},
    })));
    this.logger.success('PostService', 'join-query', { collection: collectionName, documentCount: documents.length });
    return documents;
  }

  /** Community post removal with the same cleanup and permissions as the website's post delete route. */
  private async deleteCommunityPost(postId: string): Promise<void> {
    const viewerId = auth.currentUser?.uid;
    if (!viewerId) throw new Error('Authentication required');
    const postRef = doc(db, 'communityVariantDetails', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) throw new Error('Post not found');
    const authorId = readString(postSnap.data().userId);
    if (authorId !== viewerId) {
      const access = await communityDataService.resolveAccess(readString(postSnap.data().communityVariantId));
      if (!access?.canModerate) throw new Error('Unauthorized');
    }
    const [media, likes, comments, notifications] = await Promise.all([
      getDocs(query(collection(db, 'communityVariantDetailsSummary'), where('communityVariantDetailsId', '==', postId))),
      getDocs(query(collection(db, 'communityVariantDetailsLikes'), where('postId', '==', postId))),
      getDocs(query(collection(db, 'feedsPostComments'), where('feedsPostId', '==', postId))),
      getDocs(query(collection(db, 'notifications'), where('postId', '==', postId))),
    ]);
    const commentChildren = await Promise.all(comments.docs.map(async (comment) => {
      const [replies, commentLikes] = await Promise.all([
        getDocs(query(collection(db, 'feedsPostCommentsReplies'), where('feedsPostCommentId', '==', comment.id))),
        getDocs(query(collection(db, 'feedsPostCommentLikes'), where('targetId', '==', comment.id))),
      ]);
      return [...replies.docs, ...commentLikes.docs];
    }));
    const references = [postRef, doc(db, 'communityVariantDetailsCounter', postId), ...[...media.docs, ...likes.docs, ...comments.docs, ...notifications.docs, ...commentChildren.flat()].map((entry) => entry.ref)];
    for (let index = 0; index < references.length; index += 450) {
      const batch = writeBatch(db);
      references.slice(index, index + 450).forEach((reference) => batch.delete(reference));
      await batch.commit();
    }
  }

  private async loadUserCards(userIds: string[]): Promise<Map<string, PostUser>> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    this.logger.info('PostService', 'users:start', { userCount: uniqueUserIds.length, userIds: uniqueUserIds });
    const [userSnapshots, selections] = await Promise.all([
      Promise.all(uniqueUserIds.map((userId) => getDoc(doc(db, 'users', userId)))),
      this.getDocumentsByField('profileImageSetAs', 'userId', uniqueUserIds),
    ]);
    const selectionByUser = new Map<string, UnknownRecord>();
    selections.forEach((selection) => {
      const userId = readString(selection.data.userId);
      const current = selectionByUser.get(userId);
      const setAs = readString(selection.data.setAs);
      const currentSetAs = current ? readString(current.setAs) : '';
      if (!current || setAs === 'postProfile' || (setAs === 'profile' && currentSetAs !== 'postProfile')) {
        selectionByUser.set(userId, selection.data);
      }
    });
    const imageIds = [...new Set([...selectionByUser.values()].map((selection) => readString(selection.profileImageId)).filter(Boolean))];
    const imageSnapshots = await Promise.all(imageIds.map((imageId) => getDoc(doc(db, 'profileImages', imageId))));
    const imageUrls = new Map(imageSnapshots.map((snapshot) => {
      const rawImageData: unknown = snapshot.data();
      const imageData = isRecord(rawImageData) ? rawImageData : {};
      return [snapshot.id, this.readImageUrl(imageData)];
    }));
    const users = new Map<string, PostUser>();
    userSnapshots.forEach((snapshot) => {
      const rawUserData: unknown = snapshot.data();
      const userData = isRecord(rawUserData) ? rawUserData : {};
      const selection = selectionByUser.get(snapshot.id);
      const imageId = selection ? readString(selection.profileImageId) : '';
      users.set(snapshot.id, {
        id: snapshot.id,
        firstName: readString(userData.firstName),
        lastName: readString(userData.lastName),
        userName: readString(userData.userName),
        profileImage: imageUrls.get(imageId) || this.readDirectProfileImage(userData),
        emailVerified: typeof userData.emailVerified === 'boolean' ? userData.emailVerified : undefined,
        identityVerificationStatus: readString(userData.identityVerificationStatus) || undefined,
        verificationStatus: readString(userData.verificationStatus) || undefined,
        isAdmin: typeof userData.isAdmin === 'boolean' ? userData.isAdmin : undefined,
      });
    });
    const avatarDiagnostics = [...users.values()].map((user) => {
      const resolution = this.avatarService.resolve(user.profileImage);
      return {
        userId: user.id,
        sourceKind: resolution.kind,
        presetName: resolution.kind === 'preset' ? resolution.name : undefined,
      };
    });
    this.logger.success('PostService', 'users', {
      requestedUsers: uniqueUserIds.length,
      resolvedUsers: users.size,
      profileSelections: selections.length,
      resolvedProfileImages: [...users.values()].filter((user) => Boolean(user.profileImage)).length,
      bundledPresetAvatars: avatarDiagnostics.filter((avatar) => avatar.sourceKind === 'preset').length,
      unresolvedUserIds: [...users.values()].filter((user) => !user.profileImage).map((user) => user.id),
      avatarDiagnostics,
    });
    return users;
  }

  private async loadRelationships(viewerId: string | null): Promise<RelationshipSets> {
    const empty: RelationshipSets = { friends: new Set(), following: new Set(), blockedUsers: new Set() };
    if (!viewerId) return empty;
    this.logger.info('PostService', 'relationships:start', { viewerId });
    try {
      const [asFirst, asSecond, following, viewerSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'friendship'), where('userId1', '==', viewerId))),
        getDocs(query(collection(db, 'friendship'), where('userId2', '==', viewerId))),
        getDocs(query(collection(db, 'followers'), where('followerId', '==', viewerId))),
        getDoc(doc(db, 'users', viewerId)),
      ]);
      const friends = new Set<string>();
      asFirst.docs.forEach((item) => {
        if (item.data().friendshipStatus === 'accepted' && typeof item.data().userId2 === 'string') friends.add(item.data().userId2);
      });
      asSecond.docs.forEach((item) => {
        if (item.data().friendshipStatus === 'accepted' && typeof item.data().userId1 === 'string') friends.add(item.data().userId1);
      });
      const rawViewerData: unknown = viewerSnapshot.data();
      const viewerData = isRecord(rawViewerData) ? rawViewerData : {};
      const result = {
        friends,
        following: new Set(following.docs.map((item) => readString(item.data().followeeId)).filter(Boolean)),
        blockedUsers: new Set(readStringArray(viewerData.blockList)),
      };
      this.logger.success('PostService', 'relationships', {
        friendCount: result.friends.size,
        followingCount: result.following.size,
        blockedCount: result.blockedUsers.size,
      });
      return result;
    } catch (error: unknown) {
      this.logger.warn('PostService', 'relationships-unavailable', {
        viewerId,
        error: error instanceof Error ? error.message : String(error),
        behavior: 'continuing with public and viewer-owned posts only',
      });
      return empty;
    }
  }

  private canViewPost(post: UnknownRecord, viewerId: string | null, relationships: RelationshipSets): boolean {
    if (post.isDeleted === true || post.status === 'deleted' || post.deletionSource === 'admin_moderation' || accountLifecycleVisibilityService.isHidden(post)) return false;
    const userId = readString(post.userId);
    const hiddenUntil = timestampMillis(post.hiddenUntil);
    const hidden = (post.isHidden === true || post.moderationVisibility === 'hidden') && (!hiddenUntil || hiddenUntil > Date.now());
    if (hidden) return false;
    if ((post.isRestricted === true || post.moderationVisibility === 'restricted') && userId !== viewerId) return false;
    if (viewerId && relationships.blockedUsers.has(userId)) return false;
    const visibility = readString(post.visibility, 'public');
    if (visibility === 'public' || !post.visibility) return true;
    if (!viewerId) return false;
    if (userId === viewerId) return true;
    if (visibility === 'friends') return relationships.friends.has(userId);
    if (visibility === 'friends_followers') return relationships.friends.has(userId) || relationships.following.has(userId);
    return false;
  }

  private readFriendshipStatus(value: unknown): PostRelationshipStatus['friendshipStatus'] {
    return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'none';
  }

  private mapPost(document: DataDocument, user: PostUser, media: PostMedia[], counts: UnknownRecord, likedUserIds: string[]): PostItem {
    const record = document.data;
    const pollVotes = isRecord(record.pollVotes)
      ? Object.fromEntries(Object.entries(record.pollVotes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {};
    const voteTotals = Object.values(pollVotes).reduce<Record<string, number>>((totals, optionId) => {
      totals[optionId] = (totals[optionId] ?? 0) + 1;
      return totals;
    }, {});
    const pollOptions = Array.isArray(record.pollOptions)
      ? record.pollOptions.flatMap((value, index): PollOption[] => {
          if (!isRecord(value)) return [];
          const id = readString(value.id, String(index + 1));
          const text = readString(value.text);
          return text ? [{ id, text, votes: voteTotals[id] ?? 0 }] : [];
        })
      : undefined;
    const locationRecord = isRecord(record.location) ? record.location : undefined;
    const locationName = locationRecord ? readString(locationRecord.name, readString(locationRecord.address)) : readString(record.location);
    const rawVisibility = readString(record.visibility, 'public');
    const visibility: PostVisibility = rawVisibility === 'friends' || rawVisibility === 'friends_followers' || rawVisibility === 'private'
      ? rawVisibility
      : 'public';
    return {
      id: document.id,
      origin: readString(record.communityId) || readString(record.communityVariantId) || readString(record.community_id) ? 'community' : 'home',
      userId: readString(record.userId, user.id),
      user,
      type: record.type === 'poll' || record.type === 'event' ? record.type : 'regular',
      caption: readString(record.caption, readString(record.content, readString(record.title))),
      description: (() => {
        const rawDesc = readString(record.description).trim();
        const cap = readString(record.caption, readString(record.content, readString(record.title))).trim();
        return rawDesc && rawDesc !== cap ? rawDesc : '';
      })(),
      visibility,
      hashtags: readStringArray(record.hashtags).map((tag) => tag.replace(/^#/, '')),
      media,
      stats: {
        likes: readNumber(counts.likeCount),
        comments: readNumber(counts.commentCount),
        shares: readNumber(counts.shareCount),
      },
      likedUserIds,
      mentions: readStringArray(record.mentions),
      friendReferences: readStringArray(record.friendReferences),
      createdAt: readDate(record.createdAt),
      pollDuration: typeof record.pollDuration === 'number' ? record.pollDuration : undefined,
      pollEndTime: record.pollEndTime ? readDate(record.pollEndTime) : undefined,
      pollOptions,
      pollVotes,
      communityId: readString(record.communityId)
        || readString(record.communityVariantId)
        || readString(record.community_id)
        || (isRecord(record.community) ? readString(record.community.id) : undefined),
      communityName: readString(record.communityName)
        || readString(record.community_name)
        || readString(record.communityTitle)
        || readString(record.community_title)
        || (isRecord(record.community) ? readString(record.community.name, readString(record.community.title)) : undefined),
      communitySlug: readString(record.communitySlug) || undefined,
      communityAvatar: readString(record.communityAvatar) || undefined,
      location: locationName ? {
        name: locationName,
        address: locationRecord ? readString(locationRecord.address) || undefined : undefined,
        lat: locationRecord && typeof locationRecord.lat === 'number' ? locationRecord.lat : undefined,
        lng: locationRecord && typeof locationRecord.lng === 'number' ? locationRecord.lng : undefined,
      } : undefined,
    };
  }

  private emptyUser(userId: string): PostUser {
    return { id: userId, firstName: '', lastName: '', userName: '' };
  }

  public async getCommentCount(postId: string, source: 'feed' | 'community' = 'feed'): Promise<number> {
    const collectionName = source === 'community' ? 'communityVariantDetailsComments' : 'feedsPostComments';
    const idField = source === 'community' ? 'communityVariantDetailsId' : 'feedsPostId';
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), where(idField, '==', postId)));
      return snapshot.size;
    } catch (error: unknown) {
      this.logger.error('PostService', 'getCommentCount', error, { postId, source });
      throw error;
    }
  }

  private readImageUrl(record: UnknownRecord): string {
    return readString(record.imageURL)
      || readString(record.imageUrl)
      || readString(record.downloadURL)
      || readString(record.url);
  }

  private readDirectProfileImage(record: UnknownRecord): string | undefined {
    const nestedProfileImage = isRecord(record.profileImage) ? this.readImageUrl(record.profileImage) : '';
    return nestedProfileImage
      || readString(record.profileImage)
      || readString(record.profilePicture)
      || readString(record.avatar)
      || readString(record.photoURL)
      || undefined;
  }

}

export const postService = PostService.getInstance();
