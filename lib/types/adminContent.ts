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
  message?: string;
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

export type AdminUserContentFilter = 'all' | 'active' | 'deleted_by_admin';

export type AdminContentMediaPreview = {
  id: string;
  url: string;
  type: 'image' | 'video' | 'media';
  thumbnailUrl: string | null;
};

export type AdminUserContentRecord = {
  id: string;
  authorId: string;
  contentType: 'post' | 'lime';
  caption: string;
  description: string;
  visibility: string;
  createdAt: string | null;
  mediaPreviewUrl: string | null;
  mediaPreviewType: string | null;
  mediaPreviews: AdminContentMediaPreview[];
  isDeleted: boolean;
  deletedByAdmin: boolean;
  deletedAt: string | null;
  adminId: string | null;
  adminName: string | null;
  deletionReason: string | null;
  deletionCategory: string | null;
  deletionNotes: string | null;
  deletionAuditId: string | null;
};

export type AdminUserContentPage = {
  items: AdminUserContentRecord[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
};
