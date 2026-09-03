export type BlogSource = {
  title: string;
  url: string;
  author: string;
  publishDate?: string | Date;
  type: string;
  citation: string;
  status?: 'unchecked' | 'reachable' | 'unavailable';
  lastCheckedAt?: { seconds?: number };
};

export type BlogCategory = {
  name: string;
  description?: string;
  postCount?: number;
  slug?: string;
  isActive?: boolean;
};

export type BlogTag = {
  name: string;
  slug?: string;
  postCount?: number;
};

export type BlogEngagement = {
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  viewsCount: number;
  readTimeAverage: number;
};

export type BlogPostType = 'blog' | 'article';
export type BlogPublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived' | 'removed';
export type BlogContentLabel = 'opinion' | 'sponsored' | 'ai_assisted' | 'personal_experience';

export type BlogAuthorSummary = {
  id?: string;
  name: string;
  avatar: string;
  bio?: string;
  role?: string;
  company?: string;
  followersCount?: number;
  isVerified?: boolean;
};

export type ContentBlock = {
  type: 'paragraph' | 'heading' | 'image' | 'list' | 'quote' | 'callout' | 'conclusion' | string;
  content?: string;
  level?: number;
  src?: string;
  alt?: string;
  caption?: string;
  position?: 'left' | 'right' | 'center';
  items?: Array<{
    title?: string;
    content?: string;
  }>;
  style?: {
    height?: string;
    width?: string;
    margin?: string;
    padding?: string;
    listType?: 'ordered' | 'unordered' | string;
    calloutType?: 'info' | 'warning' | 'success' | string;
    [key: string]: string | undefined;
  };
  author?: string;
  title?: string;
};

export type BlogCommentReply = {
  id: string;
  userId: string;
  text: string;
  createdAt: { seconds?: number; toDate?: () => Date } | string | Date;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
};

export type BlogComment = {
  id: string;
  userId: string;
  text: string;
  createdAt: { seconds?: number; toDate?: () => Date } | string | Date;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
  replies?: BlogCommentReply[];
  isDeleted?: boolean;
  status?: string;
};

export type BlogPostDetail = {
  id: string;
  userId: string;
  title: string;
  type: BlogPostType;
  excerpt: string;
  content: string | ContentBlock[];
  coverImage: string;
  categoryId: string;
  category?: string;
  slug?: string;
  readTime?: number;
  sources?: BlogSource[];
  tags: BlogTag[];
  categories: BlogCategory[];
  engagement: BlogEngagement[];
  author: BlogAuthorSummary;
  createdAt?: { seconds?: number; toDate?: () => Date } | string | Date;
  updatedAt?: { seconds?: number; toDate?: () => Date } | string | Date;
  status: BlogPublicationStatus;
  contentLabels?: BlogContentLabel[];
};
