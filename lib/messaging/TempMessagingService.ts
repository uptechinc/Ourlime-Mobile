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
    onSnapshot
} from 'firebase/firestore';

interface TempMessageData {
    senderId: string;
    receiverId: string;
    message: string;
    timestamp: Timestamp;
    status: 'sent' | 'delivered' | 'read';
}

interface TempChatRoom {
    participants: string[];
    lastMessageTime: Timestamp;
    messages: TempMessageData[];
    lastMessage: string;
    productContext: {
        productId: string;
        productTitle: string;
        productImage: string;
        colorVariant: string | null;
        sizeVariant: string | null;
        price: string | null;
    };
}

interface TempChatRoomWithId extends TempChatRoom {
    id: string;
}

export class TempMessagingService {
    private static instance: TempMessagingService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): TempMessagingService {
        if (!TempMessagingService.instance) {
            TempMessagingService.instance = new TempMessagingService();
        }
        return TempMessagingService.instance;
    }

    public async sendMessage(
        receiverId: string,
        message: string,
        senderId: string,
        productContext: {
            productTitle: string;
            productImage: string;
            colorVariant: string | null;
            sizeVariant: string | null;
            price: string | null;
        }
    ) {
        const chatRef = doc(this.db, 'tempChats', receiverId);

        const messageData: TempMessageData = {
            senderId,
            receiverId,
            message,
            timestamp: Timestamp.now(),
            status: 'sent'
        };

        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            const chatRoom: TempChatRoom = {
                participants: [senderId, receiverId],
                lastMessageTime: messageData.timestamp,
                messages: [messageData],
                lastMessage: message,
                productContext: {
                    productId: 'general',
                    ...productContext
                }
            };
            await setDoc(chatRef, chatRoom);
        } else {
            await updateDoc(chatRef, {
                messages: arrayUnion(messageData),
                lastMessageTime: messageData.timestamp,
                lastMessage: message
            });
        }

        return messageData;
    }

    public subscribeToMessages(
        receiverId: string,
        senderId: string,
        callback: (messages: TempMessageData[]) => void
    ): () => void {
        const chatRef = doc(this.db, 'tempChats', receiverId);

        return onSnapshot(chatRef, (doc) => {
            if (doc.exists()) {
                const chatData = doc.data() as TempChatRoom;
                callback(chatData.messages || []);
            }
        });
    }

    public async getTempChats(userId: string): Promise<TempChatRoomWithId[]> {
        const chatsQuery = query(
            collection(this.db, 'tempChats'),
            where('participants', 'array-contains', userId)
        );

        const snapshot = await getDocs(chatsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as TempChatRoom
        }));
    }

    public async markMessagesAsRead(chatRoomId: string, userId: string): Promise<void> {
        const chatRef = doc(this.db, 'tempChats', chatRoomId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) return;

        const chatData = chatDoc.data() as TempChatRoom;
        const updatedMessages = chatData.messages.map(msg => {
            if (msg.receiverId === userId && msg.status !== 'read') {
                return { ...msg, status: 'read' };
            }
            return msg;
        });

        await updateDoc(chatRef, {
            messages: updatedMessages
        });
    }

    public async getMessages(receiverId: string): Promise<TempChatRoom> {
        const chatRef = doc(this.db, 'tempChats', receiverId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            return {
                participants: [],
                lastMessageTime: Timestamp.now(),
                messages: [],
                lastMessage: '',
                productContext: {
                    productId: '',
                    productTitle: '',
                    productImage: '',
                    colorVariant: null,
                    sizeVariant: null,
                    price: null
                }
            };
        }

        return chatDoc.data() as TempChatRoom;
    }
}

export const tempMessagingService = TempMessagingService.getInstance();
