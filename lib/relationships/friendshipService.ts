import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import type { Friendship, FriendshipResponse, FriendshipStatus } from '@/lib/types/friendship';

export class FriendshipService {
    private static instance: FriendshipService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): FriendshipService {
        if (!FriendshipService.instance) {
            FriendshipService.instance = new FriendshipService();
        }
        return FriendshipService.instance;
    }

    async getFriendshipStatus(userId1: string, userId2: string): Promise<FriendshipResponse> {
        try {
            const friendsRef = collection(this.db, 'friendship');
            const q = query(
                friendsRef,
                where('userId1', 'in', [userId1, userId2]),
                where('userId2', 'in', [userId1, userId2])
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return {
                    success: true,
                    data: undefined
                };
            }

            const friendship = {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
            } as Friendship;

            return {
                success: true,
                data: friendship
            };
        } catch (error) {
            console.error('Error getting friendship status:', error);
            return {
                success: false,
                error: 'Failed to get friendship status'
            };
        }
    }

    async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendshipResponse> {
        try {
            const existingFriendship = await this.getFriendshipStatus(senderId, receiverId);
            if (existingFriendship.data) {
                return {
                    success: false,
                    error: 'Friendship already exists'
                };
            }
    
            const friendshipData = {
                userId1: senderId,
                userId2: receiverId,
                friendshipStatus: 'pending' as FriendshipStatus,
                typeOfFriendship: 'friend',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
    
            const docRef = await addDoc(collection(this.db, 'friendship'), friendshipData);
            
            const newFriendship: Friendship = {
                id: docRef.id,
                ...friendshipData
            };

            return {
                success: true,
                data: newFriendship
            };
        } catch (error) {
            console.error('Error sending friend request:', error);
            return {
                success: false,
                error: 'Failed to send friend request'
            };
        }
    }
    
    async updateFriendshipStatus(friendshipId: string, status: FriendshipStatus): Promise<FriendshipResponse> {
        try {
            const friendshipRef = doc(this.db, 'friendship', friendshipId);
            const friendshipDoc = await getDoc(friendshipRef);
            
            if (!friendshipDoc.exists()) {
                return {
                    success: false,
                    error: 'Friendship not found'
                };
            }
            
            const friendshipData = {
                id: friendshipDoc.id,
                ...friendshipDoc.data()
            } as Friendship;
            
            await updateDoc(friendshipRef, {
                friendshipStatus: status,
                updatedAt: serverTimestamp()
            });

            if (status === 'accepted') {
                try {
                    await notificationHelpers.createFriendAcceptedNotification(
                        friendshipData.userId1,
                        friendshipData.userId2
                    );
                } catch (notifError) {
                    console.error('Error creating friendship notification:', notifError);
                }
            }
            
            const updatedFriendship: Friendship = {
                ...friendshipData,
                friendshipStatus: status,
                updatedAt: serverTimestamp()
            };

            return {
                success: true,
                data: updatedFriendship
            };
        } catch (error) {
            console.error('Error updating friendship status:', error);
            return {
                success: false,
                error: 'Failed to update friendship status'
            };
        }
    }
    
    async getPendingRequests(userId: string): Promise<FriendshipResponse> {
        try {
            const friendsRef = collection(this.db, 'friendship');
            const q = query(
                friendsRef,
                where('userId2', '==', userId),
                where('friendshipStatus', '==', 'pending')
            );
            const snapshot = await getDocs(q);
            
            const pendingRequests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Friendship[];
    
            return {
                success: true,
                data: pendingRequests
            };
        } catch (error) {
            console.error('Error getting pending requests:', error);
            return {
                success: false,
                error: 'Failed to get pending requests'
            };
        }
    }
    
    async getFriendsList(userId: string): Promise<FriendshipResponse> {
        try {
            const friendsRef = collection(this.db, 'friendship');
            const q = query(
                friendsRef,
                where('friendshipStatus', '==', 'accepted')
            );
            const snapshot = await getDocs(q);
            
            const friends = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }) as Friendship)
                .filter(friendship =>
                    friendship.userId1 === userId || friendship.userId2 === userId
                );
    
            return {
                success: true,
                data: friends
            };
        } catch (error) {
            console.error('Error getting friends list:', error);
            return {
                success: false,
                error: 'Failed to get friends list'
            };
        }
    }

    async removeFriendship(friendshipId: string): Promise<FriendshipResponse> {
        try {
            await deleteDoc(doc(this.db, 'friendship', friendshipId));
            return {
                success: true
            };
        } catch (error) {
            console.error('Error removing friendship:', error);
            return {
                success: false,
                error: 'Failed to remove friendship'
            };
        }
    }

    async getMutualFriends(userId1: string, userId2: string): Promise<FriendshipResponse> {
        try {
            const user1Friends = await this.getFriendsList(userId1);
            const user2Friends = await this.getFriendsList(userId2);

            if (!user1Friends.success || !user2Friends.success || !user1Friends.data || !user2Friends.data) {
                return {
                    success: false,
                    error: 'Failed to get mutual friends'
                };
            }

            const user1FriendIds = (user1Friends.data as Friendship[]).map(f => 
                f.userId1 === userId1 ? f.userId2 : f.userId1
            );
            const user2FriendIds = (user2Friends.data as Friendship[]).map(f => 
                f.userId1 === userId2 ? f.userId2 : f.userId1
            );

            const mutualFriendIds = user1FriendIds.filter(id => user2FriendIds.includes(id));
            const mutualFriendships = (user1Friends.data as Friendship[])
                .filter(f => {
                    const friendId = f.userId1 === userId1 ? f.userId2 : f.userId1;
                    return mutualFriendIds.includes(friendId);
                });

            return {
                success: true,
                data: mutualFriendships
            };
        } catch (error) {
            console.error('Error getting mutual friends:', error);
            return {
                success: false,
                error: 'Failed to get mutual friends'
            };
        }
    }
}

export const friendshipService = FriendshipService.getInstance();
