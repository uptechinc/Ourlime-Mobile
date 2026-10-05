import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type CommentMediaAsset = {
  id: string;
  name: string;
  imageUrl: string;
  type: 'sticker' | 'gif';
};

export type CommentAuthor = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage?: string | null;
};

export type PostComment = {
  id: string;
  content: string;
  createdAtMs: number;
  editedAtMs?: number | null;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  author: CommentAuthor;
  sticker?: CommentMediaAsset | null;
};

export type PostReply = {
  id: string;
  content: string;
  createdAtMs: number;
  editedAtMs?: number | null;
  likeCount: number;
  isLiked: boolean;
  parentReplyId?: string | null;
  replyToUserName?: string | null;
  author: CommentAuthor;
  sticker?: CommentMediaAsset | null;
};

export type CommentPage<TItem> = {
  items: TItem[];
  hasMore: boolean;
  nextCursor: number | null;
};

export type CommentFocusTarget = {
  rootCommentId?: string;
  commentId?: string;
  replyId?: string;
};

export type CommentFocusResult = {
  rootComment: PostComment;
  replies: PostReply[];
  targetId: string;
  truncated: boolean;
};

type PaginatedApiResponse<TItem> = {
  success: boolean;
  data?: TItem[];
  error?: string;
  pagination?: { hasMore?: boolean; nextCursor?: number | null };
};

export class CommentService {
  private static instance: CommentService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): CommentService {
    if (!CommentService.instance) CommentService.instance = new CommentService();
    return CommentService.instance;
  }

  public async fetchComments(postId: string, cursor?: number | null): Promise<CommentPage<PostComment>> {
    return this.fetchCommentsFromFirestore(postId, cursor);
  }

  public async fetchReplies(commentId: string, cursor?: number | null): Promise<CommentPage<PostReply>> {
    return this.fetchRepliesFromFirestore(commentId, cursor);
  }

  public async fetchCommentFocus(postId: string, target: CommentFocusTarget): Promise<CommentFocusResult> {
    const rootCommentId = target.rootCommentId || target.commentId;
    if (!rootCommentId) throw new Error('A comment target is required');
    const rootDoc = await getDoc(doc(db, 'feedsPostComments', rootCommentId));
    if (!rootDoc.exists()) throw new Error('Root comment not found');
    const rootData = rootDoc.data();
    const viewerId = auth.currentUser?.uid ?? '';
    const [author, like, repliesPage] = await Promise.all([
      this.getAuthor(typeof rootData.userId === 'string' ? rootData.userId : ''),
      viewerId ? getDoc(doc(db, 'feedsPostCommentLikes', `comment_${rootDoc.id}_${viewerId}`)) : null,
      this.fetchRepliesFromFirestore(rootCommentId),
    ]);
    const rootComment: PostComment = {
      id: rootDoc.id,
      content: typeof rootData.comment === 'string' ? rootData.comment : '',
      createdAtMs: this.toMillis(rootData.createdAt),
      editedAtMs: rootData.editedAt ? this.toMillis(rootData.editedAt) : null,
      likeCount: typeof rootData.likeCount === 'number' ? rootData.likeCount : 0,
      replyCount: typeof rootData.replyCount === 'number' ? rootData.replyCount : 0,
      isLiked: like?.exists() === true,
      author,
      sticker: this.readCommentMedia(rootData.sticker),
    };
    return {
      rootComment,
      replies: repliesPage.items,
      targetId: target.replyId || target.commentId || rootCommentId,
      truncated: repliesPage.hasMore,
    };
  }

  public async createComment(postId: string, content: string, sticker?: CommentMediaAsset): Promise<PostComment> {
    const normalizedContent = content.trim();
    if (!normalizedContent && !sticker) throw new Error('Add text, an emoji, a sticker, or a GIF to your comment');
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('You must be signed in to comment');
    const validatedContent = normalizedContent ? this.validateContent(normalizedContent, 'Comment') : '';

    const commentRef = await addDoc(collection(db, 'feedsPostComments'), {
      feedsPostId: postId,
      userId: currentUserId,
      comment: validatedContent,
      content: validatedContent,
      createdAt: serverTimestamp(),
      likeCount: 0,
      replyCount: 0,
      sticker: sticker ?? null,
    });

    const countSnap = await getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1))).catch(() => null);
    if (countSnap && !countSnap.empty) {
      await updateDoc(countSnap.docs[0].ref, { commentCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {});
    }

    const author = await this.getAuthor(currentUserId);
    this.logger.success('CommentService', 'create-comment', { postId, commentId: commentRef.id });
    return {
      id: commentRef.id,
      content: validatedContent,
      createdAtMs: Date.now(),
      editedAtMs: null,
      likeCount: 0,
      replyCount: 0,
      isLiked: false,
      author,
      sticker: sticker ?? null,
    };
  }

  public async createReply(input: {
    commentId: string;
    content: string;
    parentReplyId?: string | null;
    replyToUserName?: string | null;
    sticker?: CommentMediaAsset;
  }): Promise<PostReply> {
    const normalizedContent = input.content.trim();
    if (!normalizedContent && !input.sticker) throw new Error('Add text, an emoji, a sticker, or a GIF to your reply');
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('You must be signed in to reply');
    const validatedContent = normalizedContent ? this.validateContent(normalizedContent, 'Reply') : '';

    const replyRef = await addDoc(collection(db, 'feedsPostCommentsReplies'), {
      feedsPostCommentId: input.commentId,
      userId: currentUserId,
      reply: validatedContent,
      content: validatedContent,
      parentReplyId: input.parentReplyId ?? null,
      replyToUserName: input.replyToUserName ?? null,
      sticker: input.sticker ?? null,
      createdAt: serverTimestamp(),
      likeCount: 0,
    });

    await updateDoc(doc(db, 'feedsPostComments', input.commentId), {
      replyCount: increment(1),
    }).catch(() => {});

    const author = await this.getAuthor(currentUserId);
    this.logger.success('CommentService', 'create-reply', { commentId: input.commentId, replyId: replyRef.id });
    return {
      id: replyRef.id,
      content: validatedContent,
      createdAtMs: Date.now(),
      editedAtMs: null,
      likeCount: 0,
      isLiked: false,
      parentReplyId: input.parentReplyId ?? null,
      replyToUserName: input.replyToUserName ?? null,
      author,
      sticker: input.sticker ?? null,
    };
  }

  public async editComment(postId: string, commentId: string, content: string): Promise<number> {
    const validatedContent = this.validateContent(content, 'Comment');
    await updateDoc(doc(db, 'feedsPostComments', commentId), {
      comment: validatedContent,
      content: validatedContent,
      editedAt: serverTimestamp(),
    });
    return Date.now();
  }

  public async editReply(rootCommentId: string, replyId: string, content: string): Promise<number> {
    const validatedContent = this.validateContent(content, 'Reply');
    await updateDoc(doc(db, 'feedsPostCommentsReplies', replyId), {
      reply: validatedContent,
      content: validatedContent,
      editedAt: serverTimestamp(),
    });
    return Date.now();
  }

  public async deleteComment(postId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'feedsPostComments', commentId));
    const countSnap = await getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1))).catch(() => null);
    if (countSnap && !countSnap.empty) {
      await updateDoc(countSnap.docs[0].ref, { commentCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  public async deleteReply(commentId: string, replyId: string): Promise<void> {
    await deleteDoc(doc(db, 'feedsPostCommentsReplies', replyId));
    await updateDoc(doc(db, 'feedsPostComments', commentId), {
      replyCount: increment(-1),
    }).catch(() => {});
  }

  public async toggleLike(targetType: 'comment' | 'reply', targetId: string): Promise<boolean> {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('You must be signed in to like');
    const likeDocId = `${targetType}_${targetId}_${currentUserId}`;
    const likeRef = doc(db, 'feedsPostCommentLikes', likeDocId);
    const existingSnap = await getDoc(likeRef);
    const isAlreadyLiked = existingSnap.exists();
    const targetCollection = targetType === 'comment' ? 'feedsPostComments' : 'feedsPostCommentsReplies';
    const targetDocRef = doc(db, targetCollection, targetId);

    if (isAlreadyLiked) {
      await deleteDoc(likeRef);
      await updateDoc(targetDocRef, { likeCount: increment(-1) }).catch(() => {});
      return false;
    } else {
      await setDoc(likeRef, {
        [targetType === 'comment' ? 'feedsPostCommentId' : 'replyId']: targetId,
        userId: currentUserId,
        createdAt: serverTimestamp(),
      });
      await updateDoc(targetDocRef, { likeCount: increment(1) }).catch(() => {});
      return true;
    }
  }

  private async fetchCommentsFromFirestore(postId: string, cursor?: number | null): Promise<CommentPage<PostComment>> {
    const viewerId = auth.currentUser?.uid ?? '';
    const snapshot = await getDocs(query(collection(db, 'feedsPostComments'), where('feedsPostId', '==', postId)));
    const sorted = snapshot.docs
      .filter((document) => !cursor || this.toMillis(document.data().createdAt) < cursor)
      .sort((left, right) => this.toMillis(right.data().createdAt) - this.toMillis(left.data().createdAt));
    const pageDocuments = sorted.slice(0, 20);
    const items = await Promise.all(pageDocuments.map(async (document): Promise<PostComment> => {
      const data = document.data();
      const [author, like] = await Promise.all([
        this.getAuthor(typeof data.userId === 'string' ? data.userId : ''),
        viewerId ? getDoc(doc(db, 'feedsPostCommentLikes', `comment_${document.id}_${viewerId}`)) : null,
      ]);
      return {
        id: document.id,
        content: typeof data.comment === 'string' ? data.comment : '',
        createdAtMs: this.toMillis(data.createdAt),
        editedAtMs: data.editedAt ? this.toMillis(data.editedAt) : null,
        likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
        replyCount: typeof data.replyCount === 'number' ? data.replyCount : 0,
        isLiked: like?.exists() === true,
        author,
        sticker: this.readCommentMedia(data.sticker),
      };
    }));
    return { items, hasMore: sorted.length > 20, nextCursor: sorted.length > 20 ? items.at(-1)?.createdAtMs ?? null : null };
  }

  private async fetchRepliesFromFirestore(commentId: string, cursor?: number | null): Promise<CommentPage<PostReply>> {
    const viewerId = auth.currentUser?.uid ?? '';
    const snapshot = await getDocs(query(collection(db, 'feedsPostCommentsReplies'), where('feedsPostCommentId', '==', commentId)));
    const sorted = snapshot.docs
      .filter((document) => !cursor || this.toMillis(document.data().createdAt) > cursor)
      .sort((left, right) => this.toMillis(left.data().createdAt) - this.toMillis(right.data().createdAt));
    const pageDocuments = sorted.slice(0, 20);
    const items = await Promise.all(pageDocuments.map(async (document): Promise<PostReply> => {
      const data = document.data();
      const [author, like] = await Promise.all([
        this.getAuthor(typeof data.userId === 'string' ? data.userId : ''),
        viewerId ? getDoc(doc(db, 'feedsPostCommentLikes', `reply_${document.id}_${viewerId}`)) : null,
      ]);
      return {
        id: document.id,
        content: typeof data.reply === 'string' ? data.reply : '',
        createdAtMs: this.toMillis(data.createdAt),
        editedAtMs: data.editedAt ? this.toMillis(data.editedAt) : null,
        likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
        isLiked: like?.exists() === true,
        parentReplyId: typeof data.parentReplyId === 'string' ? data.parentReplyId : null,
        replyToUserName: typeof data.replyToUserName === 'string' ? data.replyToUserName : null,
        author,
        sticker: this.readCommentMedia(data.sticker),
      };
    }));
    return { items, hasMore: sorted.length > 20, nextCursor: sorted.length > 20 ? items.at(-1)?.createdAtMs ?? null : null };
  }

  private async getAuthor(userId: string): Promise<CommentAuthor> {
    const user = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const data: DocumentData = user?.data() ?? {};
    return {
      id: userId,
      firstName: typeof data.firstName === 'string' ? data.firstName : 'Deleted',
      lastName: typeof data.lastName === 'string' ? data.lastName : 'User',
      userName: typeof data.userName === 'string' ? data.userName : 'deleted-user',
      profileImage: typeof data.profilePicture === 'string' ? data.profilePicture : typeof data.profileImage === 'string' ? data.profileImage : null,
    };
  }

  private toMillis(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    if (value && typeof value === 'object') {
      const timestamp = value as { seconds?: unknown; toMillis?: unknown };
      if (typeof timestamp.toMillis === 'function') return (timestamp.toMillis as () => number)();
      if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
    }
    return typeof value === 'number' ? value : 0;
  }

  private toPage<TItem>(response: PaginatedApiResponse<TItem>): CommentPage<TItem> {
    return {
      items: response.data ?? [],
      hasMore: response.pagination?.hasMore === true,
      nextCursor: response.pagination?.nextCursor ?? null,
    };
  }

  private validateContent(content: string, label: 'Comment' | 'Reply'): string {
    const normalized = content.trim();
    if (!normalized || normalized.length > 2000) throw new Error(`${label} must be between 1 and 2000 characters`);
    return normalized;
  }

  private readCommentMedia(value: unknown): CommentMediaAsset | null {
    if (!value || typeof value !== 'object') return null;
    const sticker = value as { id?: unknown; name?: unknown; imageUrl?: unknown; type?: unknown };
    if (typeof sticker.id !== 'string' || typeof sticker.name !== 'string' || typeof sticker.imageUrl !== 'string') return null;
    return {
      id: sticker.id,
      name: sticker.name,
      imageUrl: sticker.imageUrl,
      type: sticker.type === 'gif' ? 'gif' : 'sticker',
    };
  }
}

export const commentService = CommentService.getInstance();
