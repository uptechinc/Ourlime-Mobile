import type { DocumentSnapshot } from 'firebase/firestore';

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
};
