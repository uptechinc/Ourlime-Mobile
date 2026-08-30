import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import { ApiService, ApiServiceError } from './ApiService';
import { DeepLinkService } from './DeepLinkService';
import { PostMediaService, type MediaUploadProgress } from './PostMediaService';
import type { PageResult } from '@/lib/types/serviceResults';
import { buildFeedQuery } from '@/lib/posts/FeedQuery';

export type PostMediaType = 'image' | 'video';
export type PostType = 'regular' | 'poll' | 'event';
export type PostVisibility = 'public' | 'friends' | 'friends_followers' | 'private';
export type FeedFilter = 'all' | 'photo' | 'video' | 'audio' | 'poll' | 'event';
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
};
export type PostMedia = { id: string; type: PostMediaType; typeUrl: string; fileName: string; thumbnailUrl?: string };
export type PostUser = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  accountType?: string;
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
};

export type FeedPage = Omit<PageResult<PostItem>, 'items'> & { posts: PostItem[] };
export type PostLikesPage = { users: PostUser[]; nextCursor: string | null; hasMore: boolean };

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
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date(0).toISOString();
};
const timestampMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
};

export class PostService {
  private static instance: PostService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly avatarService = AvatarService.getInstance();
  private readonly apiService = ApiService.getInstance();
  private readonly deepLinkService = DeepLinkService.getInstance();
  private readonly mediaService = PostMediaService.getInstance();

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
    const snapshot = await getCountFromServer(
      query(collection(db, 'feedPosts'), where('userId', '==', userId)),
    );
    return snapshot.data().count;
  }

  public async fetchCommunityPosts(communityId: string): Promise<PostItem[]> {
    try {
      const response = await this.apiService.request<{ data?: unknown[]; error?: string }>(
        `/api/communities/fetch?type=posts&id=${encodeURIComponent(communityId)}`,
        { authenticated: true, timeoutMs: 18_000 }
      );
      if (!response.data) throw new Error(response.error || 'Failed to load community posts');
      return response.data.flatMap((record): PostItem[] => {
        const mapped = this.mapApiPost(record);
        return mapped ? [{ ...mapped, origin: 'community', communityId }] : [];
      });
    } catch (error: unknown) {
      if (!this.canUseFirestore(error)) throw error;
      return this.fetchCommunityPostsFromFirestore(communityId);
    }
  }

  public async fetchFeedPage(options: {
    limit?: number;
    cursor?: string | null;
    filter?: FeedFilter;
    scope?: FeedScope;
    authorId?: string;
    signal?: AbortSignal;
  } = {}): Promise<FeedPage> {
    const search = buildFeedQuery(options);
    try {
      const response = await this.apiService.request<FeedApiResponse>(
        `/api/home/MiddleSection/Post?${search}`,
        { authenticated: Boolean(auth.currentUser), signal: options.signal, timeoutMs: 8_000 }
      );
      if (!response.success) throw new Error(response.error || 'Failed to load posts');
      const posts = (response.data ?? []).flatMap((record): PostItem[] => {
        const mapped = this.mapApiPost(record);
        return mapped ? [mapped] : [];
      });
      this.logger.success('PostService', 'feed-api', {
        scope: options.scope ?? 'home',
        renderedPostCount: posts.length,
        hasMore: response.pagination?.hasMore === true,
        hasCursor: Boolean(response.pagination?.nextCursor),
      });
      return {
        posts,
        nextCursor: response.pagination?.nextCursor ?? null,
        hasMore: response.pagination?.hasMore === true,
      };
    } catch (error: unknown) {
      if (options.signal?.aborted) throw error;
      this.logger.warn('PostService', 'feed-api:fallback-to-firestore', { scope: options.scope, error: String(error) });
      try {
        return await this.fetchFeedPageFromFirestore(options);
      } catch (fsError: unknown) {
        this.logger.error('PostService', 'feed-firestore:error', fsError);
        throw fsError instanceof Error ? fsError : new Error('Unable to load the feed.');
      }
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
        const filter = options.filter ?? 'all';
        if (filter === 'all') return true;
        if (filter === 'poll' || filter === 'event') return document.data.type === filter;
        const media = mediaByPost.get(document.id) ?? [];
        if (filter === 'photo') return media.some((item) => item.type === 'image');
        if (filter === 'video') return media.some((item) => item.type === 'video');
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
    const visibleDocuments = rawDocuments.filter((document) => {
      if (!this.canViewPost(document.data, viewerId, relationships)) return false;
      if (options.scope === 'friends') return relationships.friends.has(readString(document.data.userId));
      return true;
    });
    const postIds = visibleDocuments.map((document) => document.id);
    const [mediaDocuments, countDocuments, likeDocuments] = await Promise.all([
      this.getDocumentsByField('feedsPostSummary', 'feedsPostId', postIds),
      this.getDocumentsByField('likesCount', 'feedsPostId', postIds),
      this.getDocumentsByField('feedsPostLikeCount', 'feedsPostId', postIds),
    ]);

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
      const filter = options.filter ?? 'all';
      if (filter === 'all') return true;
      if (filter === 'poll' || filter === 'event') return document.data.type === filter;
      const media = mediaByPost.get(document.id) ?? [];
      if (filter === 'photo') return media.some((item) => item.type === 'image');
      if (filter === 'video') return media.some((item) => item.type === 'video');
      return false;
    });
    const pageDocuments = filteredDocuments.slice(0, fetchLimit);
    const usersMap = await this.loadUserCards(pageDocuments.map((document) => readString(document.data.userId)));
    const posts = pageDocuments.map((document) => {
      const userId = readString(document.data.userId);
      return this.mapPost(
        document,
        usersMap.get(userId) ?? this.emptyUser(userId),
        mediaByPost.get(document.id) ?? [],
        countsByPost.get(document.id) ?? document.data,
        likedUsersByPost.get(document.id) ?? [],
      );
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

  public async createPost(input: CreatePostInput): Promise<PostItem> {
    const draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
      });
      const media = upload.media;
      uploadedPaths = upload.storagePaths;
      const pollDuration = input.type === 'poll' ? input.pollDuration ?? 24 : undefined;
      const pollEndTime = pollDuration ? new Date(Date.now() + pollDuration * 60 * 60 * 1000).toISOString() : undefined;
      const pollOptions = input.type === 'poll'
        ? (input.pollOptions ?? []).map((option) => ({ ...option, votes: 0 }))
        : undefined;
      if (input.communityId) {
        if (input.type !== 'regular') throw new Error('Community polls and events use their dedicated creation tools');
        const communityPost = await addDoc(collection(db, 'communityVariantDetails'), {
          title: input.caption.trim(),
          caption: input.caption.trim(),
          content: input.caption.trim(),
          description: input.description.trim() || input.caption.trim(),
          visibility: 'community',
          createdAt: serverTimestamp(),
          userId: input.userId,
          communityVariantId: input.communityId,
          hashtags: input.hashtags,
          mentions: input.mentions,
        });
        const mediaRecords = await Promise.all(media.map(async (mediaItem) => {
          const summary = await addDoc(collection(db, 'communityVariantDetailsSummary'), {
            type: mediaItem.type,
            typeUrl: mediaItem.typeUrl,
            fileName: mediaItem.fileName,
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
          description: input.description.trim() || input.caption.trim(),
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
      const response = await this.apiService.request<{
        success: boolean;
        data?: { postId?: string; location?: PostLocation | null };
        error?: string;
      }>('/api/home/MiddleSection/Post/createPost', {
        method: 'POST',
        authenticated: true,
        signal: input.signal,
        body: {
          userId: input.userId,
          type: input.type,
          caption: input.caption.trim(),
          description: input.description.trim(),
          visibility: input.visibility,
          hashtags: input.hashtags,
          mentions: input.mentions,
          friendReferences: input.friendReferences,
          media: input.type === 'poll' ? [] : media,
          pollData: input.type === 'poll' ? {
            options: (input.pollOptions ?? []).map((option) => ({ id: option.id, text: option.text.trim() })),
            duration: pollDuration,
            endTime: pollEndTime,
            image: media[0]?.typeUrl ?? null,
          } : undefined,
          location: input.location ?? null,
        },
      });
      const postId = response.data?.postId;
      if (!response.success || !postId) throw new Error(response.error || 'Post was not created');
      this.logger.success('PostService', 'create', {
        postId,
        mediaCount: media.length,
        transport: 'web-api',
      });
      try {
        return await this.fetchPost(postId);
      } catch (error: unknown) {
        this.logger.warn('PostService', 'create-hydration-fallback', {
          postId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return {
        id: postId,
        origin: 'home',
        userId: input.userId,
        user: input.user,
        type: input.type,
        caption: input.caption.trim(),
        description: input.description.trim(),
        visibility: input.visibility,
        hashtags: input.hashtags,
        media,
        mentions: input.mentions,
        friendReferences: input.friendReferences,
        stats: { likes: 0, comments: 0, shares: 0 },
        likedUserIds: [],
        createdAt: new Date().toISOString(),
        pollOptions,
        pollDuration,
        pollEndTime,
        pollVotes: {},
        location: response.data?.location ?? input.location,
      };
    } catch (error: unknown) {
      if (uploadedPaths.length > 0) await this.mediaService.cleanup(uploadedPaths);
      this.logger.error('PostService', 'create', error, { userId: input.userId, draftId });
      throw error;
    }
  }

  public async fetchPost(postId: string): Promise<PostItem> {
    const response = await this.apiService.request<{ success: boolean; data?: unknown; error?: string }>(
      `/api/posts/${encodeURIComponent(postId)}`,
      { authenticated: Boolean(auth.currentUser) }
    );
    const post = this.mapApiPost(response.data);
    if (!response.success || !post) throw new Error(response.error || 'Post not found');
    return post;
  }

  public async toggleLike(post: Pick<PostItem, 'id' | 'origin'>, userId: string, desiredLiked: boolean): Promise<CommunityReactionResult> {
    if (post.origin === 'community') {
      const response = await this.apiService.request<{ status?: string; data?: CommunityReactionResult; error?: string }>('/api/communities/like', {
        method: 'POST',
        authenticated: true,
        body: { postId: post.id, desiredLiked },
      });
      if (response.status !== 'success' || !response.data) throw new Error(response.error || 'Failed to update community like');
      return response.data;
    }
    const response = await this.apiService.request<{
      success: boolean;
      data?: { liked?: boolean; likeCount?: number };
      error?: string;
    }>('/api/home/MiddleSection/Post/Likes', { method: 'POST', authenticated: true, body: { postId: post.id, desiredLiked } });
    if (!response.success || typeof response.data?.liked !== 'boolean') throw new Error(response.error || 'Failed to update like');
    this.logger.success('PostService', 'like-api', { postId: post.id, userId, desiredLiked, liked: response.data.liked });
    return { liked: response.data.liked, likeCount: response.data.likeCount ?? 0 };
  }

  public async fetchPostLikes(postId: string, origin: PostOrigin, cursor?: string | null): Promise<PostLikesPage> {
    const search = new URLSearchParams({ postId });
    if (cursor) search.set('cursor', cursor);
    const response = await this.apiService.request<{
      success: boolean;
      data?: unknown[];
      error?: string;
      pagination?: { nextCursor?: number | string | null; hasMore?: boolean };
    }>(`${origin === 'community' ? '/api/communities/like' : '/api/home/MiddleSection/Post/Likes'}?${search.toString()}`, { authenticated: Boolean(auth.currentUser) });
    if (!response.success) throw new Error(response.error || 'Failed to load likes');
    const users = (response.data ?? []).flatMap((value): PostUser[] => {
      if (!isRecord(value)) return [];
      const id = readString(value.id);
      if (!id) return [];
      return [{
        id,
        firstName: readString(value.firstName),
        lastName: readString(value.lastName),
        userName: readString(value.userName),
        profileImage: readString(value.profileImage) || undefined,
        emailVerified: typeof value.emailVerified === 'boolean' ? value.emailVerified : undefined,
        isAdmin: typeof value.isAdmin === 'boolean' ? value.isAdmin : undefined,
        accountType: readString(value.accountType) || undefined,
      }];
    });
    const nextCursor = response.pagination?.nextCursor;
    return { users, nextCursor: nextCursor === null || nextCursor === undefined ? null : String(nextCursor), hasMore: response.pagination?.hasMore === true };
  }

  public async voteOnPoll(postId: string, userId: string, optionId: string): Promise<{ selectedOptionId: string; counts: Record<string, number>; total: number }> {
    const response = await this.apiService.request<{
      success: boolean;
      data?: { selectedOptionId?: string; counts?: Record<string, number>; total?: number };
      error?: string;
    }>(`/api/posts/${encodeURIComponent(postId)}/vote`, {
      method: 'POST',
      authenticated: true,
      body: { optionId },
    });
    if (!response.success || !response.data?.selectedOptionId) throw new Error(response.error || 'Failed to record vote');
    this.logger.success('PostService', 'poll-vote-api', { postId, userId, optionId });
    return {
      selectedOptionId: response.data.selectedOptionId,
      counts: response.data.counts ?? {},
      total: response.data.total ?? 0,
    };
  }

  public async recordShare(postId: string): Promise<{ path: string; shareCount: number }> {
    const response = await this.apiService.request<{ success: boolean; data?: { path?: string; shareCount?: number }; error?: string }>(
      `/api/posts/${encodeURIComponent(postId)}/share`,
      { method: 'POST', body: { increment: true } },
    );
    if (!response.success || !response.data?.path) throw new Error(response.error || 'Failed to record share');
    return { path: response.data.path, shareCount: response.data.shareCount ?? 0 };
  }

  public getPostUrl(postId: string): string {
    return this.deepLinkService.getPostShareUrl(postId);
  }

  public async repost(postId: string): Promise<string> {
    try {
      const response = await this.apiService.request<{ success: boolean; data?: { postId?: string }; error?: string }>(
          `/api/posts/${encodeURIComponent(postId)}/repost`,
          { method: 'POST', authenticated: true, timeoutMs: 12_000 }
      );
      if (!response.success || !response.data?.postId) throw new Error(response.error || 'Failed to repost');

      if (auth.currentUser) {
        void this.fetchPost(postId).then((post) => {
          if (post && auth.currentUser && post.userId !== auth.currentUser.uid) {
            const u = auth.currentUser;
            addDoc(collection(db, `users/${post.userId}/notifications`), {
              type: 'repost',
              actorUserId: u.uid,
              actorName: u.displayName || u.email?.split('@')[0] || 'User',
              actorProfileImage: u.photoURL || null,
              content: 'reposted your post',
              postId,
              createdAt: serverTimestamp(),
              read: false,
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      return response.data.postId;
    } catch (error: unknown) {
      if (!this.canUseFirestore(error)) throw error;
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) throw new Error('You must be signed in to repost');
      const postRef = doc(db, 'feedPosts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) throw new Error('Post not found');
      const postData = (postSnap.data() || {}) as UnknownRecord;

      const newPostRef = await addDoc(collection(db, 'feedPosts'), {
        userId: currentUserId,
        type: 'repost',
        caption: postData.caption || '',
        description: postData.description || '',
        visibility: 'public',
        repostedFrom: {
          postId,
          userId: postData.userId || '',
        },
        createdAt: serverTimestamp(),
        hashtags: postData.hashtags || [],
      });

      await updateDoc(postRef, {
        repostedBy: arrayUnion(currentUserId),
      }).catch(() => {});

      return newPostRef.id;
    }
  }

  public async removeRepost(postId: string): Promise<void> {
    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(
          `/api/posts/${encodeURIComponent(postId)}/repost`,
          { method: 'DELETE', authenticated: true, timeoutMs: 12_000 }
      );
      if (!response.success) throw new Error(response.error || 'Failed to remove repost');
    } catch (error: unknown) {
      if (!this.canUseFirestore(error)) throw error;
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) throw new Error('You must be signed in');
      const postRef = doc(db, 'feedPosts', postId);
      await updateDoc(postRef, {
        repostedBy: arrayRemove(currentUserId),
      }).catch(() => {});

      const q = query(
        collection(db, 'feedPosts'),
        where('userId', '==', currentUserId),
        where('repostedFrom.postId', '==', postId)
      );
      const snap = await getDocs(q).catch(() => null);
      if (snap) {
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      }
    }
  }

  public async updateVisibility(postId: string, visibility: 'public' | 'private'): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>(
      `/api/posts/${encodeURIComponent(postId)}`,
      {
        method: 'PATCH',
        authenticated: true,
        body: { visibility },
      }
    );
    if (!response.success) throw new Error(response.error || 'Failed to update post visibility');
  }

  public async deletePost(postId: string): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>(
      `/api/posts/${encodeURIComponent(postId)}`,
      { method: 'DELETE', authenticated: true }
    );
    if (!response.success) throw new Error(response.error || 'The post could not be deleted.');
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

  private mapApiPost(value: unknown): PostItem | null {
    if (!isRecord(value)) return null;
    const id = readString(value.id);
    if (!id) return null;
    const userRecord = isRecord(value.user) ? value.user : isRecord(value.author) ? value.author : {};
    const userId = readString(value.userId, readString(userRecord.id));
    const user: PostUser = {
      id: readString(userRecord.id, userId),
      firstName: readString(userRecord.firstName),
      lastName: readString(userRecord.lastName),
      userName: readString(userRecord.userName),
      profileImage: readString(userRecord.profileImage) || undefined,
      emailVerified: typeof userRecord.emailVerified === 'boolean' ? userRecord.emailVerified : undefined,
      isAdmin: typeof userRecord.isAdmin === 'boolean' ? userRecord.isAdmin : undefined,
      accountType: readString(userRecord.accountType) || undefined,
    };
    const rawMedia = Array.isArray(value.mediaDetails) ? value.mediaDetails : value.media;
    const media = Array.isArray(rawMedia)
      ? rawMedia.flatMap((item, index): PostMedia[] => {
          if (!isRecord(item)) return [];
          const typeUrl = readString(item.typeUrl);
          if (!typeUrl) return [];
          return [{
            id: readString(item.id, `${id}-${index}`),
            type: item.type === 'video' ? 'video' : 'image',
            typeUrl,
            fileName: readString(item.fileName),
          }];
        })
      : [];
    const stats = isRecord(value.stats) ? value.stats : {};
    const rawLikedUsers = Array.isArray(value.likedUsers) ? value.likedUsers : [];
    const likedUsers: PostUser[] = rawLikedUsers.flatMap((likedUser): PostUser[] => {
      if (!isRecord(likedUser)) return [];
      const likedUserId = readString(likedUser.id);
      if (!likedUserId) return [];
      return [{
        id: likedUserId,
        firstName: readString(likedUser.firstName),
        lastName: readString(likedUser.lastName),
        userName: readString(likedUser.userName),
        profileImage: readString(likedUser.profileImage) || undefined,
        emailVerified: typeof likedUser.emailVerified === 'boolean' ? likedUser.emailVerified : undefined,
      }];
    });
    const likedUserIds = likedUsers.length > 0
      ? likedUsers.map((item) => item.id)
      : Array.isArray(value.likedUserIds)
      ? value.likedUserIds.flatMap((likedUserId): string[] => typeof likedUserId === 'string' && likedUserId ? [likedUserId] : [])
      : [];
    const post = this.mapPost(
      { id, data: value },
      user,
      media,
      {
        likeCount: readNumber(stats.likes, readNumber(value.likeCount)),
        commentCount: readNumber(stats.comments, readNumber(value.commentCount)),
        shareCount: readNumber(stats.shares, readNumber(value.shareCount)),
      },
      likedUserIds
    );
    const repostedFromRecord = isRecord(value.repostedFrom) ? value.repostedFrom : null;
    const repostedByUserIds = Array.isArray(value.repostedBy)
      ? value.repostedBy.flatMap((reposter): string[] => {
          const reposterUserId = typeof reposter === 'string'
            ? reposter
            : isRecord(reposter) ? readString(reposter.id) : '';
          return reposterUserId ? [reposterUserId] : [];
        })
      : [];
    const relationshipRecord = isRecord(value.relationshipStatus) ? value.relationshipStatus : null;
    return {
      ...post,
      likedUsers: likedUsers.length > 0 ? likedUsers : undefined,
      repostedFrom: repostedFromRecord ? {
        postId: readString(repostedFromRecord.postId),
        userId: readString(repostedFromRecord.userId),
        userName: readString(repostedFromRecord.userName),
        firstName: readString(repostedFromRecord.firstName),
        lastName: readString(repostedFromRecord.lastName),
        profileImage: readString(repostedFromRecord.profileImage) || undefined,
      } : undefined,
      repostedByViewer: value.repostedByViewer === true,
      repostedByUserIds,
      relationshipStatus: relationshipRecord ? {
        isFollowing: relationshipRecord.isFollowing === true,
        friendshipStatus: this.readFriendshipStatus(relationshipRecord.friendshipStatus),
      } : undefined,
      communityId: readString(value.communityId) || undefined,
      communityName: readString(value.communityName) || readString(value.communityTitle) || undefined,
      communitySlug: readString(value.communitySlug) || undefined,
      communityAvatar: readString(value.communityAvatar) || undefined,
      eventId: readString(value.eventId) || undefined,
      startDate: readString(value.startDate) || undefined,
      endDate: readString(value.endDate) || undefined,
      recurrence: readString(value.recurrence) || undefined,
      category: readString(value.category) || undefined,
    };
  }

  private readFriendshipStatus(value: unknown): PostRelationshipStatus['friendshipStatus'] {
    return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'none';
  }

  private async fetchCommunityPostsFromFirestore(communityId: string): Promise<PostItem[]> {
    const snapshot = await getDocs(query(collection(db, 'communityVariantDetails'), where('communityVariantId', '==', communityId)));
    const documents: DataDocument[] = snapshot.docs
      .map((document) => ({ id: document.id, data: isRecord(document.data()) ? document.data() : {} }))
      .sort((left, right) => timestampMillis(right.data.createdAt) - timestampMillis(left.data.createdAt));
    const postIds = documents.map((document) => document.id);
    const [mediaDocuments, likeDocuments, counters] = await Promise.all([
      this.getDocumentsByField('communityVariantDetailsSummary', 'communityVariantDetailsId', postIds),
      this.getDocumentsByField('communityVariantDetailsLikes', 'postId', postIds),
      Promise.all(postIds.map((postId) => getDoc(doc(db, 'communityVariantDetailsCounter', postId)))),
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
      }]);
    });
    const likedUsersByPost = new Map<string, string[]>();
    likeDocuments.forEach((document) => {
      const postId = readString(document.data.postId);
      const userId = readString(document.data.userId);
      if (postId && userId) likedUsersByPost.set(postId, [...(likedUsersByPost.get(postId) ?? []), userId]);
    });
    const users = await this.loadUserCards(documents.map((document) => readString(document.data.userId)));
    const posts = documents.map((document, index) => {
      const userId = readString(document.data.userId);
      const counter = counters[index]?.data() ?? {};
      return this.mapPost(
        document,
        users.get(userId) ?? this.emptyUser(userId),
        mediaByPost.get(document.id) ?? [],
        { ...document.data, ...counter },
        likedUsersByPost.get(document.id) ?? [],
      );
    });
    this.logger.success('PostService', 'community-posts:firestore', { communityId, renderedPostCount: posts.length });
    return posts;
  }

  private canUseFirestore(error: unknown): boolean {
    return error instanceof ApiServiceError
      && (error.code === 'REQUEST_TIMEOUT' || error.code === 'NETWORK_ERROR' || error.status >= 500);
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
      description: readString(record.description, readString(record.content)),
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
