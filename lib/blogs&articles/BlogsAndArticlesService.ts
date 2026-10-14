import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { contentDateService } from '@/lib/services/ContentDateService';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { appServerService } from '@/lib/services/AppServerService';
import { contentDraftService } from '@/lib/services/ContentDraftService';
import { nativeEngagementService } from '@/lib/services/NativeEngagementService';
import { nativeSessionService } from '@/lib/services/NativeSessionService';
import { pageAccessService } from '@/lib/services/PageAccessService';
import type {
  BlogAuthorSummary,
  BlogCategory,
  BlogComment,
  BlogCommentLikeState,
  BlogCommentReply,
  BlogEditorDraft,
  BlogEngagement,
  BlogListItem,
  BlogListQuery,
  BlogPage,
  BlogPostDetail,
  BlogPostUpdate,
  BlogPublicationStatus,
  BlogSource,
  BlogSubmitResult,
  BlogSubmitStatus,
  BlogTag,
  ContentBlock,
} from '@/lib/types/blog';

export type { BlogListItem } from '@/lib/types/blog';

export const BLOG_PAGE_SIZE = 6;
// Kept identical to Ourlime-Web lib/blogs&articles/blogSecurity.ts.
export const AUTHOR_DISCLAIMER_VERSION = '2026-08-25';
const MAX_TAG_COUNT = 10;
const LIST_CACHE_MS = 60_000;

/** Thrown when a post does not exist or is not visible to the viewer (web: 404 BLOG_NOT_FOUND). */
export class BlogNotFoundError extends Error {
  public constructor() {
    super('Article not found.');
    this.name = 'BlogNotFoundError';
  }
}

type LoadedPost = { detail: BlogPostDetail; tagNames: string[]; searchText: string };
type AuthorRecord = BlogAuthorSummary & { identityVerified: boolean };

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// ── Ported from Ourlime-Web blogSecurity.ts (the app has no server to do this for it) ──
const BLOCKED_ELEMENTS_PATTERN = /<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*>[\s\S]*?<\/\1\s*>|<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*\/?>/gi;
const EVENT_ATTRIBUTE_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTRIBUTE_PATTERN = /\s+(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi;
const STYLE_ATTRIBUTE_PATTERN = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

function sanitizeBlogHtml(content: string): string {
  if (!content) return '';
  return content.replace(BLOCKED_ELEMENTS_PATTERN, '').replace(EVENT_ATTRIBUTE_PATTERN, '').replace(UNSAFE_URL_ATTRIBUTE_PATTERN, '').replace(STYLE_ATTRIBUTE_PATTERN, '');
}

function sanitizePlainText(value: string, maximumLength: number): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function isSafeExternalUrl(value: string): boolean {
  return !value || /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Blogs & Articles for the app. Reads come from Firestore with the same data model as the website's
 * /api/blogs&articles routes; writes go through the Cloud Functions callables (publishContentDraft,
 * updateBlogPost, archiveBlog, mutateEngagement), since the rules let no client write blog records.
 */
export class BlogsAndArticlesService {
  private static instance: BlogsAndArticlesService;
  private readonly postCache = new Map<string, BlogListItem | BlogPostDetail>();
  private readonly authorCache = new Map<string, Promise<AuthorRecord>>();
  private listCache: { loadedAt: number; ownerId: string | null; posts: Promise<LoadedPost[]> } | null = null;
  private cacheOwnerId: string | null = null;

  private constructor() {}

  public static getInstance(): BlogsAndArticlesService {
    if (!BlogsAndArticlesService.instance) BlogsAndArticlesService.instance = new BlogsAndArticlesService();
    return BlogsAndArticlesService.instance;
  }

  // ── Post cache (instant detail render from a tapped card) ──

  private reconcileCacheOwner(): void {
    const ownerId = auth.currentUser?.uid ?? null;
    if (ownerId !== this.cacheOwnerId) { this.postCache.clear(); this.cacheOwnerId = ownerId; }
  }

  public cachePost(post: BlogListItem | BlogPostDetail): void {
    this.reconcileCacheOwner();
    if (!post?.id) return;
    if (this.postCache.size >= 100) this.postCache.delete(this.postCache.keys().next().value ?? '');
    this.postCache.set(post.id, post);
  }

  public getCachedPost(postId: string): BlogListItem | BlogPostDetail | null {
    this.reconcileCacheOwner();
    return this.postCache.get(postId) ?? null;
  }

  private invalidateList(): void {
    this.listCache = null;
  }

  // ── Listing (web: GET /api/blogs&articles) ──

  public async listPosts(listQuery: BlogListQuery, page: number): Promise<BlogPage> {
    const viewerId = auth.currentUser?.uid ?? null;
    let posts = (await this.loadPublishedPosts()).filter((post) => post.detail.status === 'published');

    if (listQuery.category === 'Saved') {
      if (!viewerId) throw new Error('Please sign in to view your saved blogs.');
      const saved = await getDocs(collection(db, 'users', viewerId, 'savedBlogs'));
      const savedIds = new Set(saved.docs.map((document) => document.id));
      posts = posts.filter((post) => savedIds.has(post.detail.id));
    } else if (listQuery.category && listQuery.category !== 'All') {
      const category = listQuery.category.toLowerCase();
      posts = posts.filter((post) => post.detail.categoryId.toLowerCase() === category
        || post.detail.categories.some((entry) => entry.name.toLowerCase() === category || (entry.slug ?? '').toLowerCase() === category));
    }
    if (listQuery.tags.length > 0) {
      const required = listQuery.tags.map((tag) => tag.toLowerCase());
      posts = posts.filter((post) => required.every((tag) => post.tagNames.includes(tag)));
    }
    if (listQuery.type !== 'all') posts = posts.filter((post) => post.detail.type === listQuery.type);
    const search = listQuery.search.trim().toLowerCase();
    if (search) posts = posts.filter((post) => post.searchText.includes(search));

    const metrics = (post: LoadedPost) => post.detail.engagement[0];
    const createdAt = (post: LoadedPost) => contentDateService.toMilliseconds(post.detail.createdAt) ?? 0;
    const sorted = [...posts].sort((first, second) => {
      if (listQuery.sort === 'most_liked') return metrics(second).likesCount - metrics(first).likesCount;
      if (listQuery.sort === 'most_commented') return metrics(second).commentsCount - metrics(first).commentsCount;
      if (listQuery.sort === 'trending') {
        const score = (post: LoadedPost) => metrics(post).viewsCount + metrics(post).likesCount * 3 + metrics(post).commentsCount * 5;
        return score(second) - score(first);
      }
      return createdAt(second) - createdAt(first);
    });

    const tagCounts = new Map<string, number>();
    sorted.forEach((post) => post.detail.tags.forEach((tag) => tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1)));
    const popularTags = [...tagCounts.entries()].sort((first, second) => second[1] - first[1]).slice(0, 10).map(([name]) => name);

    const items = sorted.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE).map((post) => this.toListItem(post.detail));
    items.forEach((item) => this.cachePost(item));
    return { items, page, total: sorted.length, popularTags };
  }

  /** Loads every visible post with its subcollections once per minute; filtering happens in memory like the web. */
  private loadPublishedPosts(): Promise<LoadedPost[]> {
    const ownerId = auth.currentUser?.uid ?? null;
    if (this.listCache && this.listCache.ownerId === ownerId && Date.now() - this.listCache.loadedAt < LIST_CACHE_MS) return this.listCache.posts;
    const posts = (async () => {
      const snapshot = await getDocs(query(collection(db, 'blogsAndArticles'), where('status', '==', 'published')));
      const visible = snapshot.docs.filter((document) => this.isVisible(document.data()));
      return Promise.all(visible.map((document) => this.loadPost(document.id, document.data(), false)));
    })();
    this.listCache = { loadedAt: Date.now(), ownerId, posts };
    posts.catch(() => { if (this.listCache?.posts === posts) this.listCache = null; });
    return posts;
  }

  private isVisible(data: DocumentData): boolean {
    return data.isDeleted !== true && data.status !== 'deleted' && data.status !== 'removed' && !data.accountLifecycleHiddenAt;
  }

  private async loadPost(postId: string, data: DocumentData, includeSources: boolean): Promise<LoadedPost> {
    const [categorySnap, tagSnap, engagementSnap, sourceSnap, author] = await Promise.all([
      getDocs(collection(db, 'blogsAndArticles', postId, 'categories')),
      getDocs(collection(db, 'blogsAndArticles', postId, 'tags')),
      getDocs(collection(db, 'blogsAndArticles', postId, 'engagement')),
      includeSources ? getDocs(collection(db, 'blogsAndArticles', postId, 'sources')) : Promise.resolve(null),
      this.resolveAuthor(text(data.userId)),
    ]);
    const categories: BlogCategory[] = categorySnap.docs.map((entry) => ({ name: text(entry.data().name), slug: text(entry.data().slug) })).filter((entry) => entry.name);
    const tags: BlogTag[] = tagSnap.docs.map((entry) => ({ name: text(entry.data().name), slug: text(entry.data().slug) })).filter((entry) => entry.name);
    const metricsData = engagementSnap.docs[0]?.data() ?? {};
    const engagement: BlogEngagement = {
      likesCount: count(metricsData.likesCount),
      sharesCount: count(metricsData.sharesCount),
      commentsCount: count(metricsData.commentsCount),
      viewsCount: count(metricsData.viewsCount),
      readTimeAverage: count(metricsData.readTimeAverage),
    };
    const sources: BlogSource[] = (sourceSnap?.docs ?? []).map((entry) => {
      const source = entry.data();
      const publishMs = contentDateService.toMilliseconds(source.publishDate);
      return {
        title: text(source.title), url: text(source.url), author: text(source.author),
        publishDate: publishMs ? new Date(publishMs).toISOString() : undefined,
        type: text(source.type), citation: text(source.citation),
      };
    });
    const categoryId = text(data.categoryId);
    const content: string | ContentBlock[] = Array.isArray(data.content) ? (data.content as ContentBlock[]) : sanitizeBlogHtml(text(data.content));
    const createdMs = contentDateService.toMilliseconds(data.createdAt);
    const updatedMs = contentDateService.toMilliseconds(data.updatedAt);
    const { identityVerified, ...authorSummary } = author;
    const detail: BlogPostDetail = {
      id: postId,
      userId: text(data.userId),
      title: text(data.title),
      type: data.type === 'article' ? 'article' : 'blog',
      excerpt: text(data.excerpt),
      content,
      coverImage: text(data.coverImage),
      categoryId,
      category: categories[0]?.name || categoryId,
      slug: text(data.slug),
      readTime: count(data.readTime),
      sources,
      tags,
      categories,
      engagement: [engagement],
      author: { ...authorSummary, isVerified: identityVerified },
      createdAt: createdMs ? new Date(createdMs).toISOString() : undefined,
      updatedAt: updatedMs ? new Date(updatedMs).toISOString() : undefined,
      status: this.readStatus(data.status),
    };
    const plainContent = typeof content === 'string' ? content.replace(/<[^>]*>/g, ' ') : '';
    const searchText = [detail.title, detail.excerpt, plainContent, author.name, categoryId, ...tags.map((tag) => tag.name)].join(' ').toLowerCase();
    return { detail, tagNames: tags.flatMap((tag) => [tag.name.toLowerCase(), (tag.slug ?? '').toLowerCase()]), searchText };
  }

  /** Same author/avatar resolution as the web blog routes. */
  private resolveAuthor(userId: string): Promise<AuthorRecord> {
    const fallback: AuthorRecord = { id: userId, name: 'Unknown Author', avatar: '', identityVerified: false };
    if (!userId) return Promise.resolve(fallback);
    const cached = this.authorCache.get(userId);
    if (cached) return cached;
    const pending = (async (): Promise<AuthorRecord> => {
      const userSnap = await getDoc(doc(db, 'users', userId)).catch(() => null);
      const user = userSnap?.exists() ? userSnap.data() : null;
      if (!user) return fallback;
      const profileImage: unknown = user.profileImage;
      let avatar = typeof profileImage === 'string' ? profileImage
        : profileImage && typeof profileImage === 'object' && typeof (profileImage as { imageURL?: unknown }).imageURL === 'string' ? (profileImage as { imageURL: string }).imageURL
        : text(user.avatar) || text(user.photoURL) || text(user.profilePicture);
      try {
        const setAs = await getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', userId), where('setAs', '==', 'profile'), limitTo(1)));
        const imageId = text(setAs.docs[0]?.data().profileImageId);
        if (imageId) {
          const imageSnap = await getDoc(doc(db, 'profileImages', imageId));
          const imageUrl = text(imageSnap.data()?.imageURL);
          if (imageUrl) avatar = imageUrl;
        }
      } catch { /* Non-fatal, like the web. */ }
      return {
        id: userId,
        name: text(user.userName) || `${text(user.firstName)} ${text(user.lastName)}`.trim() || 'Unknown Author',
        avatar,
        bio: text(user.bio),
        role: text(user.role),
        company: text(user.company),
        followersCount: count(user.followersCount),
        isVerified: user.identityVerificationStatus === 'verified',
        identityVerified: user.identityVerificationStatus === 'verified' || user.verificationStatus === 'verified',
      };
    })();
    this.authorCache.set(userId, pending);
    if (this.authorCache.size > 200) this.authorCache.delete(this.authorCache.keys().next().value ?? '');
    return pending;
  }

  // ── Detail (web: GET /api/blogs&articles/{id}) ──

  public async getPostDetail(postId: string): Promise<BlogPostDetail> {
    const snapshot = await getDoc(doc(db, 'blogsAndArticles', postId));
    const data = snapshot.exists() ? snapshot.data() : null;
    const isOwner = Boolean(data && auth.currentUser?.uid && data.userId === auth.currentUser.uid);
    if (!data || !this.isVisible(data) || (data.status !== 'published' && !isOwner)) throw new BlogNotFoundError();
    const { detail } = await this.loadPost(postId, data, true);
    this.cachePost(detail);
    return detail;
  }

  // ── Owner actions (web: PATCH / DELETE /api/blogs&articles/{id}) ──

  private async requireOwnedPost(postId: string): Promise<{ userId: string; data: DocumentData }> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in.');
    const snapshot = await getDoc(doc(db, 'blogsAndArticles', postId));
    const data = snapshot.exists() ? snapshot.data() : null;
    if (!data || data.isDeleted === true || data.status === 'removed') throw new BlogNotFoundError();
    if (data.userId !== userId) throw new Error('Only the author can change this post.');
    return { userId, data };
  }

  /** Throws the web's publishing errors when the author may not publish. */
  private async assertCanPublish(userId: string): Promise<void> {
    const userSnap = await getDoc(doc(db, 'users', userId));
    const user = userSnap.data() ?? {};
    if (user.identityVerificationStatus !== 'verified' && user.verificationStatus !== 'verified') {
      throw new Error('Identity verification is required to create or publish blogs.');
    }
    if (user.blogPublishingSuspended === true) throw new Error('Your blog publishing privileges are suspended.');
  }

  /** The author's edit goes through the updateBlogPost callable (the rules keep blog documents server-written). */
  public async updatePost(postId: string, update: BlogPostUpdate): Promise<{ id: string; status: BlogPublicationStatus }> {
    const { userId, data } = await this.requireOwnedPost(postId);
    const targetStatus: BlogSubmitStatus = update.status === 'published' || update.status === 'draft'
      ? update.status
      : data.status === 'published' ? 'published' : 'draft';
    if (targetStatus === 'published') {
      await this.assertCanPublish(userId);
      if (update.disclaimerAcceptance?.accepted !== true) throw new Error('Accept the current disclaimer before publishing changes.');
    }
    const result = await this.callServer<{ id: string; status: BlogSubmitStatus }>(userId, 'updateBlogPost', {
      postId,
      status: targetStatus,
      disclaimerAccepted: update.disclaimerAcceptance?.accepted === true,
      ...(update.title !== undefined ? { title: update.title } : {}),
      ...(update.excerpt !== undefined ? { excerpt: update.excerpt } : {}),
      ...(update.content !== undefined ? { content: update.content } : {}),
      ...(update.coverImage !== undefined ? { coverImage: update.coverImage } : {}),
      ...(update.categoryId !== undefined ? { categoryId: update.categoryId } : {}),
      ...(update.tags !== undefined ? { tags: update.tags.slice(0, MAX_TAG_COUNT) } : {}),
    });
    this.postCache.delete(postId);
    this.invalidateList();
    return { id: result.id, status: result.status };
  }

  public async deletePost(postId: string): Promise<void> {
    const { userId } = await this.requireOwnedPost(postId);
    await this.callServer<void>(userId, 'archiveBlog', { postId });
    this.postCache.delete(postId);
    this.invalidateList();
  }

  /** Blog writes run on the server; the session bridge must be ready first (same as the engagement calls). */
  private async callServer<TResponse>(userId: string, name: string, data: object): Promise<TResponse> {
    pageAccessService.assertMutation('/blogs');
    await nativeSessionService.ensure(userId);
    return appServerService.call<TResponse>(name, data);
  }

  // ── Interactions (web: /api/blogs&articles/{id}/interactions) ──

  public async getInteractions(postId: string): Promise<{ isLiked: boolean; isSaved: boolean }> {
    const userId = auth.currentUser?.uid;
    if (!userId) return { isLiked: false, isSaved: false };
    const [like, saved] = await Promise.all([
      getDoc(doc(db, 'blogsAndArticles', postId, 'likes', userId)),
      getDoc(doc(db, 'users', userId, 'savedBlogs', postId)),
    ]);
    return { isLiked: like.exists(), isSaved: saved.exists() };
  }

  /** Likes, saves and views go through mutateEngagement, which keeps one record per member and the totals. */
  public async updateInteraction(postId: string, action: 'like' | 'save' | 'view', enabled?: boolean): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Please sign in.');
    await nativeEngagementService.mutate(userId, {
      kind: 'blog',
      targetId: postId,
      action: action === 'save' ? 'bookmark' : action,
      active: action === 'view' ? true : enabled === true,
    });
    if (action === 'like') this.invalidateList();
  }

  // ── Comments (web: /api/blogs&articles/{id}/comments) ──

  public async getComments(postId: string): Promise<BlogComment[]> {
    const viewerId = auth.currentUser?.uid ?? null;
    const [snapshot, likes] = await Promise.all([
      getDocs(query(collection(db, 'blogsAndArticles', postId, 'comments'), orderBy('createdAt', 'desc'), limitTo(50))),
      // commentLikes is server-written and not readable under the rules; a denied read shows no likes as the viewer's.
      viewerId ? getDocs(query(collection(db, 'blogsAndArticles', postId, 'commentLikes'), where('userId', '==', viewerId))).catch(() => null) : Promise.resolve(null),
    ]);
    const liked = new Set((likes?.docs ?? []).map((entry) => `${text(entry.data().commentId)}:${text(entry.data().replyId)}`));
    const visible = snapshot.docs.filter((entry) => entry.data().isDeleted !== true && entry.data().status !== 'deleted');
    return Promise.all(visible.map(async (entry): Promise<BlogComment> => {
      const data = entry.data();
      const author = await this.resolveAuthor(text(data.userId));
      // Replies are stored in the comment (website and older app versions) or, from the server, under comments/{id}/replies.
      const nativeReplies = count(data.replyCount) > 0
        ? (await getDocs(query(collection(db, 'blogsAndArticles', postId, 'comments', entry.id, 'replies'), limitTo(50))).catch(() => null))?.docs
          .filter((reply) => !/^legacy_\d+$/.test(reply.id) && reply.data().isDeleted !== true)
          .map((reply): DocumentData => ({ ...reply.data(), id: reply.id })) ?? []
        : [];
      const storedReplies: DocumentData[] = [...(Array.isArray(data.replies) ? data.replies : []), ...nativeReplies];
      const replies: BlogCommentReply[] = await Promise.all(storedReplies.map(async (reply: DocumentData): Promise<BlogCommentReply> => {
        const replyAuthor = await this.resolveAuthor(text(reply.userId));
        return {
          id: text(reply.id),
          userId: text(reply.userId),
          text: text(reply.text) || text(reply.content),
          createdAt: this.toIso(reply.createdAt),
          authorName: text(reply.authorName) || replyAuthor.name,
          authorAvatar: replyAuthor.avatar || text(reply.authorAvatar),
          isVerified: reply.isVerified === true,
          isDeleted: reply.isDeleted === true,
          likesCount: count(reply.likesCount),
          isLiked: liked.has(`${entry.id}:${text(reply.id)}`),
        };
      }));
      return {
        id: entry.id,
        userId: text(data.userId),
        text: text(data.text) || text(data.content),
        createdAt: this.toIso(data.createdAt),
        authorName: author.name,
        authorAvatar: author.avatar,
        isVerified: author.isVerified === true,
        likesCount: count(data.likesCount),
        isLiked: liked.has(`${entry.id}:`),
        replies,
      };
    }));
  }

  /** A comment, or a reply to commentId, through mutateEngagement (it also moves the comment total). */
  public async addComment(postId: string, commentText: string, commentId?: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Please sign in.');
    const body = sanitizePlainText(commentText, 2000);
    if (!body) throw new Error('Comment cannot be empty.');
    await nativeEngagementService.mutate(userId, { kind: 'blog', targetId: postId, action: 'comment', text: body, ...(commentId ? { parentId: commentId } : {}) });
  }

  /** The comment's author removes it (the server keeps the comment total in step). */
  public async deleteComment(postId: string, commentId: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Please sign in.');
    await nativeEngagementService.mutate(userId, { kind: 'blog', targetId: postId, action: 'delete_comment', commentId });
  }

  /** Likes a comment, or a reply (replyId) under commentId, through mutateEngagement. */
  public async setCommentLike(postId: string, commentId: string, enabled: boolean, replyId?: string): Promise<BlogCommentLikeState> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Please sign in.');
    const result = await nativeEngagementService.mutate(userId, {
      kind: 'blog', targetId: postId, action: 'comment_like', active: enabled,
      ...(replyId ? { parentId: commentId, commentId: replyId } : { commentId }),
    });
    return { isLiked: result.active ?? enabled, likesCount: result.count ?? 0 };
  }

  // ── Editor ──

  public createDraft(): BlogEditorDraft {
    return { title: '', type: 'blog', excerpt: '', content: '', coverImage: '', categoryId: '', tags: [], sources: [] };
  }

  /** Converts a loaded post into editor state (web: CreateBlogModal initialData). */
  public toEditorDraft(post: BlogPostDetail): BlogEditorDraft {
    return {
      title: post.title,
      type: post.type,
      excerpt: post.excerpt,
      content: typeof post.content === 'string' ? post.content : '',
      coverImage: post.coverImage,
      categoryId: post.categoryId,
      tags: post.tags.map((tag) => tag.name).filter(Boolean),
      sources: (post.sources ?? []).map((source) => ({
        title: source.title,
        url: source.url,
        author: source.author,
        publishDate: typeof source.publishDate === 'string' ? source.publishDate.split('T')[0] : '',
        type: source.type,
        citation: source.citation,
      })),
    };
  }

  // Same key shape as the web editor's localStorage autosave: blog-draft-{userId}[-{editBlogId}].
  private draftKey(userId: string, editBlogId?: string): string {
    return `blog-draft-${userId}${editBlogId ? `-${editBlogId}` : ''}`;
  }

  public async saveDraft(userId: string, draft: BlogEditorDraft, editBlogId?: string): Promise<void> {
    if (!userId || auth.currentUser?.uid !== userId) return;
    await AsyncStorage.setItem(this.draftKey(userId, editBlogId), JSON.stringify(draft));
  }

  public async loadDraft(userId: string, editBlogId?: string): Promise<BlogEditorDraft | null> {
    const saved = await AsyncStorage.getItem(this.draftKey(userId, editBlogId));
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved) as Partial<BlogEditorDraft>;
      if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string') return null;
      return {
        ...this.createDraft(),
        ...parsed,
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      };
    } catch {
      return null;
    }
  }

  public async clearDraft(userId: string, editBlogId?: string): Promise<void> {
    await AsyncStorage.removeItem(this.draftKey(userId, editBlogId));
  }

  /** Uploads to the same Storage folder as the web editor (blog-covers/). */
  public async uploadCoverImage(localUri: string): Promise<string> {
    if (!auth.currentUser) throw new Error('Please sign in to upload a cover image.');
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const image = await manipulateAsync(localUri, [{ resize: { width: 1600 } }], { compress: 0.85, format: SaveFormat.JPEG });
    const blob = await (await fetch(image.uri)).blob();
    if (blob.size >= 5 * 1024 * 1024) throw new Error('Image size must be less than 5MB.');
    const storageReference = ref(storage, `blog-covers/${Date.now()}.jpg`);
    await uploadBytes(storageReference, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageReference);
  }

  /**
   * Web editor submit: creates a post (web POST route + createPost) or edits one (PATCH route),
   * with status 'published' (verification + disclaimer required) or 'draft'.
   */
  public async submitPost(draft: BlogEditorDraft, status: BlogSubmitStatus, disclaimerAccepted: boolean, editBlogId?: string): Promise<BlogSubmitResult> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Please sign in to publish.');
    if (status === 'published' && !disclaimerAccepted) throw new Error('Accept the current Author Publishing Disclaimer before publishing.');
    if (editBlogId) {
      await this.updatePost(editBlogId, {
        title: draft.title, excerpt: draft.excerpt, content: draft.content, coverImage: draft.coverImage,
        categoryId: draft.categoryId, tags: draft.tags, status, disclaimerAcceptance: { accepted: disclaimerAccepted },
      });
      await this.clearDraft(userId, editBlogId);
      return { postId: editBlogId, slug: '', readTime: 0 };
    }

    if (status === 'published') await this.assertCanPublish(userId);
    const title = sanitizePlainText(draft.title, 180);
    const excerpt = sanitizePlainText(draft.excerpt, 500);
    const content = sanitizeBlogHtml(draft.content);
    const categoryId = sanitizePlainText(draft.categoryId, 80);
    if (!title || !excerpt || !content.replace(/<[^>]*>/g, '').trim() || !categoryId) throw new Error('Title, excerpt, content, and category are required.');
    const tags = [...new Set(draft.tags.map((tag) => sanitizePlainText(tag, 40)).filter(Boolean))];
    if (tags.length > MAX_TAG_COUNT) throw new Error(`A maximum of ${MAX_TAG_COUNT} tags is allowed.`);
    const sources = draft.sources.filter((source) => source.url.trim());
    if (sources.some((source) => !isSafeExternalUrl(source.url) || !Number.isFinite(Date.parse(source.publishDate)))) throw new Error('Every source must use a valid HTTP or HTTPS URL and date.');
    if (draft.coverImage && !/^https:\/\//i.test(draft.coverImage)) throw new Error('The cover image link is not valid.');
    const readTime = Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 200));

    // New posts are published by the publishContentDraft callable from a saved account draft; "Save draft" keeps
    // the post as that account draft (it appears under Drafts) until it is published.
    const saved = await contentDraftService.create(userId, 'blog', {
      title, type: draft.type, excerpt, content, coverImage: draft.coverImage, categoryId, readTime, tags,
      sources: sources.map((source) => ({
        title: sanitizePlainText(source.title, 200), url: source.url.trim(), author: sanitizePlainText(source.author, 120),
        publishDate: source.publishDate, type: sanitizePlainText(source.type, 50), citation: sanitizePlainText(source.citation, 500), isVerified: false,
      })),
    });
    const synced = await contentDraftService.sync(userId);
    if (status === 'draft') {
      await this.clearDraft(userId);
      return { postId: saved.id, slug: '', readTime };
    }
    if (synced.conflicts > 0) throw new Error('Your draft changed on another device. Review it under Drafts before publishing.');
    const receipt = await contentDraftService.publish(saved, { disclaimerAccepted });
    await this.clearDraft(userId);
    this.invalidateList();
    return { postId: receipt.destinationId, slug: '', readTime };
  }

  // ── Mapping ──

  private readStatus(value: unknown): BlogPublicationStatus {
    return value === 'draft' || value === 'scheduled' || value === 'archived' || value === 'removed' ? value : 'published';
  }

  private toIso(value: unknown): string {
    const milliseconds = contentDateService.toMilliseconds(value);
    return new Date(milliseconds ?? Date.now()).toISOString();
  }

  private toListItem(post: BlogPostDetail): BlogListItem {
    const metrics = post.engagement[0];
    return {
      id: post.id,
      userId: post.userId,
      title: post.title,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      type: post.type,
      categoryId: post.categoryId,
      categoryName: post.categories[0]?.name || post.categoryId || 'General',
      tags: post.tags.map((tag) => tag.name),
      readTime: post.readTime ?? 0,
      createdAtMs: contentDateService.toMilliseconds(post.createdAt),
      status: post.status,
      author: { id: post.userId, name: post.author.name, avatar: post.author.avatar, isVerified: post.author.isVerified === true },
      likesCount: metrics?.likesCount ?? 0,
      commentsCount: metrics?.commentsCount ?? 0,
      viewsCount: metrics?.viewsCount ?? 0,
    };
  }
}

export const blogsAndArticlesService = BlogsAndArticlesService.getInstance();
