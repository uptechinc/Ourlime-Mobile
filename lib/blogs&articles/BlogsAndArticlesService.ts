import { db } from '@/lib/firebaseConfig';
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

    public async getPosts() {
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
    
                return {
                    id: doc.id,
                    ...postData,
                    engagement,
                    categories,
                    tags
                };
            }));
    
            return posts;
        } catch (error) {
            console.error('Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }
    }
    
    
}
