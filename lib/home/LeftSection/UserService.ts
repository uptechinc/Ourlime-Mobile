import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, where, Firestore } from 'firebase/firestore';

export class UserService {
    private static instance: UserService;
    private readonly db: Firestore;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    public async fetchAllUsers() {
        try {
            const [
                usersSnapshot,
                profileImagesSnapshot,
                profileSetAsSnapshot
            ] = await Promise.all([
                getDocs(collection(this.db, 'users')),
                getDocs(collection(this.db, 'profileImages')),
                getDocs(collection(this.db, 'profileImageSetAs'))
            ]);

            const users = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const profileImages = profileImagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const profileSetAs = profileSetAsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return { users, profileImages, profileSetAs };
        } catch (error) {
            console.error('User service error:', error);
            throw new Error('Failed to fetch users data');
        }
    }

    public async getFriendships(userId: string) {
        try {
            const friendshipQuery = query(
                collection(this.db, 'friendship'),
                where('friendshipStatus', '==', 'accepted')
            );
            const snapshot = await getDocs(friendshipQuery);
            
            return snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.userId1 === userId || data.userId2 === userId;
                })
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
        } catch (error) {
            console.error('Friendship service error:', error);
            throw new Error('Failed to fetch friendships');
        }
    }
    
    public async getFollowers(userId: string) {
        try {
            const [followersQuery, followingQuery] = await Promise.all([
                getDocs(query(
                    collection(this.db, 'followers'),
                    where('followeeId', '==', userId)
                )),
                getDocs(query(
                    collection(this.db, 'followers'),
                    where('followerId', '==', userId)
                ))
            ]);
    
            return {
                followers: followersQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })),
                following: followingQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
            };
        } catch (error) {
            console.error('Followers service error:', error);
            throw new Error('Failed to fetch followers');
        }
    }
    
    /**
     * Returns the actual number of posts for a user by counting documents in feedPosts.
     * @param userId - The user's ID
     * @returns The number of posts
     */
    public async getPostsCount(userId: string): Promise<number> {
        try {
            const postsQuery = query(collection(this.db, 'feedPosts'), where('userId', '==', userId));
            const snapshot = await getDocs(postsQuery);
            return snapshot.size;
        } catch (error) {
            console.error('Error fetching posts count:', error);
            return 0;
        }
    }
}
