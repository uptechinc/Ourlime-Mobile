import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

export class RelationshipQueries {
    private static instance: RelationshipQueries;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): RelationshipQueries {
        if (!RelationshipQueries.instance) {
            RelationshipQueries.instance = new RelationshipQueries();
        }
        return RelationshipQueries.instance;
    }

    async getUserProfileImage(userId: string) {
        const profileImagesQuery = query(
            collection(this.db, 'profileImages'),
            where('userId', '==', userId)
        );
        const profileSetAsQuery = query(
            collection(this.db, 'profileImageSetAs'),
            where('userId', '==', userId),
            where('setAs', '==', 'profile')
        );
        
        const [profileImagesSnapshot, setAsSnapshot] = await Promise.all([
            getDocs(profileImagesQuery),
            getDocs(profileSetAsQuery)
        ]);

        if (!setAsSnapshot.empty) {
            const setAsDoc = setAsSnapshot.docs[0].data();
            const matchingImage = profileImagesSnapshot.docs
                .find(img => img.id === setAsDoc.profileImageId);
            if (matchingImage) {
                return matchingImage.data().imageURL;
            }
        }
        return null;
    }

    async getCommonConnections(userId1: string, userId2: string) {
        const commonData = {
            mutualFriends: [],
            mutualFollowers: [],
            mutualFollowing: [],
            commonCommunities: [],
            commonEvents: []
        };
    
        // Get mutual friends
        const friendsRef = collection(this.db, 'friendships');
        const user1FriendsQuery = query(
            friendsRef,
            where('friendshipStatus', '==', 'accepted'),
            where('participants', 'array-contains', userId1)
        );
        const user2FriendsQuery = query(
            friendsRef,
            where('friendshipStatus', '==', 'accepted'),
            where('participants', 'array-contains', userId2)
        );
    
        // Get mutual followers
        const followersRef = collection(this.db, 'followers');
        const user1FollowersQuery = query(
            followersRef,
            where('followeeId', '==', userId1)
        );
        const user2FollowersQuery = query(
            followersRef,
            where('followeeId', '==', userId2)
        );
    
        try {
            const [
                user1Friends,
                user2Friends,
                user1Followers,
                user2Followers
            ] = await Promise.all([
                getDocs(user1FriendsQuery),
                getDocs(user2FriendsQuery),
                getDocs(user1FollowersQuery),
                getDocs(user2FollowersQuery)
            ]);
    
            // Process mutual friends
            const user1FriendIds = user1Friends.docs
                .map(doc => doc.data())
                .filter(friendship =>
                    friendship.userId1 === userId1 || friendship.userId2 === userId1)
                .map(friendship =>
                    friendship.userId1 === userId1 ? friendship.userId2 : friendship.userId1);
    
            const user2FriendIds = user2Friends.docs
                .map(doc => doc.data())
                .filter(friendship =>
                    friendship.userId1 === userId2 || friendship.userId2 === userId2)
                .map(friendship =>
                    friendship.userId1 === userId2 ? friendship.userId2 : friendship.userId1);
    
            const mutualFriendIds = user1FriendIds.filter(id =>
                user2FriendIds.includes(id));
    
            // Fetch mutual friends' profiles with images
            const mutualFriendsWithProfiles = await Promise.all(
                mutualFriendIds.map(async (friendId) => {
                    const userDoc = await getDoc(doc(this.db, 'users', friendId));
                    const userData = userDoc.data();
                    const profileImage = await this.getUserProfileImage(friendId);
                    
                    return {
                        id: friendId,
                        ...userData,
                        profileImage
                    };
                })
            );
    
            commonData.mutualFriends = mutualFriendsWithProfiles;
    
            // Process mutual followers
            const user1FollowerIds = user1Followers.docs
                .map(doc => doc.data().followerId);
            const user2FollowerIds = user2Followers.docs
                .map(doc => doc.data().followerId);
    
            const mutualFollowerIds = user1FollowerIds.filter(id =>
                user2FollowerIds.includes(id));
    
            // Fetch mutual followers' profiles with images
            const mutualFollowersWithProfiles = await Promise.all(
                mutualFollowerIds.map(async (followerId) => {
                    const userDoc = await getDoc(doc(this.db, 'users', followerId));
                    const userData = userDoc.data();
                    const profileImage = await this.getUserProfileImage(followerId);
                    
                    return {
                        id: followerId,
                        ...userData,
                        profileImage
                    };
                })
            );
    
            commonData.mutualFollowers = mutualFollowersWithProfiles;
    
            return {
                success: true,
                data: commonData
            };
    
        } catch (error) {
            return {
                success: false,
                error: 'Failed to get common connections'
            };
        }
    }
    
    async getUserNetworkStats(userId: string) {
        try {
            const friendsRef = collection(this.db, 'friendships');
            const followersRef = collection(this.db, 'followers');

            const [friendships, followers, following] = await Promise.all([
                getDocs(query(
                    friendsRef,
                    where('friendshipStatus', '==', true),
                    where('typeOfFriendship', '==', 'accepted')
                )),
                getDocs(query(followersRef, where('followeeId', '==', userId))),
                getDocs(query(followersRef, where('followerId', '==', userId)))
            ]);

            const friendsCount = friendships.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.userId1 === userId || data.userId2 === userId;
                }).length;

            return {
                success: true,
                data: {
                    friends: friendsCount,
                    followers: followers.size,
                    following: following.size
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'Failed to get network stats'
            };
        }
    }
}

export const relationshipQueries = RelationshipQueries.getInstance();
