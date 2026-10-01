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
  items?: {
    title?: string;
    content?: string;
  }[];
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
  isDeleted?: boolean;
  id: string;
  userId: string;
  text: string;
  createdAt: { seconds?: number; toDate?: () => Date } | string | Date;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
  likesCount?: number;
  isLiked?: boolean;
};

export type BlogCommentLikeState = { isLiked: boolean; likesCount: number };

export type BlogComment = {
  id: string;
  userId: string;
  text: string;
  createdAt: { seconds?: number; toDate?: () => Date } | string | Date;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
  likesCount?: number;
  isLiked?: boolean;
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

export type BlogSortOption = 'newest' | 'most_liked' | 'most_commented' | 'trending';
export type BlogTypeFilter = 'all' | BlogPostType;

/** Card model for the blog list, normalized from GET /api/blogs&articles items. */
export type BlogListItem = {
  id: string;
  userId: string;
  title: string;
  excerpt: string;
  coverImage: string;
  type: BlogPostType;
  categoryId: string;
  categoryName: string;
  tags: string[];
  readTime: number;
  createdAtMs: number | null;
  status: BlogPublicationStatus;
  author: { id: string; name: string; avatar: string; isVerified: boolean };
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
};

/** Mirrors the web list query params (app/blogs/page.tsx → GET /api/blogs&articles). */
export type BlogListQuery = {
  search: string;
  category: string;
  tags: string[];
  type: BlogTypeFilter;
  sort: BlogSortOption;
};

export type BlogPage = { items: BlogListItem[]; page: number; total: number; popularTags: string[] };

export type BlogPostUpdate = Partial<Pick<BlogPostDetail, 'title' | 'excerpt' | 'coverImage' | 'categoryId'>> & {
  content?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  disclaimerAcceptance?: { accepted: boolean };
};

/** Mirrors Ourlime-Web CreateBlogModal form state; submitted to POST /api/blogs&articles. */
export type BlogEditorSource = {
  title: string;
  url: string;
  author: string;
  publishDate: string;
  type: string;
  citation: string;
};

export type BlogEditorDraft = {
  title: string;
  type: BlogPostType;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  tags: string[];
  sources: BlogEditorSource[];
};

export type BlogSubmitStatus = 'published' | 'draft';

export type BlogSubmitResult = { postId: string; slug: string; readTime: number };
