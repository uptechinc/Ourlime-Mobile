import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, writeBatch, serverTimestamp, doc, increment } from 'firebase/firestore';

interface LikeResponse {
    success: boolean;
    data?: {
        likeCount: number;
        likedUsers: any[];
    };
    error?: string;
}

export class LikeService {
    private static instance: LikeService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): LikeService {
        if (!LikeService.instance) {
            LikeService.instance = new LikeService();
        }
        return LikeService.instance;
    }

    async toggleLike(postId: string, userId: string, currentLikeState: boolean): Promise<LikeResponse> {
        try {
            const batch = writeBatch(this.db);
            const likesRef = collection(this.db, 'feedsPostLikeCount');
            const userLikeQuery = query(
                likesRef,
                where('feedsPostId', '==', postId),
                where('userId', '==', userId)
            );
            const snapshot = await getDocs(userLikeQuery);

            if (!currentLikeState) {
                const newLikeRef = doc(likesRef);
                batch.set(newLikeRef, {
                    feedsPostId: postId,
                    userId: userId,
                    likes: true,
                    timestamp: serverTimestamp()
                });
            } else {
                batch.delete(snapshot.docs[0].ref);
            }

            const likesCountRef = collection(this.db, 'likesCount');
            const countQuery = query(likesCountRef, where('feedsPostId', '==', postId));
            const countSnapshot = await getDocs(countQuery);

            let newLikeCount = 0;

            if (countSnapshot.empty) {
                const newCountRef = doc(likesCountRef);
                newLikeCount = 1;
                batch.set(newCountRef, {
                    feedsPostId: postId,
                    likeCount: newLikeCount,
                    commentCount: 0,
                    shareCount: 0
                });
            } else {
                const countDoc = countSnapshot.docs[0];
                newLikeCount = countDoc.data().likeCount + (currentLikeState ? -1 : 1);
                batch.update(countDoc.ref, {
                    likeCount: increment(currentLikeState ? -1 : 1)
                });
            }

            await batch.commit();

            return {
                success: true,
                data: {
                    likeCount: newLikeCount,
                    likedUsers: [] // You can fetch and return updated likedUsers here if needed
                }
            };
        } catch (error) {
            return { success: false, error: 'Failed to process like' };
        }
    }
}

export const likeService = LikeService.getInstance();
