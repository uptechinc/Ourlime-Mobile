import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
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
import { ApiService } from './ApiService';
import { PostMediaService, type MediaUploadProgress } from './PostMediaService';

export type PostMediaType = 'image' | 'video';
export type PostType = 'regular' | 'poll' | 'event';
export type PostVisibility = 'public' | 'friends' | 'friends_followers' | 'private';
export type FeedFilter = 'all' | 'photo' | 'video' | 'audio' | 'poll' | 'event';

export type PostMediaDraft = {
  uri: string;
  type: PostMediaType;
  fileName: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  durationSeconds?: number;
};
export type PostMedia = { id: string; type: PostMediaType; typeUrl: string; fileName: string };
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
export type PostLocation = { name: string; address?: string; lat?: number; lng?: number };
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
  userId: string;
  user: PostUser;
  type: PostType;
  caption: string;
  description: string;
  visibility: PostVisibility;
  hashtags: string[];
  media: PostMedia[];
  stats: PostStats;
  likedUserIds: string[];
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
  relationshipStatus?: PostRelationshipStatus;
  communityId?: string;
  communityName?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  category?: string;
};

export type FeedPage = {
  posts: PostItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
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
  private readonly mediaService = PostMediaService.getInstance();

  private constructor() {}

  public static getInstance(): PostService {
    if (!PostService.instance) PostService.instance = new PostService();
    return PostService.instance;
  }

  public async fetchPosts(fetchLimit = 20): Promise<PostItem[]> {
    return (await this.fetchFeedPage({ limit: fetchLimit })).posts;
  }

  public async fetchFeedPage(options: {
    limit?: number;
    cursor?: string | null;
    filter?: FeedFilter;
    authorId?: string;
    signal?: AbortSignal;
  } = {}): Promise<FeedPage> {
    const search = new URLSearchParams({
      pageSize: String(options.limit ?? 20),
      filter: options.filter ?? 'all',
    });
    if (options.cursor) search.set('cursor', options.cursor);
    if (options.authorId) search.set('authorId', options.authorId);
    try {
      const response = await this.apiService.request<FeedApiResponse>(
        `/api/home/MiddleSection/Post?${search.toString()}`,
        { authenticated: Boolean(auth.currentUser), signal: options.signal }
      );
      if (!response.success) throw new Error(response.error || 'Failed to load posts');
      const posts = (response.data ?? []).flatMap((record): PostItem[] => {
        const mapped = this.mapApiPost(record);
        return mapped ? [mapped] : [];
      });
      this.logger.success('PostService', 'feed-api', {
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
      this.logger.warn('PostService', 'feed-api:fallback-to-firestore', { error: String(error) });
      try {
        return await this.fetchFeedPageFromFirestore(options);
      } catch (fsError: unknown) {
        this.logger.error('PostService', 'feed-firestore:error', fsError);
        return { posts: [], nextCursor: null, hasMore: false };
      }
    }
  }

  private async fetchFeedPageFromFirestore(options: {
    limit?: number;
    cursor?: string | null;
    filter?: FeedFilter;
    authorId?: string;
  }): Promise<FeedPage> {
    const fetchLimit = options.limit ?? 20;
    const postsRef = collection(db, 'posts');
    const queryConstraints: any[] = [orderBy('createdAt', 'desc'), limit(fetchLimit)];
    if (options.authorId) {
      queryConstraints.unshift(where('userId', '==', options.authorId));
    }
    if (options.filter === 'poll') {
      queryConstraints.unshift(where('type', '==', 'poll'));
    } else if (options.filter === 'event') {
      queryConstraints.unshift(where('type', '==', 'event'));
    }
    const q = query(postsRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const userIds = Array.from(new Set(snapshot.docs.map((docSnap) => docSnap.data().userId).filter((id): id is string => typeof id === 'string' && Boolean(id))));
    const usersMap = new Map<string, PostUser>();

    await Promise.all(
      userIds.slice(0, 15).map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            usersMap.set(uid, {
              id: uid,
              firstName: readString(data.firstName, 'User'),
              lastName: readString(data.lastName),
              userName: readString(data.userName, 'user'),
              profileImage: readString(data.profileImage) || undefined,
            });
          }
        } catch (_) {}
      })
    );

    const posts: PostItem[] = snapshot.docs.flatMap((docSnap) => {
      const data = docSnap.data();
      const userId = readString(data.userId);
      const user = usersMap.get(userId) || {
        id: userId,
        firstName: readString(data.userName, 'User'),
        lastName: '',
        userName: readString(data.userName, 'user'),
      };
      const mediaList = Array.isArray(data.media)
        ? data.media.flatMap((item: any, index: number): PostMedia[] => {
            if (typeof item === 'object' && item !== null) {
              const typeUrl = readString(item.typeUrl);
              if (typeUrl) {
                return [{
                  id: readString(item.id, `${docSnap.id}-${index}`),
                  type: item.type === 'video' ? 'video' : 'image',
                  typeUrl,
                  fileName: readString(item.fileName),
                }];
              }
            }
            return [];
          })
        : [];
      const mapped = this.mapPost(
        { id: docSnap.id, data },
        user,
        mediaList,
        {
          likeCount: readNumber(data.likeCount),
          commentCount: readNumber(data.commentCount),
          shareCount: readNumber(data.shareCount),
        },
        []
      );
      return mapped ? [mapped] : [];
    });

    this.logger.success('PostService', 'feed-firestore', {
      renderedPostCount: posts.length,
      hasMore: snapshot.docs.length >= fetchLimit,
    });

    return {
      posts,
      nextCursor: snapshot.docs.length >= fetchLimit ? snapshot.docs[snapshot.docs.length - 1].id : null,
      hasMore: snapshot.docs.length >= fetchLimit,
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

  public async toggleLike(postId: string, userId: string, isLiked: boolean): Promise<{ liked: boolean; likeCount: number }> {
    const response = await this.apiService.request<{
      success: boolean;
      data?: { liked?: boolean; likeCount?: number };
      error?: string;
    }>('/api/home/MiddleSection/Post/Likes', {
      method: 'POST',
      authenticated: true,
      body: { postId },
    });
    if (!response.success || typeof response.data?.liked !== 'boolean') throw new Error(response.error || 'Failed to update like');
    this.logger.success('PostService', 'like-api', { postId, userId, previousLiked: isLiked, liked: response.data.liked });
    return { liked: response.data.liked, likeCount: response.data.likeCount ?? 0 };
  }

  public async fetchPostLikes(postId: string, cursor?: string | null): Promise<PostLikesPage> {
    const search = new URLSearchParams({ postId });
    if (cursor) search.set('cursor', cursor);
    const response = await this.apiService.request<{
      success: boolean;
      data?: unknown[];
      error?: string;
      pagination?: { nextCursor?: number | string | null; hasMore?: boolean };
    }>(`/api/home/MiddleSection/Post/Likes?${search.toString()}`, { authenticated: Boolean(auth.currentUser) });
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
    const response = await this.apiService.request<{
      success: boolean;
      data?: { path?: string; shareCount?: number };
      error?: string;
    }>(`/api/posts/${encodeURIComponent(postId)}/share`, {
      method: 'POST',
      body: { increment: true },
    });
    if (!response.success || !response.data?.path) throw new Error(response.error || 'Failed to record share');
    return { path: response.data.path, shareCount: response.data.shareCount ?? 0 };
  }

  public getPostUrl(postId: string): string {
    return `${this.apiService.getBaseUrl()}/post/${encodeURIComponent(postId)}`;
  }

  public async repost(postId: string): Promise<string> {
    const response = await this.apiService.request<{ success: boolean; data?: { postId?: string }; error?: string }>(
      `/api/posts/${encodeURIComponent(postId)}/repost`,
      { method: 'POST', authenticated: true }
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
  }

  public async deletePost(postId: string): Promise<void> {
    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(
        `/api/posts/${encodeURIComponent(postId)}`,
        { method: 'DELETE', authenticated: true }
      );
      if (response.success) return;
    } catch {
      // ignore & proceed to direct Firestore fallback
    }

    try {
      const collections = ['posts', 'reels', 'limes', 'feedPosts', 'communityVariantDetails'];
      for (const col of collections) {
        const docRef = doc(db, col, postId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          await deleteDoc(docRef);
          return;
        }
      }
    } catch (err) {
      console.error('[PostService] deletePost fallback error:', err);
    }
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
    const userRecord = isRecord(value.user) ? value.user : {};
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
    const media = Array.isArray(value.media)
      ? value.media.flatMap((item, index): PostMedia[] => {
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
    const likedUserIds = Array.isArray(value.likedUsers)
      ? value.likedUsers.flatMap((likedUser): string[] => isRecord(likedUser) && readString(likedUser.id) ? [readString(likedUser.id)] : [])
      : [];
    const post = this.mapPost(
      { id, data: value },
      user,
      media,
      {
        likeCount: readNumber(stats.likes),
        commentCount: readNumber(stats.comments),
        shareCount: readNumber(stats.shares),
      },
      likedUserIds
    );
    const repostedFromRecord = isRecord(value.repostedFrom) ? value.repostedFrom : null;
    const relationshipRecord = isRecord(value.relationshipStatus) ? value.relationshipStatus : null;
    return {
      ...post,
      repostedFrom: repostedFromRecord ? {
        postId: readString(repostedFromRecord.postId),
        userId: readString(repostedFromRecord.userId),
        userName: readString(repostedFromRecord.userName),
        firstName: readString(repostedFromRecord.firstName),
        lastName: readString(repostedFromRecord.lastName),
        profileImage: readString(repostedFromRecord.profileImage) || undefined,
      } : undefined,
      repostedByViewer: value.repostedByViewer === true,
      relationshipStatus: relationshipRecord ? {
        isFollowing: relationshipRecord.isFollowing === true,
        friendshipStatus: this.readFriendshipStatus(relationshipRecord.friendshipStatus),
      } : undefined,
      communityId: readString(value.communityId) || undefined,
      communityName: readString(value.communityName) || readString(value.communityTitle) || undefined,
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
      userId: readString(record.userId, user.id),
      user,
      type: record.type === 'poll' || record.type === 'event' ? record.type : 'regular',
      caption: readString(record.caption),
      description: readString(record.description),
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
        || readString(record.community_id)
        || (isRecord(record.community) ? readString(record.community.id) : undefined),
      communityName: readString(record.communityName)
        || readString(record.community_name)
        || readString(record.communityTitle)
        || readString(record.community_title)
        || (isRecord(record.community) ? readString(record.community.name, readString(record.community.title)) : undefined),
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
