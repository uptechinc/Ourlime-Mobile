import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, doc } from 'firebase/firestore';

type Follow = {
    id: string;
    followerId: string;
    followeeId: string;
    createdAt: unknown;
};

type FollowResponse = {
    success: boolean;
    data?: Follow | Follow[];
    error?: string;
};

export class FollowService {
    private static instance: FollowService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): FollowService {
        if (!FollowService.instance) {
            FollowService.instance = new FollowService();
        }
        return FollowService.instance;
    }

    async getFollowStatus(followerId: string, followeeId: string): Promise<FollowResponse> {
        try {
            const followsRef = collection(this.db, 'followers');
            const q = query(
                followsRef,
                where('followerId', '==', followerId),
                where('followeeId', '==', followeeId)
            );
            const snapshot = await getDocs(q);
            
            const follow = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Follow))[0];

            return {
                success: true,
                data: follow
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to get follow status'
            };
        }
    }

    async followUser(followerId: string, followeeId: string): Promise<FollowResponse> {
        try {
            const existingFollow = await this.getFollowStatus(followerId, followeeId);
            if (existingFollow.data) {
                return {
                    success: false,
                    error: 'Already following this user'
                };
            }

            const followData = {
                followerId,
                followeeId,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(this.db, 'followers'), followData);
            return {
                success: true,
                data: { id: docRef.id, ...followData } as Follow
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to follow user'
            };
        }
    }

    async unfollowUser(followerId: string, followeeId: string): Promise<FollowResponse> {
        try {
            const followsRef = collection(this.db, 'followers');
            const q = query(
                followsRef,
                where('followerId', '==', followerId),
                where('followeeId', '==', followeeId)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return {
                    success: false,
                    error: 'Not following this user'
                };
            }
    
            // Get the first matching document and delete it
            const followDoc = snapshot.docs[0];
            await deleteDoc(doc(this.db, 'followers', followDoc.id));
            
            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to unfollow user'
            };
        }
    }
    
    async getFollowers(userId: string): Promise<FollowResponse> {
        try {
            const followsRef = collection(this.db, 'followers');
            const q = query(followsRef, where('followeeId', '==', userId));
            const snapshot = await getDocs(q);
            
            const followers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Follow[];

            return {
                success: true,
                data: followers
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to get followers'
            };
        }
    }

    async getFollowing(userId: string): Promise<FollowResponse> {
        try {
            const followsRef = collection(this.db, 'followers');
            const q = query(followsRef, where('followerId', '==', userId));
            const snapshot = await getDocs(q);
            
            const following = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Follow[];

            return {
                success: true,
                data: following
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to get following list'
            };
        }
    }

    async getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
        try {
            const [followersResponse, followingResponse] = await Promise.all([
                this.getFollowers(userId),
                this.getFollowing(userId)
            ]);

            const followers = (followersResponse.data as Follow[])?.length || 0;
            const following = (followingResponse.data as Follow[])?.length || 0;

            return { followers, following };
        } catch (error) {
            return { followers: 0, following: 0 };
        }
    }
}

export const followService = FollowService.getInstance();
