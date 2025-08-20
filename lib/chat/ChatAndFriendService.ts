import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    onSnapshot
} from 'firebase/firestore';
import { useProfileStore } from '@/src/store/useProfileStore';

interface FriendshipData {
    userId1: string;
    userId2: string;
    friendshipStatus: string;
}

export class ChatService {
    private static instance: ChatService;
    private readonly db;
    private store;

    private constructor() {
        this.db = db;
        this.store = useProfileStore.getState();
        
        // Subscribe to store changes
        useProfileStore.subscribe(
            (state) => {
                this.store = state;
            }
        );
    }

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    private async getRegularFriends() {
        const currentUserId = this.store.id;
        const currentUserData = this.store;
        if (!currentUserId) throw new Error('User not authenticated');

        const friendshipQuery1 = query(
            collection(this.db, 'friendship'),
            where('userId1', '==', currentUserId),
            where('friendshipStatus', '==', 'accepted')
        );

        const friendshipQuery2 = query(
            collection(this.db, 'friendship'),
            where('userId2', '==', currentUserId),
            where('friendshipStatus', '==', 'accepted')
        );

        const [snapshot1, snapshot2] = await Promise.all([
            getDocs(friendshipQuery1),
            getDocs(friendshipQuery2)
        ]);

        const friendIds = new Set([
            ...snapshot1.docs.map(doc => doc.data().userId2),
            ...snapshot2.docs.map(doc => doc.data().userId1)
        ]);

        const friendsData = await Promise.all(
            Array.from(friendIds).map(async (friendId) => {
                if (friendId === currentUserData.id) {
                    return {
                        id: friendId,
                        firstName: currentUserData.firstName,
                        lastName: currentUserData.lastName,
                        userName: currentUserData.userName,
                        profileImage: currentUserData.profileImage?.imageURL,
                        unreadCount: 0,
                        isBusinessInquiry: false
                    };
                }

                const [userDoc, profileSetAs, chatDoc] = await Promise.all([
                    getDoc(doc(this.db, 'users', friendId)),
                    getDocs(query(
                        collection(this.db, 'profileImageSetAs'),
                        where('userId', '==', friendId),
                        where('setAs', '==', 'profile')
                    )),
                    getDoc(doc(this.db, 'chats', [currentUserId, friendId].sort().join('_')))
                ]);

                if (!userDoc.exists()) return null;

                let profileImage = null;
                if (!profileSetAs.empty) {
                    const setAsDoc = profileSetAs.docs[0].data();
                    const profileImageDoc = await getDoc(doc(this.db, 'profileImages', setAsDoc.profileImageId));
                    
                    if (profileImageDoc.exists()) {
                        profileImage = profileImageDoc.data().imageURL;
                    }
                }

                let unreadCount = 0;
                let lastMessage = '';
                let lastMessageTime = null;

                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    unreadCount = chatData.messages.filter(msg =>
                        msg.receiverId === currentUserId &&
                        msg.status === 'sent'
                    ).length;
                    
                    const lastMsg = chatData.messages[chatData.messages.length - 1];
                    lastMessage = lastMsg?.message || '';
                    lastMessageTime = lastMsg?.timestamp || null;
                }

                const userData = userDoc.data();
                return {
                    id: friendId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    userName: userData.userName,
                    profileImage,
                    unreadCount,
                    lastMessage,
                    lastMessageTime,
                    isBusinessInquiry: false
                };
            })
        );

        return friendsData.filter(friend => friend !== null);
    }

    private async getTempChats() {
        const currentUserId = this.store.id;
        if (!currentUserId) throw new Error('User not authenticated');

        const tempChatsQuery = query(
            collection(this.db, 'tempChats'),
            where('participants', 'array-contains', currentUserId)
        );

        const tempChatsSnapshot = await getDocs(tempChatsQuery);
        const tempChatsData = await Promise.all(
            tempChatsSnapshot.docs.map(async (chatDoc) => {
                const chatData = chatDoc.data();
                const otherUserId = chatData.participants.find(id => id !== currentUserId);

                const userDoc = await getDoc(doc(this.db, 'users', otherUserId));
                if (!userDoc.exists()) return null;

                const userData = userDoc.data();
                const profileSetAs = await getDocs(query(
                    collection(this.db, 'profileImageSetAs'),
                    where('userId', '==', otherUserId),
                    where('setAs', '==', 'profile')
                ));

                let profileImage = null;
                if (!profileSetAs.empty) {
                    const setAsDoc = profileSetAs.docs[0].data();
                    const profileImageDoc = await getDoc(doc(this.db, 'profileImages', setAsDoc.profileImageId));
                    if (profileImageDoc.exists()) {
                        profileImage = profileImageDoc.data().imageURL;
                    }
                }

                return {
                    id: otherUserId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    userName: userData.userName,
                    profileImage,
                    unreadCount: chatData.unreadCount || 0,
                    lastMessage: chatData.lastMessage || '',
                    lastMessageTime: chatData.lastMessageTime || null,
                    isBusinessInquiry: true,
                    productTitle: chatData.productTitle,
                    productId: chatData.productId
                };
            })
        );

        return tempChatsData.filter(chat => chat !== null);
    }

    public async getFriends() {
        // Check authentication before proceeding
        if (!this.store.id) {
            return [];
        }

        try {
            const [regularFriends, tempChats] = await Promise.all([
                this.getRegularFriends(),
                this.getTempChats()
            ]);

            return [...regularFriends, ...tempChats];
        } catch (error) {
            console.error('Error fetching friends:', error);
            // Return empty array instead of throwing to prevent continuous error logging
            return [];
        }
    }

    public subscribeToMessages(
        receiverId: string,
        senderId: string,
        isBusinessInquiry: boolean,
        callback: (messages: any[]) => void
    ): () => void {
        if (isBusinessInquiry) {
            const tempChatRef = doc(this.db, 'tempChats', [senderId, receiverId].sort().join('_'));
            return onSnapshot(tempChatRef, (doc) => {
                if (doc.exists()) {
                    const chatData = doc.data();
                    callback(chatData.messages || []);
                } else {
                    callback([]);
                }
            });
        } else {
            const chatRef = doc(this.db, 'chats', [senderId, receiverId].sort().join('_'));
            return onSnapshot(chatRef, (doc) => {
                if (doc.exists()) {
                    const chatData = doc.data();
                    callback(chatData.messages || []);
                } else {
                    callback([]);
                }
            });
        }
    }
    
}
