export type DeletableContentType =
  | 'post'
  | 'comment'
  | 'product'
  | 'blog'
  | 'project'
  | 'community'
  | 'lime';

export type PredefinedDeletionCategory =
  | 'inappropriate'
  | 'harassment'
  | 'spam'
  | 'misinformation'
  | 'copyright'
  | 'safety'
  | 'tos_violation'
  | 'custom';

export type DeletionCategoryOption = {
  id: PredefinedDeletionCategory;
  label: string;
  description: string;
};

export type AdminDeleteContentRequest = {
  contentType: DeletableContentType;
  contentId: string;
  category: PredefinedDeletionCategory;
  customReason?: string;
  additionalNotes?: string;
};

export type AdminRestoreContentRequest = {
  contentType: DeletableContentType;
  contentId: string;
  restoreReason?: string;
};

export type SubmitAppealRequest = {
  contentId: string;
  contentType: DeletableContentType;
  deletionReason: string;
  appealReason: string;
};

export type ContentAppealRecord = {
  id: string;
  contentId: string;
  contentType: DeletableContentType;
  authorId: string;
  authorEmail?: string;
  authorName?: string;
  deletionReason: string;
  appealReason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
};

export type UserDeletedPostRecord = {
  id: string;
  caption?: string;
  userId: string;
  deletedAt: string;
  deletedByName?: string;
  deletionReason?: string;
  deletionCategory?: string;
  imageUrl?: string;
  images?: string[];
  mediaUrls?: string[];
  type?: string;
};