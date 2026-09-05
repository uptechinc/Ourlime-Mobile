import type { CreatePostInput } from '@/lib/services/PostService';
import type { CreateEventInput } from '@/lib/services/EventService';
import type { PostUploadStage } from '@/lib/services/PostMediaService';

export type PostSubmissionDraft = {
  post: Omit<CreatePostInput, 'signal' | 'onUploadProgress' | 'onStage'>;
  event?: CreateEventInput;
};

export type PostSubmissionSnapshot = {
  id: string;
  userId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stage: PostUploadStage;
  mediaIndex: number;
  mediaCount: number;
  thumbnailUri?: string;
  percentage: number;
  completedBytes: number;
  totalBytes: number;
  elapsedSeconds: number;
  isSlow: boolean;
  message: string;
  canRetry: boolean;
  canCancel: boolean;
};
