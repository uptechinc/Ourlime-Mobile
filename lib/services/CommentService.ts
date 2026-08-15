import { collection, doc, getDoc, getDocs, query, where, type DocumentData } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { ApiService, ApiServiceError } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';

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
};

export type CommentPage<TItem> = {
  items: TItem[];
  hasMore: boolean;
  nextCursor: number | null;
};

type PaginatedApiResponse<TItem> = {
  success: boolean;
  data?: TItem[];
  error?: string;
  pagination?: { hasMore?: boolean; nextCursor?: number | null };
};

type ItemApiResponse<TItem> = {
  success: boolean;
  data?: TItem;
  error?: string;
};

export class CommentService {
  private static instance: CommentService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): CommentService {
    if (!CommentService.instance) CommentService.instance = new CommentService();
    return CommentService.instance;
  }

  public async fetchComments(postId: string, cursor?: number | null): Promise<CommentPage<PostComment>> {
    try {
      const search = cursor ? `?limit=20&cursor=${cursor}` : '?limit=20';
      const response = await this.apiService.request<PaginatedApiResponse<PostComment>>(
        `/api/posts/${encodeURIComponent(postId)}/comments${search}`,
        { authenticated: true, timeoutMs: 1_800 }
      );
      if (!response.success) throw new Error(response.error || 'Failed to load comments');
      return this.toPage(response);
    } catch (error: unknown) {
      if (!this.canUseFirestore(error)) throw error;
      return this.fetchCommentsFromFirestore(postId, cursor);
    }
  }

  public async fetchReplies(commentId: string, cursor?: number | null): Promise<CommentPage<PostReply>> {
    try {
      const search = cursor ? `?limit=20&cursor=${cursor}` : '?limit=20';
      const response = await this.apiService.request<PaginatedApiResponse<PostReply>>(
        `/api/posts/comments/${encodeURIComponent(commentId)}/replies${search}`,
        { authenticated: true, timeoutMs: 1_800 }
      );
      if (!response.success) throw new Error(response.error || 'Failed to load replies');
      return this.toPage(response);
    } catch (error: unknown) {
      if (!this.canUseFirestore(error)) throw error;
      return this.fetchRepliesFromFirestore(commentId, cursor);
    }
  }

  public async createComment(postId: string, content: string): Promise<PostComment> {
    const response = await this.apiService.request<ItemApiResponse<PostComment>>(
      `/api/posts/${encodeURIComponent(postId)}/comments`,
      { method: 'POST', authenticated: true, body: { content: this.validateContent(content, 'Comment') } }
    );
    if (!response.success || !response.data) throw new Error(response.error || 'Failed to post comment');
    this.logger.success('CommentService', 'create-comment', { postId, commentId: response.data.id });
    return response.data;
  }

  public async createReply(input: {
    commentId: string;
    content: string;
    parentReplyId?: string | null;
    replyToUserName?: string | null;
  }): Promise<PostReply> {
    const response = await this.apiService.request<ItemApiResponse<PostReply>>(
        `/api/posts/comments/${encodeURIComponent(input.commentId)}/replies`,
        {
          method: 'POST',
          authenticated: true,
          body: {
            content: this.validateContent(input.content, 'Reply'),
            parentReplyId: input.parentReplyId ?? null,
            replyToUserName: input.replyToUserName ?? null,
          },
        },
      );
      if (!response.success || !response.data) throw new Error(response.error || 'Failed to post reply');
      this.logger.success('CommentService', 'create-reply', { commentId: input.commentId, replyId: response.data.id });
      return response.data;
  }

  public async editComment(postId: string, commentId: string, content: string): Promise<number> {
    const response = await this.apiService.request<ItemApiResponse<{ id: string; content: string; editedAtMs: number }>>(
        `/api/posts/${encodeURIComponent(postId)}/comments`,
        { method: 'PATCH', authenticated: true, body: { commentId, content: this.validateContent(content, 'Comment') } }
      );
    if (!response.success || !response.data) throw new Error(response.error || 'Failed to edit comment');
    return response.data.editedAtMs;
  }

  public async editReply(rootCommentId: string, replyId: string, content: string): Promise<number> {
    const response = await this.apiService.request<ItemApiResponse<{ id: string; content: string; editedAtMs: number }>>(
        `/api/posts/comments/${encodeURIComponent(rootCommentId)}/replies`,
        { method: 'PATCH', authenticated: true, body: { replyId, content: this.validateContent(content, 'Reply') } }
      );
    if (!response.success || !response.data) throw new Error(response.error || 'Failed to edit reply');
    return response.data.editedAtMs;
  }

  public async toggleLike(targetType: 'comment' | 'reply', targetId: string): Promise<boolean> {
    const response = await this.apiService.request<ItemApiResponse<{ liked: boolean }>>(
        `/api/posts/comments/${encodeURIComponent(targetId)}/like`,
        { method: 'POST', authenticated: true, body: { targetType } }
      );
    if (!response.success || typeof response.data?.liked !== 'boolean') throw new Error(response.error || 'Failed to update like');
    return response.data.liked;
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

  private canUseFirestore(error: unknown): boolean {
    return error instanceof ApiServiceError && (error.code === 'REQUEST_TIMEOUT' || error.code === 'NETWORK_ERROR' || error.status >= 500);
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
}

export const commentService = CommentService.getInstance();
