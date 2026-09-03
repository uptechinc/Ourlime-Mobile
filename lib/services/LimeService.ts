import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';
import type { Reel } from '@/types/userTypes';
import type { CreateLimeCommentInput, CreateLimeInput, LimeComment, LimeCommentCursor, LimeCommentPage } from '@/lib/types/lime';
import { AuthService } from './AuthService';
import { RelationshipService } from './RelationshipService';
import { moderationService, type ReportReasonCategory } from './ModerationService';
import type { ChildSafetyIntakeValues } from '@/lib/types/childSafety';
import { ApiService } from './ApiService';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';

export type LimeFeedCursor = QueryDocumentSnapshot;

export type LimeFeedScope = 'forYou' | 'following';

export type LimeFeedResult = {
  reels: Reel[];
  followingUserIds: string[];
  friendUserIds: string[];
  commentsByReel: Record<string, LimeComment[]>;
  lastDoc: LimeFeedCursor | null;
  hasMore: boolean;
};

const recordOf = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const stringOf = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const numberOf = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const stringArrayOf = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const isDeletedReelRecord = (value: Record<string, unknown>): boolean => (
  value.isDeleted === true
  || stringOf(value.status).trim().toLowerCase() === 'deleted'
  || stringOf(value.deletionSource).trim().toLowerCase() === 'admin_moderation'
  || accountLifecycleVisibilityService.isHidden(value)
);

export class LimeService {
  private static instance: LimeService;
  private readonly authService = AuthService.getInstance();
  private readonly relationshipService = RelationshipService.getInstance();
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): LimeService {
    if (!LimeService.instance) LimeService.instance = new LimeService();
    return LimeService.instance;
  }

  public async fetchFeed(
    currentUserId: string,
    category?: string,
    cursor?: LimeFeedCursor,
    pageSize = 12,
    commentPreviewLimit = 0,
    scope: LimeFeedScope = 'forYou',
  ): Promise<LimeFeedResult> {
    const followingUserSet = new Set<string>();
    const friendUserSet = new Set<string>();

    // Only build the social graph on the first page load (no cursor)
    if (currentUserId && !cursor) {
      try {
        const [friends, followersSnap, friendshipSnap1, friendshipSnap2, friendshipsSnap] = await Promise.all([
          this.relationshipService.getFriends(currentUserId).catch(() => []),
          getDocs(query(collection(db, 'followers'), where('followerId', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'friendship'), where('userId1', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'friendship'), where('userId2', '==', currentUserId))).catch(() => null),
          getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', currentUserId))).catch(() => null),
        ]);

        friends.forEach((friend) => friendUserSet.add(friend.id));

        if (followersSnap) {
          followersSnap.docs.forEach((d) => {
            const followeeId = stringOf(d.data().followeeId);
            if (followeeId) followingUserSet.add(followeeId);
          });
        }

        if (friendshipSnap1) {
          friendshipSnap1.docs.forEach((d) => {
            const data = recordOf(d.data());
            const st = stringOf(data.friendshipStatus) || stringOf(data.status);
            if (st === 'accepted') {
              const friendId = stringOf(data.userId2);
              if (friendId) friendUserSet.add(friendId);
            }
          });
        }

        if (friendshipSnap2) {
          friendshipSnap2.docs.forEach((d) => {
            const data = recordOf(d.data());
            const st = stringOf(data.friendshipStatus) || stringOf(data.status);
            if (st === 'accepted') {
              const friendId = stringOf(data.userId1);
              if (friendId) friendUserSet.add(friendId);
            }
          });
        }

        if (friendshipsSnap) {
          friendshipsSnap.docs.forEach((d) => {
            const users = stringArrayOf(d.data().users);
            users.forEach((u) => { if (u && u !== currentUserId) friendUserSet.add(u); });
          });
        }
      } catch {
        // ignore — feed still loads without social graph
      }
    }

    // Build query constraints
    const isDiscoveryCategory =
      category && category !== 'forYou' && category !== 'following';

    const constraints: QueryConstraint[] = [];
    if (isDiscoveryCategory) {
      constraints.push(where('category', '==', category));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    if (cursor) constraints.push(startAfter(cursor));
    const requestedPageSize = scope === 'following' ? 50 : pageSize;
    constraints.push(limit(requestedPageSize));

    const snapshot = await getDocs(query(collection(db, 'reels'), ...constraints));
    const visibleDocuments = snapshot.docs.filter((reelDocument) => !isDeletedReelRecord(recordOf(reelDocument.data())));
    const feedDocuments = scope === 'following'
      ? visibleDocuments.filter((reelDocument) => followingUserSet.has(stringOf(reelDocument.data().userId)))
      : visibleDocuments;
    const commentsByReel: Record<string, LimeComment[]> = {};
    const reels = await Promise.all(feedDocuments.map(async (reelDocument): Promise<Reel> => {
      const data = recordOf(reelDocument.data());
      const creatorId = stringOf(data.userId);
      const profile = creatorId ? await this.authService.getUserProfile(creatorId) : null;
      const comments = commentPreviewLimit > 0
        ? await this.fetchComments(reelDocument.id, commentPreviewLimit)
        : { items: [], nextCursor: null, hasMore: false };
      if (comments.items.length > 0) {
        commentsByReel[reelDocument.id] = comments.items;
      }
      const media = recordOf(data.media);
      const stats = recordOf(data.stats);
      const embeddedUser = recordOf(data.user);
      const isRepost = Boolean(data.isRepost);
      const repostedBy = this.readEmbeddedReposters(data.repostedBy, isRepost && profile ? {
        userId: creatorId,
        userName: profile.userName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        profileImage: profile.profilePicture || undefined,
      } : null);
      const user = isRepost && embeddedUser.userName
        ? {
            firstName: stringOf(embeddedUser.firstName, 'Lime'),
            lastName: stringOf(embeddedUser.lastName, 'Creator'),
            userName: stringOf(embeddedUser.userName, 'user'),
            profileImage: stringOf(embeddedUser.profileImage) || undefined,
          }
        : {
            firstName: profile?.firstName || stringOf(embeddedUser.firstName, 'Lime'),
            lastName: profile?.lastName || stringOf(embeddedUser.lastName, 'Creator'),
            userName: profile?.userName || stringOf(embeddedUser.userName, 'user'),
            profileImage: profile?.profilePicture || stringOf(embeddedUser.profileImage) || undefined,
          };

      return {
        id: reelDocument.id,
        userId: creatorId,
        thumbnailUrl: stringOf(data.thumbnailUrl) || stringOf(media.thumbnailUrl) || undefined,
        media: {
          type: media.type === 'image' ? 'image' : 'video',
          typeUrl: stringOf(media.typeUrl),
          fileName: stringOf(media.fileName, 'reel.mp4'),
          duration: numberOf(media.duration),
          thumbnailUrl: stringOf(media.thumbnailUrl) || stringOf(data.thumbnailUrl) || undefined,
        },
        visibility: stringOf(data.visibility, 'public'),
        category: stringOf(data.category, 'Lifestyle'),
        caption: stringOf(data.caption),
        createdAt: this.toDate(data.createdAt),
        user,
        stats: {
          likes: numberOf(stats.likes) || stringArrayOf(data.likes).length,
          comments: numberOf(stats.comments) || numberOf(data.commentCount) || comments.items.length,
          shares: numberOf(data.shares) || numberOf(stats.shares),
          reposts: numberOf(stats.reposts) || stringArrayOf(data.reposts).length,
        },
        likes: stringArrayOf(data.likes),
        repostedFrom: data.repostedFrom ? (data.repostedFrom as Reel['repostedFrom']) : undefined,
        repostedBy,
        isRepost,
        reposts: stringArrayOf(data.reposts),
        status: stringOf(data.status),
        isDeleted: data.isDeleted === true,
      };
    }));

    const enrichedReels = await this.attachReposters(reels, currentUserId);
    const lastDoc = scope === 'following' ? null : snapshot.docs.at(-1) ?? null;
    return {
      reels: enrichedReels,
      followingUserIds: Array.from(followingUserSet),
      friendUserIds: Array.from(friendUserSet),
      commentsByReel,
      lastDoc,
      hasMore: scope === 'forYou' && snapshot.size >= pageSize,
    };
  }


  public async createLime(input: CreateLimeInput, onProgress?: (percentage: number) => void): Promise<string> {
    const blob = await this.uriToBlob(input.uri);
    const timestamp = Date.now();
    const storagePath = `limes/${input.userId}/${timestamp}_reel.mp4`;
    const task = uploadBytesResumable(ref(storage, storagePath), blob, { contentType: 'video/mp4' });
    await new Promise<void>((resolve, reject) => task.on('state_changed', (snapshot) => {
      onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
    }, reject, resolve));
    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    let thumbnailUrl = '';
    if (input.thumbnailUri) {
      const thumbnailBlob = await this.uriToBlob(input.thumbnailUri);
      const thumbnailPath = `limes/${input.userId}/thumbnails/${timestamp}_thumbnail.jpg`;
      const thumbnailTask = uploadBytesResumable(
        ref(storage, thumbnailPath),
        thumbnailBlob,
        { contentType: 'image/jpeg' }
      );
      await new Promise<void>((resolve, reject) => thumbnailTask.on('state_changed', undefined, reject, resolve));
      thumbnailUrl = await getDownloadURL(thumbnailTask.snapshot.ref);
    }
    const reel = await addDoc(collection(db, 'reels'), {
      userId: input.userId,
      thumbnailUrl: thumbnailUrl || null,
      media: {
        type: 'video',
        typeUrl: downloadUrl,
        fileName: storagePath,
        duration: input.durationSeconds,
        aspectRatio: '9:16',
        thumbnailUrl: thumbnailUrl || null,
      },
      visibility: input.visibility,
      category: input.category,
      caption: input.caption,
      mentions: input.mentions,
      createdAt: serverTimestamp(),
      stats: { likes: 0, comments: 0, shares: 0 },
      likes: [],
    });
    return reel.id;
  }

  public async fetchUserReels(userId: string, maxResults = 20): Promise<Reel[]> {
    const snapshot = await getDocs(query(collection(db, 'reels'), where('userId', '==', userId), limit(maxResults)));
    const profile = await this.authService.getUserProfile(userId);
    return snapshot.docs
      .filter((item) => !isDeletedReelRecord(recordOf(item.data())))
      .map((item): Reel => {
      const data = recordOf(item.data());
      const media = recordOf(data.media);
      const stats = recordOf(data.stats);
      return {
        id: item.id,
        userId,
        thumbnailUrl: stringOf(data.thumbnailUrl) || stringOf(media.thumbnailUrl) || undefined,
        media: {
          type: media.type === 'image' ? 'image' : 'video',
          typeUrl: stringOf(media.typeUrl),
          fileName: stringOf(media.fileName, 'reel.mp4'),
          duration: numberOf(media.duration),
          thumbnailUrl: stringOf(media.thumbnailUrl) || stringOf(data.thumbnailUrl) || undefined,
        },
        visibility: stringOf(data.visibility, 'public'),
        category: stringOf(data.category, 'Lifestyle'),
        caption: stringOf(data.caption),
        createdAt: this.toDate(data.createdAt),
        user: { firstName: profile?.firstName || 'Lime', lastName: profile?.lastName || 'Creator', userName: profile?.userName || 'user', profileImage: profile?.profilePicture || undefined },
        stats: { likes: numberOf(stats.likes) || stringArrayOf(data.likes).length, comments: numberOf(stats.comments), shares: numberOf(data.shares) || numberOf(stats.shares) },
        likes: stringArrayOf(data.likes),
        status: stringOf(data.status),
        isDeleted: data.isDeleted === true,
      };
    });
  }

  public async fetchLimeById(reelId: string, commentPreviewLimit = 0): Promise<Reel | null> {
    const reelSnapshot = await getDoc(doc(db, 'reels', reelId));
    if (!reelSnapshot.exists()) return null;
    const data = recordOf(reelSnapshot.data());
    if (isDeletedReelRecord(data)) return null;
    const creatorId = stringOf(data.userId);
    const profile = creatorId ? await this.authService.getUserProfile(creatorId) : null;
    const comments = commentPreviewLimit > 0
      ? await this.fetchComments(reelId, commentPreviewLimit)
      : { items: [], nextCursor: null, hasMore: false };
    const media = recordOf(data.media);
    const stats = recordOf(data.stats);
    const embeddedUser = recordOf(data.user);
    const isRepost = Boolean(data.isRepost);
    const repostedBy = this.readEmbeddedReposters(data.repostedBy, isRepost && profile ? {
      userId: creatorId,
      userName: profile.userName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImage: profile.profilePicture || undefined,
    } : null);
    const user = isRepost && embeddedUser.userName
      ? {
          firstName: stringOf(embeddedUser.firstName, 'Lime'),
          lastName: stringOf(embeddedUser.lastName, 'Creator'),
          userName: stringOf(embeddedUser.userName, 'user'),
          profileImage: stringOf(embeddedUser.profileImage) || undefined,
        }
      : {
          firstName: profile?.firstName || stringOf(embeddedUser.firstName, 'Lime'),
          lastName: profile?.lastName || stringOf(embeddedUser.lastName, 'Creator'),
          userName: profile?.userName || stringOf(embeddedUser.userName, 'user'),
          profileImage: profile?.profilePicture || stringOf(embeddedUser.profileImage) || undefined,
        };

    const reel: Reel = {
      id: reelId,
      userId: creatorId,
      thumbnailUrl: stringOf(data.thumbnailUrl) || stringOf(media.thumbnailUrl) || undefined,
      media: {
        type: media.type === 'image' ? 'image' : 'video',
        typeUrl: stringOf(media.typeUrl),
        fileName: stringOf(media.fileName, 'reel.mp4'),
        duration: numberOf(media.duration),
        thumbnailUrl: stringOf(media.thumbnailUrl) || stringOf(data.thumbnailUrl) || undefined,
      },
      visibility: stringOf(data.visibility, 'public'),
      category: stringOf(data.category, 'Lifestyle'),
      caption: stringOf(data.caption),
      createdAt: this.toDate(data.createdAt),
      user,
      stats: {
        likes: numberOf(stats.likes) || stringArrayOf(data.likes).length,
        comments: numberOf(stats.comments) || numberOf(data.commentCount) || comments.items.length,
        shares: numberOf(data.shares) || numberOf(stats.shares),
        reposts: numberOf(stats.reposts) || stringArrayOf(data.reposts).length,
      },
      likes: stringArrayOf(data.likes),
      repostedFrom: data.repostedFrom ? (data.repostedFrom as Reel['repostedFrom']) : undefined,
      repostedBy,
      isRepost,
      reposts: stringArrayOf(data.reposts),
      status: stringOf(data.status),
      isDeleted: data.isDeleted === true,
    };
    return (await this.attachReposters([reel], this.authService.getCurrentUser()?.uid ?? ''))[0] ?? reel;
  }

  public async repostLime(reelId: string, userId: string): Promise<string> {
    if (!userId) throw new Error('Sign in to repost this Lime.');
    const response = await this.apiService.request<{ success: boolean; error?: string }>(`/api/limes/${encodeURIComponent(reelId)}/repost`, {
      method: 'POST',
      authenticated: true,
    });
    if (!response.success) throw new Error(response.error || 'Could not repost this Lime.');
    return reelId;
  }

  public async removeLimeRepost(reelId: string, userId: string): Promise<void> {
    if (!userId) throw new Error('Sign in to remove this repost.');
    const response = await this.apiService.request<{ success: boolean; error?: string }>(`/api/limes/${encodeURIComponent(reelId)}/repost`, {
      method: 'DELETE',
      authenticated: true,
    });
    if (!response.success) throw new Error(response.error || 'Could not remove this repost.');
  }

  public async fetchUserRepostedLimeIds(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();
    try {
      const snapshot = await getDocs(query(collection(db, 'reelReposts'), where('userId', '==', userId)));
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const originalId = stringOf(d.data().reelId) || stringOf(d.data().originalReelId);
        if (originalId) ids.add(originalId);
      });
      return ids;
    } catch {
      return new Set();
    }
  }

  public async fetchUserAndRepostedReels(userId: string): Promise<Reel[]> {
    if (!userId) return [];
    try {
      const [ownReels, repostedIds] = await Promise.all([
        this.fetchUserReels(userId),
        this.fetchUserRepostedLimeIds(userId),
      ]);
      const ownIds = new Set(ownReels.map((r) => r.id));
      const repostPromises = Array.from(repostedIds)
        .filter((id) => !ownIds.has(id))
        .map((id) => this.fetchLimeById(id));
      const repostedReels = (await Promise.all(repostPromises))
        .filter((r): r is Reel => r !== null)
        .map((r) => ({ ...r, isRepost: true }));
      return [...ownReels, ...repostedReels];
    } catch (err) {
      console.error('[LimeService.fetchUserAndRepostedReels] Error:', err);
      return this.fetchUserReels(userId).catch(() => []);
    }
  }

  public async fetchUserRepostedLimes(userId: string): Promise<Reel[]> {
    if (!userId) return [];
    try {
      const repostedIds = await this.fetchUserRepostedLimeIds(userId);
      const repostPromises = Array.from(repostedIds).map((id) => this.fetchLimeById(id));
      const repostedReels = (await Promise.all(repostPromises))
        .filter((r): r is Reel => r !== null)
        .map((r) => ({ ...r, isRepost: true }));
      return repostedReels;
    } catch (err) {
      console.error('[LimeService.fetchUserRepostedLimes] Error:', err);
      return [];
    }
  }

  public async toggleLike(reelId: string, userId: string, liked: boolean): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId), { likes: liked ? arrayUnion(userId) : arrayRemove(userId) });
  }

  public async incrementShareCount(reelId: string): Promise<void> {
    await this.apiService.request<{ success: boolean }>(`/api/limes/${encodeURIComponent(reelId)}/share`, {
      method: 'POST',
    }).catch(() => undefined);
  }

  public async deleteLime(reelId: string): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>(`/api/limes/${encodeURIComponent(reelId)}`, {
      method: 'DELETE',
      authenticated: true,
    });
    if (!response.success) throw new Error(response.error || 'Could not delete this Lime.');
  }

  public async reportLime(
    reelId: string,
    reportedUserId: string,
    reportType: 'lime' | 'user',
    reason: string,
    reporterId: string,
    reasonCategory: ReportReasonCategory = 'other',
    description = '',
    childSafety?: ChildSafetyIntakeValues,
  ): Promise<string> {
    if (!reporterId) throw new Error('Sign in to submit a report');
    return moderationService.reportContent(reportType === 'lime' ? 'lime' : 'user', {
      targetId: reportType === 'lime' ? reelId : reportedUserId,
      reportedUserId,
      reasonCategory,
      reason,
      description,
      immediateDanger: childSafety?.immediateDanger,
      goodFaithAcknowledged: childSafety?.goodFaithAcknowledged,
      allowContact: childSafety?.allowContact,
      routePath: reportType === 'lime' ? `/limes?limeId=${reelId}` : `/profile/${reportedUserId}`,
    });
  }

  public async followUser(followerId: string, followeeId: string): Promise<void> {
    const followId = `${followerId}_${followeeId}`;
    await setDoc(doc(db, 'followers', followId), {
      followerId,
      followeeId,
      createdAt: serverTimestamp(),
    });
  }

  public async unfollowUser(followerId: string, followeeId: string): Promise<void> {
    const followId = `${followerId}_${followeeId}`;
    await deleteDoc(doc(db, 'followers', followId)).catch(() => {});
  }

  public async fetchComments(reelId: string, pageSize: number, cursor?: LimeCommentCursor | null): Promise<LimeCommentPage> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocs(query(collection(db, 'reels', reelId, 'comments'), ...constraints, limit(pageSize)));
    return {
      items: snapshot.docs.map((item) => this.normalizeComment(item.id, reelId, item.data())),
      nextCursor: snapshot.docs.at(-1) ?? null,
      hasMore: snapshot.size >= pageSize,
    };
  }

  public async createComment(input: CreateLimeCommentInput): Promise<string> {
    const result = await addDoc(collection(db, 'reels', input.reelId, 'comments'), {
      userId: input.userId,
      userName: input.userName,
      firstName: input.firstName,
      profileImage: input.profileImage ?? null,
      content: input.content,
      likes: [],
      replyCount: 0,
      parentCommentId: input.parentCommentId ?? null,
      replyToUserName: input.replyToUserName ?? null,
      sticker: input.sticker ?? null,
      createdAt: serverTimestamp(),
    });
    const updates: Promise<void>[] = [
      updateDoc(doc(db, 'reels', input.reelId), { 'stats.comments': increment(1) }),
    ];
    if (input.parentCommentId) {
      updates.push(updateDoc(doc(db, 'reels', input.reelId, 'comments', input.parentCommentId), { replyCount: increment(1) }));
    }
    await Promise.all(updates).catch(() => undefined);
    return result.id;
  }

  public async toggleCommentLike(reelId: string, commentId: string, userId: string, liked: boolean): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId, 'comments', commentId), { likes: liked ? arrayRemove(userId) : arrayUnion(userId) });
  }

  public async editComment(reelId: string, commentId: string, content: string): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId, 'comments', commentId), { content, editedAt: serverTimestamp() });
  }

  public async deleteComment(reelId: string, commentId: string): Promise<void> {
    const commentReference = doc(db, 'reels', reelId, 'comments', commentId);
    const commentSnapshot = await getDoc(commentReference);
    const parentCommentId = commentSnapshot.exists() ? stringOf(commentSnapshot.data().parentCommentId) : '';
    await deleteDoc(commentReference);
    const updates: Promise<void>[] = [
      updateDoc(doc(db, 'reels', reelId), { 'stats.comments': increment(-1) }),
    ];
    if (parentCommentId) {
      updates.push(updateDoc(doc(db, 'reels', reelId, 'comments', parentCommentId), { replyCount: increment(-1) }));
    }
    await Promise.all(updates).catch(() => undefined);
  }

  private normalizeComment(id: string, reelId: string, value: unknown): LimeComment {
    const data = recordOf(value);
    const user = recordOf(data.user);
    const media = recordOf(data.sticker);
    const mediaType = stringOf(media.type);
    return {
      id,
      reelId,
      userId: stringOf(data.userId),
      content: stringOf(data.content),
      userName: stringOf(data.userName) || stringOf(user.userName, 'user'),
      firstName: stringOf(data.firstName) || stringOf(user.firstName, 'User'),
      profileImage: stringOf(data.profileImage) || stringOf(user.profileImage) || undefined,
      likes: stringArrayOf(data.likes),
      replyCount: numberOf(data.replyCount),
      parentCommentId: stringOf(data.parentCommentId) || null,
      replyToUserName: stringOf(data.replyToUserName) || null,
      createdAt: this.toDate(data.createdAt).getTime(),
      editedAt: data.editedAt ? this.toDate(data.editedAt).getTime() : undefined,
      sticker: mediaType === 'sticker' || mediaType === 'gif'
        ? {
            id: stringOf(media.id),
            name: stringOf(media.name, mediaType === 'gif' ? 'GIF' : 'Sticker'),
            imageUrl: stringOf(media.imageUrl),
            type: mediaType,
          }
        : null,
    };
  }

  private readEmbeddedReposters(value: unknown, fallback: NonNullable<Reel['repostedBy']>[number] | null): Reel['repostedBy'] {
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    const reposters = entries.flatMap((entry): NonNullable<Reel['repostedBy']> => {
      const data = recordOf(entry);
      const userId = stringOf(data.userId) || stringOf(data.id);
      if (!userId) return [];
      return [{
        userId,
        userName: stringOf(data.userName, 'user'),
        firstName: stringOf(data.firstName, 'Lime'),
        lastName: stringOf(data.lastName, 'User'),
        profileImage: stringOf(data.profileImage) || undefined,
      }];
    });
    if (fallback && !reposters.some((reposter) => reposter.userId === fallback.userId)) reposters.push(fallback);
    return reposters.length > 0 ? reposters : undefined;
  }

  private async attachReposters(reels: Reel[], currentUserId: string): Promise<Reel[]> {
    const reelIds = reels.map((reel) => reel.id).filter(Boolean);
    if (reelIds.length === 0) return reels;
    try {
      const markerDocuments: QueryDocumentSnapshot[] = [];
      for (let offset = 0; offset < reelIds.length; offset += 10) {
        const chunk = reelIds.slice(offset, offset + 10);
        const [canonicalMarkers, legacyMarkers] = await Promise.all([
          getDocs(query(collection(db, 'reelReposts'), where('reelId', 'in', chunk))).catch(() => null),
          getDocs(query(collection(db, 'reelReposts'), where('originalReelId', 'in', chunk))).catch(() => null),
        ]);
        canonicalMarkers?.docs.forEach((markerDocument) => markerDocuments.push(markerDocument));
        legacyMarkers?.docs.forEach((markerDocument) => markerDocuments.push(markerDocument));
      }
      const uniqueMarkers = Array.from(new Map(markerDocuments.map((markerDocument) => [markerDocument.id, markerDocument])).values());
      const userIds = Array.from(new Set(uniqueMarkers.map((markerDocument) => stringOf(markerDocument.data().userId)).filter(Boolean)));
      const profiles = await Promise.all(userIds.map(async (userId) => [userId, await this.authService.getUserProfile(userId)] as const));
      const profileById = new Map(profiles);
      const repostersByReel = new Map<string, NonNullable<Reel['repostedBy']>>();
      uniqueMarkers.forEach((markerDocument) => {
        const marker = markerDocument.data();
        const reelId = stringOf(marker.reelId) || stringOf(marker.originalReelId);
        const userId = stringOf(marker.userId);
        const profile = profileById.get(userId);
        if (!reelId || !userId || !profile) return;
        const current = repostersByReel.get(reelId) ?? [];
        if (!current.some((reposter) => reposter.userId === userId)) {
          current.push({
            userId,
            userName: profile.userName || 'user',
            firstName: profile.firstName || 'Lime',
            lastName: profile.lastName || 'User',
            profileImage: profile.profilePicture || undefined,
          });
        }
        repostersByReel.set(reelId, current);
      });
      return reels.map((reel) => {
        const merged = [...(reel.repostedBy ?? [])];
        for (const reposter of repostersByReel.get(reel.id) ?? []) {
          if (!merged.some((item) => item.userId === reposter.userId)) merged.push(reposter);
        }
        return {
          ...reel,
          repostedBy: merged.length > 0 ? merged : undefined,
          repostedByViewer: Boolean(currentUserId && merged.some((reposter) => reposter.userId === currentUserId)),
          stats: {
            likes: reel.stats?.likes ?? 0,
            comments: reel.stats?.comments ?? 0,
            shares: reel.stats?.shares ?? 0,
            reposts: Math.max(reel.stats?.reposts ?? 0, merged.length),
          },
        };
      });
    } catch {
      return reels;
    }
  }

  private toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    const record = recordOf(value);
    if (typeof record.toDate === 'function') return (record.toDate as () => Date)();
    if (typeof record.seconds === 'number') return new Date(record.seconds * 1000);
    return new Date();
  }

  private uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.onload = () => resolve(request.response as Blob);
      request.onerror = () => reject(new TypeError('Could not read selected Lime video.'));
      request.responseType = 'blob';
      request.open('GET', uri, true);
      request.send(null);
    });
  }
}

export const limeService = LimeService.getInstance();
