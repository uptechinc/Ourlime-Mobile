import { ApiService } from './ApiService';
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
    const query = cursor ? `?limit=20&cursor=${cursor}` : '?limit=20';
    const response = await this.apiService.request<PaginatedApiResponse<PostComment>>(
      `/api/posts/${encodeURIComponent(postId)}/comments${query}`,
      { authenticated: true }
    );
    if (!response.success) throw new Error(response.error || 'Failed to load comments');
    return this.toPage(response);
  }

  public async fetchReplies(commentId: string, cursor?: number | null): Promise<CommentPage<PostReply>> {
    const query = cursor ? `?limit=20&cursor=${cursor}` : '?limit=20';
    const response = await this.apiService.request<PaginatedApiResponse<PostReply>>(
      `/api/posts/comments/${encodeURIComponent(commentId)}/replies${query}`,
      { authenticated: true }
    );
    if (!response.success) throw new Error(response.error || 'Failed to load replies');
    return this.toPage(response);
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
      }
    );
    if (!response.success || !response.data) throw new Error(response.error || 'Failed to post reply');
    this.logger.success('CommentService', 'create-reply', { commentId: input.commentId, replyId: response.data.id });
    return response.data;
  }

  public async editComment(postId: string, commentId: string, content: string): Promise<number> {
    const response = await this.apiService.request<ItemApiResponse<{ id: string; content: string; editedAtMs: number }>>(
      `/api/posts/${encodeURIComponent(postId)}/comments`,
      {
        method: 'PATCH',
        authenticated: true,
        body: { commentId, content: this.validateContent(content, 'Comment') },
      }
    );
    if (!response.success || !response.data) throw new Error(response.error || 'Failed to edit comment');
    return response.data.editedAtMs;
  }

  public async editReply(rootCommentId: string, replyId: string, content: string): Promise<number> {
    const response = await this.apiService.request<ItemApiResponse<{ id: string; content: string; editedAtMs: number }>>(
      `/api/posts/comments/${encodeURIComponent(rootCommentId)}/replies`,
      {
        method: 'PATCH',
        authenticated: true,
        body: { replyId, content: this.validateContent(content, 'Reply') },
      }
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
