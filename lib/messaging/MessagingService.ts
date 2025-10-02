import { db } from '@/lib/firebaseConfig';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    Timestamp,
    query,
    where,
    getDocs,
    writeBatch,
    onSnapshot
} from 'firebase/firestore';
import { MessageData, ChatRoom, ReplyReference } from '@/lib/types';

export class MessagingService {
    private static instance: MessagingService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MessagingService {
        if (!MessagingService.instance) {
            MessagingService.instance = new MessagingService();
        }
        return MessagingService.instance;
    }

    private getChatRoomId(userId1: string, userId2: string): string {
        return [userId1, userId2].sort().join('_');
    }

    /**
     * Send a message with optional reply reference
     */
    public async sendMessage(
        receiverId: string, 
        message: string, 
        senderId: string, 
        replyTo?: ReplyReference
    ) {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(db, 'chats', chatRoomId);

        const messageData: MessageData = {
            senderId,
            receiverId,
            message,
            status: 'sent',
            timestamp: Timestamp.now(),
            ...(replyTo && { replyTo })
        };

        const chatDoc = await getDoc(chatRef);
        
        if (!chatDoc.exists()) {
            const chatRoom: ChatRoom = {
                participants: [senderId, receiverId],
                lastMessageTime: messageData.timestamp,
                messages: [messageData],
                unreadCount: 1,
                lastMessage: message
            };
            await setDoc(chatRef, chatRoom);
        } else {
            const currentData = chatDoc.data();
            await updateDoc(chatRef, {
                messages: arrayUnion(messageData),
                lastMessageTime: messageData.timestamp,
                unreadCount: (currentData.unreadCount || 0) + 1,
                lastMessage: message
            });
        }

        return {
            id: chatRoomId,
            ...messageData
        };
    }

    /**
     * Mark messages as read
     */
    public async markMessagesAsRead(receiverId: string, senderId: string) {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(this.db, 'chats', chatRoomId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) return;

        const chatData = chatDoc.data();
        const updatedMessages = chatData.messages.map(msg => {
            if (msg.receiverId === senderId && msg.status !== 'read') {
                return { ...msg, status: 'read' };
            }
            return msg;
        });

        await updateDoc(chatRef, { 
            messages: updatedMessages,
            unreadCount: 0 // Reset unread count when messages are read
        });
    }

    /**
     * Get all messages for a chat
     */
    public async getMessages(receiverId: string, senderId: string) {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(db, 'chats', chatRoomId);
                
        const chatDoc = await getDoc(chatRef);
        
        if (!chatDoc.exists()) {
            return [];
        }
    
        const chatData = chatDoc.data();
        console.log('Chat data:', chatData);
    
        const updatedMessages = chatData.messages.map(msg => {
            if (msg.receiverId === senderId && msg.status === 'sent') {
                return { ...msg, status: 'delivered' };
            }
            return msg;
        });

        if (JSON.stringify(updatedMessages) !== JSON.stringify(chatData.messages)) {
            await updateDoc(chatRef, { messages: updatedMessages });
        }
    
        return updatedMessages;
    }

    /**
     * Get unread message count
     */
    public async getUnreadCount(userId: string, friendId: string): Promise<number> {
        const chatRoomId = this.getChatRoomId(userId, friendId);
        const chatRef = doc(this.db, 'chats', chatRoomId);
        const chatDoc = await getDoc(chatRef);
        
        if (!chatDoc.exists()) return 0;
        return chatDoc.data().unreadCount || 0;
    }

    /**
     * Subscribe to real-time message updates
     */
    public subscribeToMessages(
        receiverId: string,
        senderId: string,
        callback: (messages: any[]) => void
    ): () => void {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(this.db, 'chats', chatRoomId);

        return onSnapshot(chatRef, (doc) => {
            if (doc.exists()) {
                const chatData = doc.data();
                callback(chatData.messages || []);
            } else {
                callback([]);
            }
        });
    }

    /**
     * Delete a message from the chat
     */
    public async deleteMessage(receiverId: string, senderId: string, messageTimestamp: number): Promise<boolean> {
        try {
            const chatRoomId = this.getChatRoomId(senderId, receiverId);
            const chatRef = doc(this.db, 'chats', chatRoomId);
            const chatDoc = await getDoc(chatRef);

            if (!chatDoc.exists()) {
                return false;
            }

            const chatData = chatDoc.data();
            const updatedMessages = chatData.messages.filter(
                (msg: MessageData) => msg.timestamp.seconds !== messageTimestamp
            );

            await updateDoc(chatRef, {
                messages: updatedMessages,
                lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].message : '',
                lastMessageTime: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].timestamp : Timestamp.now()
            });

            return true;
        } catch (error) {
            console.error('Error deleting message:', error);
            return false;
        }
    }
}
