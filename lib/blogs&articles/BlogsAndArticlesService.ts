import { db } from '@/lib/firebaseConfig';

export type BlogListItem = {
    id: string;
    title: string;
    excerpt: string;
    coverImage: string;
    author: { id: string; name: string; avatar: string };
    category: string;
    categories: Array<{ name: string }>;
    tags: Array<{ name: string }>;
    readTime: number;
    createdAt: unknown;
    publishedDate?: string;
    likes: number;
    comments: number;
    engagement: Array<{ likesCount?: number; commentsCount?: number }>;
};

function readString(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function readNumber(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function readRecord(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
import { 
    collection, 
    doc,
    setDoc,
    serverTimestamp, 
    Firestore,
    getDocs,
    getDoc
} from 'firebase/firestore';

export class BlogsAndArticlesService {
    private static instance: BlogsAndArticlesService;
    private readonly db: Firestore;

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
            // Create main post document
            const postsRef = collection(db, 'blogsAndArticles');
            const newPostRef = doc(postsRef);
            const postId = newPostRef.id;

            // Main post data
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
                    trending: false
                }
            };

            // Create post with subcollections
            await setDoc(newPostRef, postDocument);

            // Create sources subcollection
            if (postData.sources?.length) {
                const sourcesRef = collection(db, `blogsAndArticles/${postId}/sources`);
                for (const source of postData.sources) {
                    const sourceDoc = doc(sourcesRef);
                    await setDoc(sourceDoc, {
                        ...source,
                        lastCheckedAt: serverTimestamp()
                    });
                }
            }

            // Create categories subcollection
            const categoryRef = doc(collection(db, `blogsAndArticles/${postId}/categories`), postData.categoryId);
            await setDoc(categoryRef, {
                name: postData.categoryId, // You might want to map this to actual name
                description: '',
                postCount: 1,
                slug: postData.categoryId.toLowerCase(),
                isActive: true
            });

            // Create tags subcollection
            if (postData.tags?.length) {
                const tagsRef = collection(db, `blogsAndArticles/${postId}/tags`);
                for (const tag of postData.tags) {
                    const tagDoc = doc(tagsRef);
                    await setDoc(tagDoc, {
                        name: tag,
                        slug: tag.toLowerCase(),
                        postCount: 1
                    });
                }
            }

            // Create engagement subcollection
            const engagementRef = doc(collection(db, `blogsAndArticles/${postId}/engagement`), 'metrics');
            await setDoc(engagementRef, {
                likesCount: 0,
                sharesCount: 0,
                commentsCount: 0,
                viewsCount: 0,
                readTimeAverage: postData.readTime || 0
            });

            return { id: postId };

        } catch (error) {
            console.error('Detailed error in createPost:', error);
            throw new Error('Failed to create post');
        }
    }

    public async getPosts(): Promise<BlogListItem[]> {
        try {
            const postsRef = collection(db, 'blogsAndArticles');
            const postsSnapshot = await getDocs(postsRef);
            
            const posts = await Promise.all(postsSnapshot.docs.map(async (doc) => {
                const postData = doc.data();
                
                // Get engagement metrics
                const engagementRef = collection(db, `blogsAndArticles/${doc.id}/engagement`);
                const engagementSnapshot = await getDocs(engagementRef);
                const engagement = engagementSnapshot.docs.map(doc => doc.data());
    
                // Get categories
                const categoryRef = collection(db, `blogsAndArticles/${doc.id}/categories`);
                const categorySnapshot = await getDocs(categoryRef);
                const categories = categorySnapshot.docs.map(cat => cat.data());
                
                // Get tags
                const tagsRef = collection(db, `blogsAndArticles/${doc.id}/tags`);
                const tagsSnapshot = await getDocs(tagsRef);
                const tags = tagsSnapshot.docs.map(tag => tag.data());
    
                const author = readRecord(postData.author);
                const normalizedEngagement = engagement.map((item) => ({ likesCount: readNumber(item.likesCount), commentsCount: readNumber(item.commentsCount) }));
                return {
                    id: doc.id,
                    title: readString(postData.title),
                    excerpt: readString(postData.excerpt) || readString(postData.description),
                    coverImage: readString(postData.coverImage) || readString(postData.imageUrl),
                    author: { id: readString(author.id) || readString(postData.userId), name: readString(author.name) || readString(postData.authorName, 'Ourlime user'), avatar: readString(author.avatar) },
                    category: readString(postData.category) || readString(categories[0]?.name),
                    categories: categories.map((item) => ({ name: readString(item.name) })).filter((item) => item.name),
                    tags: tags.map((item) => ({ name: readString(item.name) })).filter((item) => item.name),
                    readTime: readNumber(postData.readTime),
                    createdAt: postData.createdAt ?? postData.publishedDate ?? null,
                    publishedDate: readString(postData.publishedDate) || undefined,
                    likes: readNumber(postData.likes) || normalizedEngagement[0]?.likesCount || 0,
                    comments: readNumber(postData.comments) || normalizedEngagement[0]?.commentsCount || 0,
                    engagement: normalizedEngagement,
                };
            }));
    
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
    
    
}
