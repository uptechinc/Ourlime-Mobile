import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';
import type { Reel } from '@/types/userTypes';
import type { CreateLimeCommentInput, CreateLimeInput, LimeComment, LimeCommentCursor, LimeCommentPage } from '@/lib/types/lime';
import { AuthService } from './AuthService';
import { RelationshipService } from './RelationshipService';

export type LimeFeedResult = {
  reels: Reel[];
  followingUserIds: string[];
  commentsByReel: Record<string, LimeComment[]>;
};

const recordOf = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const stringOf = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const numberOf = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const stringArrayOf = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export class LimeService {
  private static instance: LimeService;
  private readonly authService = AuthService.getInstance();
  private readonly relationshipService = RelationshipService.getInstance();

  private constructor() {}

  public static getInstance(): LimeService {
    if (!LimeService.instance) LimeService.instance = new LimeService();
    return LimeService.instance;
  }

  public async fetchFeed(currentUserId: string, maxResults = 50): Promise<LimeFeedResult> {
    const friends = currentUserId ? await this.relationshipService.getFriends(currentUserId) : [];
    const snapshot = await getDocs(query(collection(db, 'reels'), limit(maxResults)));
    const commentsByReel: Record<string, LimeComment[]> = {};
    const reels = await Promise.all(snapshot.docs.map(async (reelDocument): Promise<Reel> => {
      const data = recordOf(reelDocument.data());
      const creatorId = stringOf(data.userId);
      const profile = creatorId ? await this.authService.getUserProfile(creatorId) : null;
      const comments = await this.fetchComments(reelDocument.id, 50);
      commentsByReel[reelDocument.id] = comments.items;
      const media = recordOf(data.media);
      const stats = recordOf(data.stats);
      const embeddedUser = recordOf(data.user);
      return {
        id: reelDocument.id,
        userId: creatorId,
        media: {
          type: media.type === 'image' ? 'image' : 'video',
          typeUrl: stringOf(media.typeUrl),
          fileName: stringOf(media.fileName, 'reel.mp4'),
          duration: numberOf(media.duration),
        },
        visibility: stringOf(data.visibility, 'public'),
        category: stringOf(data.category, 'Lifestyle'),
        caption: stringOf(data.caption),
        createdAt: this.toDate(data.createdAt),
        user: {
          firstName: profile?.firstName || stringOf(embeddedUser.firstName, 'Lime'),
          lastName: profile?.lastName || stringOf(embeddedUser.lastName, 'Creator'),
          userName: profile?.userName || stringOf(embeddedUser.userName, 'user'),
          profileImage: profile?.profilePicture || stringOf(embeddedUser.profileImage) || undefined,
        },
        stats: {
          likes: numberOf(stats.likes) || stringArrayOf(data.likes).length,
          comments: numberOf(stats.comments) || comments.items.length,
          shares: numberOf(stats.shares),
        },
        likes: stringArrayOf(data.likes),
      };
    }));
    return { reels, followingUserIds: friends.map((friend) => friend.id), commentsByReel };
  }

  public async createLime(input: CreateLimeInput, onProgress?: (percentage: number) => void): Promise<string> {
    const blob = await this.uriToBlob(input.uri);
    const storagePath = `limes/${input.userId}/${Date.now()}_reel.mp4`;
    const task = uploadBytesResumable(ref(storage, storagePath), blob, { contentType: 'video/mp4' });
    await new Promise<void>((resolve, reject) => task.on('state_changed', (snapshot) => {
      onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
    }, reject, resolve));
    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    const reel = await addDoc(collection(db, 'reels'), {
      userId: input.userId,
      media: { type: 'video', typeUrl: downloadUrl, fileName: storagePath, duration: input.durationSeconds, aspectRatio: '9:16' },
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
    return snapshot.docs.map((item): Reel => {
      const data = recordOf(item.data());
      const media = recordOf(data.media);
      const stats = recordOf(data.stats);
      return {
        id: item.id,
        userId,
        media: { type: media.type === 'image' ? 'image' : 'video', typeUrl: stringOf(media.typeUrl), fileName: stringOf(media.fileName, 'reel.mp4'), duration: numberOf(media.duration) },
        visibility: stringOf(data.visibility, 'public'),
        category: stringOf(data.category, 'Lifestyle'),
        caption: stringOf(data.caption),
        createdAt: this.toDate(data.createdAt),
        user: { firstName: profile?.firstName || 'Lime', lastName: profile?.lastName || 'Creator', userName: profile?.userName || 'user', profileImage: profile?.profilePicture || undefined },
        stats: { likes: numberOf(stats.likes) || stringArrayOf(data.likes).length, comments: numberOf(stats.comments), shares: numberOf(stats.shares) },
        likes: stringArrayOf(data.likes),
      };
    });
  }

  public async fetchLimeById(reelId: string): Promise<Reel | null> {
    const reelSnapshot = await getDoc(doc(db, 'reels', reelId));
    if (!reelSnapshot.exists()) return null;
    const data = recordOf(reelSnapshot.data());
    const creatorId = stringOf(data.userId);
    const profile = creatorId ? await this.authService.getUserProfile(creatorId) : null;
    const comments = await this.fetchComments(reelId, 50);
    const media = recordOf(data.media);
    const stats = recordOf(data.stats);
    const embeddedUser = recordOf(data.user);
    return {
      id: reelId,
      userId: creatorId,
      media: {
        type: media.type === 'image' ? 'image' : 'video',
        typeUrl: stringOf(media.typeUrl),
        fileName: stringOf(media.fileName, 'reel.mp4'),
        duration: numberOf(media.duration),
      },
      visibility: stringOf(data.visibility, 'public'),
      category: stringOf(data.category, 'Lifestyle'),
      caption: stringOf(data.caption),
      createdAt: this.toDate(data.createdAt),
      user: {
        firstName: profile?.firstName || stringOf(embeddedUser.firstName, 'Lime'),
        lastName: profile?.lastName || stringOf(embeddedUser.lastName, 'Creator'),
        userName: profile?.userName || stringOf(embeddedUser.userName, 'user'),
        profileImage: profile?.profilePicture || stringOf(embeddedUser.profileImage) || undefined,
      },
      stats: {
        likes: numberOf(stats.likes) || stringArrayOf(data.likes).length,
        comments: numberOf(stats.comments) || comments.items.length,
        shares: numberOf(stats.shares),
      },
      likes: stringArrayOf(data.likes),
    };
  }

  public async toggleLike(reelId: string, userId: string, liked: boolean): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId), { likes: liked ? arrayUnion(userId) : arrayRemove(userId) });
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
      createdAt: serverTimestamp(),
    });
    return result.id;
  }

  public async toggleCommentLike(reelId: string, commentId: string, userId: string, liked: boolean): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId, 'comments', commentId), { likes: liked ? arrayRemove(userId) : arrayUnion(userId) });
  }

  public async editComment(reelId: string, commentId: string, content: string): Promise<void> {
    await updateDoc(doc(db, 'reels', reelId, 'comments', commentId), { content, editedAt: serverTimestamp() });
  }

  public async deleteComment(reelId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'reels', reelId, 'comments', commentId));
  }

  private normalizeComment(id: string, reelId: string, value: unknown): LimeComment {
    const data = recordOf(value);
    const user = recordOf(data.user);
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
    };
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
