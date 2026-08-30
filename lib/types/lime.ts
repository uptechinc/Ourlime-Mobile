import type { DocumentSnapshot } from 'firebase/firestore';
import type { CommentMediaAsset } from '@/lib/services/CommentService';

export type LimeComment = {
  id: string;
  reelId: string;
  userId: string;
  content: string;
  userName: string;
  firstName: string;
  profileImage?: string;
  likes: string[];
  replyCount: number;
  parentCommentId?: string | null;
  replyToUserName?: string | null;
  createdAt: number;
  editedAt?: number;
  sticker?: CommentMediaAsset | null;
};

export type LimeCommentCursor = DocumentSnapshot;

export type LimeCommentPage = {
  items: LimeComment[];
  nextCursor: LimeCommentCursor | null;
  hasMore: boolean;
};

export type CreateLimeInput = {
  userId: string;
  uri: string;
  thumbnailUri?: string;
  durationSeconds: number;
  visibility: 'public' | 'friends' | 'private';
  category: string;
  caption: string;
  mentions: string[];
};

export type CreateLimeCommentInput = {
  reelId: string;
  userId: string;
  userName: string;
  firstName: string;
  profileImage?: string;
  content: string;
  parentCommentId?: string | null;
  replyToUserName?: string | null;
  sticker?: CommentMediaAsset;
};
