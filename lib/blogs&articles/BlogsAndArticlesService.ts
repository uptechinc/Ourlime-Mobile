import { db, auth } from '@/lib/firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  Firestore,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { ApiService } from '@/lib/services/ApiService';
import type {
  BlogPostDetail,
  BlogComment,
  BlogSource,
  BlogCategory,
  BlogTag,
  ContentBlock,
} from '@/lib/types/blog';

export type BlogListItem = {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  author: { id: string; name: string; avatar: string; isVerified?: boolean };
  category: string;
  categories: Array<{ name: string }>;
  tags: Array<{ name: string }>;
  readTime: number;
  createdAt?: { seconds?: number; toDate?: () => Date } | string | Date;
  publishedDate?: string;
  likes: number;
  comments: number;
  engagement: { likes?: number; comments?: number; shares?: number };
};

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export class BlogsAndArticlesService {
  private static instance: BlogsAndArticlesService;
  private readonly db: Firestore;
  private readonly api = ApiService.getInstance();

  private constructor() {
    this.db = db;
  }

  public static getInstance(): BlogsAndArticlesService {
    if (!BlogsAndArticlesService.instance) {
      BlogsAndArticlesService.instance = new BlogsAndArticlesService();
    }
    return BlogsAndArticlesService.instance;
  }

  public async createPost(postData: {
    userId: string;
    title: string;
    type: 'blog' | 'article';
    excerpt: string;
    content: string;
    coverImage: string;
    categoryId: string;
    readTime?: number;
    sources?: Array<{
      title: string;
      url: string;
      author: string;
      publishDate: Date;
      type: string;
      citation: string;
      isVerified: boolean;
    }>;
    tags?: string[];
  }) {
    try {
      const postsRef = collection(this.db, 'blogsAndArticles');
      const newPostRef = doc(postsRef);
      const postId = newPostRef.id;

      const postDocument = {
        userId: postData.userId,
        title: postData.title,
        type: postData.type,
        excerpt: postData.excerpt,
        content: postData.content,
        coverImage: postData.coverImage,
        categoryId: postData.categoryId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'published',
        flags: {
          isFeatured: false,
          trending: false,
        },
      };

      await setDoc(newPostRef, postDocument);

      if (postData.sources?.length) {
        const sourcesRef = collection(this.db, `blogsAndArticles/${postId}/sources`);
        for (const source of postData.sources) {
          const sourceDoc = doc(sourcesRef);
          await setDoc(sourceDoc, {
            ...source,
            lastCheckedAt: serverTimestamp(),
          });
        }
      }

      const categoryRef = doc(collection(this.db, `blogsAndArticles/${postId}/categories`), postData.categoryId);
      await setDoc(categoryRef, {
        name: postData.categoryId,
        description: '',
        postCount: 1,
        slug: postData.categoryId.toLowerCase(),
        isActive: true,
      });

      if (postData.tags?.length) {
        const tagsRef = collection(this.db, `blogsAndArticles/${postId}/tags`);
        for (const tag of postData.tags) {
          const tagDoc = doc(tagsRef);
          await setDoc(tagDoc, {
            name: tag,
            slug: tag.toLowerCase(),
            postCount: 1,
          });
        }
      }

      const engagementRef = doc(collection(this.db, `blogsAndArticles/${postId}/engagement`), 'metrics');
      await setDoc(engagementRef, {
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        readTimeAverage: postData.readTime || 0,
      });

      return { id: postId };
    } catch (error) {
      console.error('Detailed error in createPost:', error);
      throw new Error('Failed to create post');
    }
  }

  public async getPosts(): Promise<BlogListItem[]> {
    try {
      const postsRef = collection(this.db, 'blogsAndArticles');
      const postsSnapshot = await getDocs(postsRef);

      const posts = await Promise.all(
        postsSnapshot.docs.map(async (docSnap) => {
          const postData = docSnap.data();

          const engagementRef = collection(this.db, `blogsAndArticles/${docSnap.id}/engagement`);
          const engagementSnapshot = await getDocs(engagementRef);
          const engagement = engagementSnapshot.docs.map((item) => item.data());

          const categoryRef = collection(this.db, `blogsAndArticles/${docSnap.id}/categories`);
          const categorySnapshot = await getDocs(categoryRef);
          const categories = categorySnapshot.docs.map((cat) => cat.data());

          const tagsRef = collection(this.db, `blogsAndArticles/${docSnap.id}/tags`);
          const tagsSnapshot = await getDocs(tagsRef);
          const tags = tagsSnapshot.docs.map((tag) => tag.data());

          const author = readRecord(postData.author);
          const normalizedEngagement = engagement.map((item) => ({
            likesCount: readNumber(item.likesCount),
            commentsCount: readNumber(item.commentsCount),
          }));

          return {
            id: docSnap.id,
            title: readString(postData.title),
            excerpt: readString(postData.excerpt) || readString(postData.description),
            coverImage: readString(postData.coverImage) || readString(postData.imageUrl),
            author: {
              id: readString(author.id) || readString(postData.userId),
              name: readString(author.name) || readString(postData.authorName, 'Ourlime user'),
              avatar: readString(author.avatar),
              isVerified: Boolean(author.isVerified),
            },
            category: readString(postData.category) || readString(categories[0]?.name),
            categories: categories.map((item) => ({ name: readString(item.name) })).filter((item) => item.name),
            tags: tags.map((item) => ({ name: readString(item.name) })).filter((item) => item.name),
            readTime: readNumber(postData.readTime) || 3,
            createdAt: postData.createdAt ?? postData.publishedDate ?? null,
            publishedDate: readString(postData.publishedDate) || undefined,
            likes: readNumber(postData.likes) || normalizedEngagement[0]?.likesCount || 0,
            comments: readNumber(postData.comments) || normalizedEngagement[0]?.commentsCount || 0,
            engagement: {
              likes: readNumber(postData.likes) || normalizedEngagement[0]?.likesCount || 0,
              comments: readNumber(postData.comments) || normalizedEngagement[0]?.commentsCount || 0,
              shares: 0,
            },
          };
        })
      );

      return posts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw new Error('Failed to fetch posts');
    }
  }

  public async getPost(postId: string): Promise<BlogListItem> {
    const postSnapshot = await getDoc(doc(this.db, 'blogsAndArticles', postId));
    if (!postSnapshot.exists()) throw new Error('Blog not found');
    const posts = await this.getPosts();
    const post = posts.find((item) => item.id === postId);
    if (!post) throw new Error('Blog could not be normalized');
    return post;
  }

  public async getPostDetail(postId: string): Promise<BlogPostDetail> {
    try {
      const postRef = doc(this.db, 'blogsAndArticles', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) throw new Error('Blog not found');
      const data = postSnap.data();

      // Parse content
      let parsedContent: string | ContentBlock[] = data.content || '';
      if (typeof data.content === 'string' && data.content.trim().startsWith('[')) {
        try {
          parsedContent = JSON.parse(data.content) as ContentBlock[];
        } catch {
          parsedContent = data.content;
        }
      }

      // Fetch Subcollections
      const [engagementSnap, categoriesSnap, tagsSnap, sourcesSnap] = await Promise.all([
        getDocs(collection(this.db, `blogsAndArticles/${postId}/engagement`)),
        getDocs(collection(this.db, `blogsAndArticles/${postId}/categories`)),
        getDocs(collection(this.db, `blogsAndArticles/${postId}/tags`)),
        getDocs(collection(this.db, `blogsAndArticles/${postId}/sources`)),
      ]);

      const engagement = engagementSnap.docs.map((docSnap) => {
        const item = docSnap.data();
        return {
          likesCount: readNumber(item.likesCount),
          sharesCount: readNumber(item.sharesCount),
          commentsCount: readNumber(item.commentsCount),
          viewsCount: readNumber(item.viewsCount),
          readTimeAverage: readNumber(item.readTimeAverage),
        };
      });

      const categories: BlogCategory[] = categoriesSnap.docs.map((docSnap) => ({
        name: readString(docSnap.data().name),
        description: readString(docSnap.data().description),
        postCount: readNumber(docSnap.data().postCount),
        slug: readString(docSnap.data().slug),
        isActive: Boolean(docSnap.data().isActive),
      }));

      const tags: BlogTag[] = tagsSnap.docs.map((docSnap) => ({
        name: readString(docSnap.data().name),
        slug: readString(docSnap.data().slug),
        postCount: readNumber(docSnap.data().postCount),
      }));

      const sources: BlogSource[] = sourcesSnap.docs.map((docSnap) => {
        const item = docSnap.data();
        return {
          title: readString(item.title),
          url: readString(item.url),
          author: readString(item.author),
          publishDate: item.publishDate,
          type: readString(item.type),
          citation: readString(item.citation),
          status: item.status,
          lastCheckedAt: item.lastCheckedAt,
        };
      });

      // Fetch Author Details
      let authorName = 'Ourlime Creator';
      let authorAvatar = '';
      let authorBio = '';
      let authorRole = '';
      let authorCompany = '';
      let authorFollowers = 0;
      let authorVerified = false;

      const userId = readString(data.userId);
      if (userId) {
        try {
          const userSnap = await getDoc(doc(this.db, 'users', userId));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            authorName = `${readString(userData.firstName)} ${readString(userData.lastName)}`.trim() || readString(userData.userName) || authorName;
            authorBio = readString(userData.bio);
            authorRole = readString(userData.role);
            authorCompany = readString(userData.company);
            authorFollowers = readNumber(userData.followersCount);
            authorVerified = userData.identityVerificationStatus === 'verified';
          }
          // Check profile images
          const imageSnap = await getDocs(query(collection(this.db, 'profileImages'), where('userId', '==', userId)));
          if (!imageSnap.empty) {
            authorAvatar = readString(imageSnap.docs[0].data()?.imageURL);
          }
        } catch (authorErr) {
          console.warn('[getPostDetail] Error fetching author profile:', authorErr);
        }
      }

      return {
        id: postId,
        userId: readString(data.userId),
        title: readString(data.title, 'Untitled Post'),
        type: data.type === 'article' ? 'article' : 'blog',
        excerpt: readString(data.excerpt) || readString(data.description),
        content: parsedContent,
        coverImage: readString(data.coverImage) || readString(data.imageUrl),
        categoryId: readString(data.categoryId),
        category: readString(data.category) || categories[0]?.name || readString(data.categoryId),
        slug: readString(data.slug),
        readTime: readNumber(data.readTime) || 3,
        sources,
        tags,
        categories,
        engagement: engagement.length ? engagement : [{ likesCount: 0, sharesCount: 0, commentsCount: 0, viewsCount: 0, readTimeAverage: 0 }],
        author: {
          id: userId,
          name: authorName,
          avatar: authorAvatar,
          bio: authorBio,
          role: authorRole,
          company: authorCompany,
          followersCount: authorFollowers,
          isVerified: authorVerified,
        },
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        status: data.status || 'published',
        contentLabels: data.contentLabels || [],
      };
    } catch (error) {
      console.error('[getPostDetail] Failed to load blog:', error);
      throw error;
    }
  }

  public async getComments(postId: string): Promise<BlogComment[]> {
    try {
      const response = await this.api.request<{ data: BlogComment[] }>(`/api/blogs&articles/${postId}/comments`, {
        method: 'GET',
        authenticated: true,
      });
      return response.data;
    } catch (apiErr) {
      console.warn('[getComments] Web API fallback to Firestore:', apiErr);
      const commentsRef = collection(this.db, `blogsAndArticles/${postId}/comments`);
      const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(commentsQuery);
      return snapshot.docs.map((docSnap) => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          userId: readString(item.userId),
          text: readString(item.text),
          createdAt: item.createdAt,
          authorName: readString(item.authorName, 'User'),
          authorAvatar: readString(item.authorAvatar),
          isVerified: Boolean(item.isVerified),
          replies: Array.isArray(item.replies) ? item.replies : [],
          isDeleted: Boolean(item.isDeleted),
        };
      });
    }
  }

  public async addComment(postId: string, text: string, commentId?: string): Promise<void> {
    await this.api.request(`/api/blogs&articles/${postId}/comments`, {
      method: 'POST',
      authenticated: true,
      body: {
        action: commentId ? 'reply' : 'comment',
        text,
        commentId,
      },
    });
  }

  public async deleteComment(postId: string, commentId: string): Promise<void> {
    await this.api.request(`/api/blogs&articles/${postId}/comments?commentId=${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      authenticated: true,
    });
  }

  public async getInteractions(postId: string): Promise<{ isLiked: boolean; isSaved: boolean }> {
    try {
      const response = await this.api.request<{ data: { isLiked: boolean; isSaved: boolean } }>(
        `/api/blogs&articles/${postId}/interactions`,
        {
          method: 'GET',
          authenticated: true,
        }
      );
      return response.data;
    } catch {
      return { isLiked: false, isSaved: false };
    }
  }

  public async updateInteraction(postId: string, action: 'like' | 'save' | 'view', enabled?: boolean): Promise<void> {
    await this.api.request(`/api/blogs&articles/${postId}/interactions`, {
      method: 'POST',
      authenticated: true,
      body: { action, enabled },
    });
  }

  public async deletePost(postId: string): Promise<void> {
    try {
      await this.api.request(`/api/blogs&articles/${postId}`, {
        method: 'DELETE',
        authenticated: true,
      });
    } catch {
      await deleteDoc(doc(this.db, 'blogsAndArticles', postId));
    }
  }
}

export const blogsAndArticlesService = BlogsAndArticlesService.getInstance();
