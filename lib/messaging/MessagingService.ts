import { db, storage } from '@/lib/firebaseConfig';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    Timestamp,
    onSnapshot
    ,getDocs,
    query,
    where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { readAsStringAsync, EncodingType, getInfoAsync } from 'expo-file-system/legacy';
import type { CallEventMessage } from '@/lib/types/call';
import type { MessageData, ChatRoom, ReplyReference } from '@/lib/types/message';
import type { UserProfile } from '@/lib/services/AuthService';
import { ApiService } from '@/lib/services/ApiService';

export type ConversationEntry = UserProfile & {
    lastMessage?: string;
    lastMessageTime?: Timestamp;
    unreadCount: number;
    isOnline: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
    isMuted?: boolean;
    mutedUntil?: number | null;
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown, fallback = ''): string =>
    typeof value === 'string' ? value : fallback;

// Extended types for full parity with web MessagingService
export type Attachment = {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
};

export type StickerData = {
    type: 'sticker';
    stickerId: string;
    stickerUrl: string;
    packId: string;
    stickerWidth: number;
    stickerHeight: number;
};

export type VoiceNoteData = {
    type: 'voiceNote';
    audioUrl: string;
    audioDuration: number;
};

export type FullMessage = MessageData & {
    id?: string;
    attachment?: Attachment;
    stickerData?: StickerData;
    voiceNoteData?: VoiceNoteData;
    isForwarded?: boolean;
    reactions?: Record<string, string[]>;
    deletedFor?: string[];
    isDeletedForEveryone?: boolean;
    type?: 'text' | 'sticker' | 'voiceNote';
    stickerId?: string;
    stickerUrl?: string;
    packId?: string;
    stickerWidth?: number;
    stickerHeight?: number;
    audioUrl?: string;
    audioDuration?: number;
    callEvent?: CallEventMessage;
};

/**
 * Convert a base64 string to a Uint8Array (avoids all Blob issues in React Native)
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export class MessagingService {
    private static instance: MessagingService;
    private readonly db;
    private readonly apiService = ApiService.getInstance();

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MessagingService {
        if (!MessagingService.instance) {
            MessagingService.instance = new MessagingService();
        }
        return MessagingService.instance;
    }

    public getChatRoomId(userId1: string, userId2: string): string {
        return [userId1, userId2].sort().join('_');
    }

    public async fetchConversations(currentUserId: string): Promise<ConversationEntry[]> {
        return (await this.fetchConversationPage(currentUserId, null)).items;
    }

    public async fetchConversationPage(currentUserId: string, cursor: string | null): Promise<{ items: ConversationEntry[]; nextCursor: string | null }> {
        if (!currentUserId) return { items: [], nextCursor: null };
        const entries: ConversationEntry[] = [];
        try {
            const search = new URLSearchParams({ limit: '20' });
            if (cursor) search.set('cursor', cursor);
            const response = await this.apiService.request<{ success: boolean; data?: { items?: unknown[]; nextCursor?: string | null }; error?: string }>(`/api/chat/friends?${search.toString()}`, { authenticated: true });
            if (!response.success) throw new Error(response.error || 'Failed to load conversations');
            for (const value of response.data?.items ?? []) {
                if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
                const record = value as Record<string, unknown>;
                const id = typeof record.id === 'string' ? record.id : '';
                if (!id) continue;
                const timeRecord = record.lastMessageTime && typeof record.lastMessageTime === 'object' ? record.lastMessageTime as Record<string, unknown> : {};
                const seconds = typeof timeRecord.seconds === 'number' ? timeRecord.seconds : 0;
                const nanoseconds = typeof timeRecord.nanoseconds === 'number' ? timeRecord.nanoseconds : 0;
                entries.push({
                    uid: id,
                    firstName: typeof record.firstName === 'string' ? record.firstName : 'User',
                    lastName: typeof record.lastName === 'string' ? record.lastName : '',
                    userName: typeof record.userName === 'string' ? record.userName : 'user',
                    email: '',
                    accountType: 'user',
                    profilePicture: typeof record.profileImage === 'string' ? record.profileImage : null,
                    lastMessage: typeof record.lastMessage === 'string' ? record.lastMessage : undefined,
                    lastMessageTime: seconds > 0 ? new Timestamp(seconds, nanoseconds) : undefined,
                    unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
                    isOnline: record.isOnline === true,
                });
            }
            return { items: entries, nextCursor: response.data?.nextCursor ?? null };
        } catch {
            return this.fetchConversationPageFromFirestore(currentUserId);
        }
    }

    private async fetchConversationPageFromFirestore(currentUserId: string): Promise<{ items: ConversationEntry[]; nextCursor: string | null }> {
        const [asFirst, asSecond] = await Promise.all([
            getDocs(query(collection(this.db, 'friendship'), where('userId1', '==', currentUserId))),
            getDocs(query(collection(this.db, 'friendship'), where('userId2', '==', currentUserId))),
        ]);
        const friendIds = new Set<string>();
        asFirst.docs.forEach((document) => {
            const relationship = document.data();
            const status = readString(relationship.friendshipStatus, readString(relationship.status));
            const friendId = readString(relationship.userId2);
            if (status === 'accepted' && friendId) friendIds.add(friendId);
        });
        asSecond.docs.forEach((document) => {
            const relationship = document.data();
            const status = readString(relationship.friendshipStatus, readString(relationship.status));
            const friendId = readString(relationship.userId1);
            if (status === 'accepted' && friendId) friendIds.add(friendId);
        });

        const conversations = await Promise.all([...friendIds].slice(0, 20).map(async (friendId): Promise<ConversationEntry | null> => {
            const [userDocument, imageSelections, chatDocument] = await Promise.all([
                getDoc(doc(this.db, 'users', friendId)),
                getDocs(query(collection(this.db, 'profileImageSetAs'), where('userId', '==', friendId))),
                getDoc(doc(this.db, 'chats', this.getChatRoomId(currentUserId, friendId))),
            ]);
            if (!userDocument.exists()) return null;
            const user = userDocument.data();
            const preferredSelection = imageSelections.docs.find((document) => document.data().setAs === 'profile')
                ?? imageSelections.docs.find((document) => document.data().setAs === 'postProfile');
            const selectedImageId = preferredSelection ? readString(preferredSelection.data().profileImageId) : '';
            const selectedImage = selectedImageId ? await getDoc(doc(this.db, 'profileImages', selectedImageId)) : null;
            const selectedImageData = selectedImage?.data();
            const directProfileImage = isRecord(user.profileImage)
                ? readString(user.profileImage.imageURL, readString(user.profileImage.imageUrl))
                : readString(user.profileImage);
            const profilePicture = readString(selectedImageData?.imageURL)
                || readString(selectedImageData?.imageUrl)
                || readString(user.profilePicture)
                || directProfileImage
                || readString(user.avatar)
                || readString(user.photoURL)
                || null;

            const chat = chatDocument.exists() ? chatDocument.data() : {};
            const messages = Array.isArray(chat.messages) ? chat.messages.filter(isRecord) : [];
            const clearedAt = isRecord(chat.clearedAt) && chat.clearedAt[currentUserId] instanceof Timestamp
                ? chat.clearedAt[currentUserId] as Timestamp
                : null;
            const visibleMessages = clearedAt
                ? messages.filter((message) => message.timestamp instanceof Timestamp && message.timestamp.toMillis() > clearedAt.toMillis())
                : messages;
            const lastMessageRecord = visibleMessages.at(-1);
            const lastMessageTime = lastMessageRecord?.timestamp instanceof Timestamp ? lastMessageRecord.timestamp : undefined;
            const unreadCount = visibleMessages.filter((message) =>
                readString(message.receiverId) === currentUserId && readString(message.status) === 'sent'
            ).length;

            return {
                uid: friendId,
                firstName: readString(user.firstName, 'User'),
                lastName: readString(user.lastName),
                userName: readString(user.userName, 'user'),
                email: readString(user.email),
                accountType: readString(user.accountType, 'user'),
                profilePicture,
                lastMessage: lastMessageRecord ? readString(lastMessageRecord.message) : undefined,
                lastMessageTime,
                unreadCount,
                isOnline: user.isOnline === true,
            };
        }));

        return {
            items: conversations
                .filter((conversation): conversation is ConversationEntry => conversation !== null)
                .sort((left, right) => (right.lastMessageTime?.toMillis() ?? 0) - (left.lastMessageTime?.toMillis() ?? 0)),
            nextCursor: null,
        };
    }

    public async getMuteUntil(currentUserId: string, friendId: string): Promise<number | null> {
        const snapshot = await getDoc(doc(this.db, 'users', currentUserId, 'chatMuteSettings', friendId));
        const value = snapshot.exists() ? snapshot.data().mutedUntil : null;
        return typeof value === 'number' && value > Date.now() ? value : null;
    }

    public async setMuteUntil(currentUserId: string, friendId: string, mutedUntil: number | null): Promise<void> {
        await setDoc(doc(this.db, 'users', currentUserId, 'chatMuteSettings', friendId), { mutedUntil });
    }

    /**
     * Upload a file (image/video/doc/voice note) to Firebase Storage
    /**
     * Converts a local file://, content://, or ph:// URI to a native Blob via XMLHttpRequest.
     * In React Native, XMLHttpRequest natively reads local file URIs and produces a native Blob
     * backed by C++/Java memory that Firebase JS SDK uploadBytes can consume directly.
     */
    private async uriToBlob(uri: string): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => {
                resolve(xhr.response as Blob);
            };
            xhr.onerror = (e) => {
                console.error('[uriToBlob] XHR Error', e);
                reject(new TypeError(`Network request failed for URI: ${uri}`));
            };
            xhr.responseType = 'blob';
            xhr.open('GET', uri, true);
            xhr.send(null);
        });
    }

    /**
     * Uploads a local file to Firebase Storage.
     * Uses XMLHttpRequest to safely convert the local file URI into a native RN Blob,
     * avoiding fetch() 404s and Hermes base64/ArrayBuffer Blob construction bugs.
     */
    public async uploadFile(
        uri: string,
        fileName: string,
        mimeType: string,
        userId: string
    ): Promise<Attachment> {
        const timestamp = Date.now();
        const storagePath = `chats/${userId}/${timestamp}_${fileName}`;
        const storageRef = ref(storage, storagePath);

        console.log('[uploadFile] START', { uri, fileName, mimeType, userId, storagePath });

        let blob: Blob | null = null;
        let fileSize = 0;

        try {
            console.log('[uploadFile] Converting URI to native Blob via XHR...');
            blob = await this.uriToBlob(uri);
            fileSize = blob.size;
            console.log('[uploadFile] Native Blob created', { size: blob.size, type: blob.type });

            console.log('[uploadFile] Uploading to Firebase Storage via uploadBytes...');
            await uploadBytes(storageRef, blob, { contentType: mimeType });
            console.log('[uploadFile] uploadBytes completed successfully');
        } catch (xhrError) {
            console.warn('[uploadFile] XHR Blob upload failed, attempting fallback to base64 Uint8Array:', xhrError);
            // Fallback: Read base64 via FileSystem and convert to Uint8Array
            const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
            const uint8Array = base64ToUint8Array(base64);
            fileSize = uint8Array.byteLength;
            await uploadBytes(storageRef, uint8Array, { contentType: mimeType });
        } finally {
            // Clean up native Blob memory if close() method exists
            const closeableBlob = blob as Blob & { close?: () => void };
            if (typeof closeableBlob.close === 'function') {
                try {
                    closeableBlob.close();
                } catch {}
            }
        }

        console.log('[uploadFile] Getting download URL...');
        const url = await getDownloadURL(storageRef);
        console.log('[uploadFile] Download URL obtained:', url);

        const attachment: Attachment = {
            url,
            fileName,
            fileType: mimeType,
            fileSize,
        };
        console.log('[uploadFile] SUCCESS', attachment);
        return attachment;
    }

    /**
     * Send a message with optional reply, attachment, sticker, or voice note
     */
    public async sendMessage(
        receiverId: string,
        message: string,
        senderId: string,
        replyTo?: ReplyReference,
        attachment?: Attachment,
        stickerData?: StickerData,
        voiceNoteData?: VoiceNoteData,
        isForwarded?: boolean
    ): Promise<FullMessage> {
        const response = await this.apiService.request<{ status: 'success'; data: unknown } | { status: 'error'; message: string }>('/api/messaging', {
            authenticated: true,
            method: 'POST',
            body: { receiverId, message, replyTo, attachment, stickerData, voiceNoteData, isForwarded },
        });
        if (response.status !== 'success') throw new Error(response.message);
        const serverMessage = this.normalizeMessage(response.data);
        if (!serverMessage) throw new Error('The messaging server returned an invalid message.');

        return serverMessage;

        /* Legacy direct-write implementation remains below only as a temporary
         * compatibility reference and is unreachable. It will be removed when
         * all released clients use the authenticated server contract. */
        {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(db, 'chats', chatRoomId);

        let stickerFields = null;
        if (stickerData) {
            const sd = stickerData as StickerData;
            stickerFields = {
                type: 'sticker' as const,
                stickerId: sd.stickerId,
                stickerUrl: sd.stickerUrl,
                packId: sd.packId,
                stickerWidth: sd.stickerWidth,
                stickerHeight: sd.stickerHeight,
            };
        }

        const messageData: FullMessage = {
            senderId,
            receiverId,
            message,
            status: 'sent',
            timestamp: Timestamp.now(),
            ...(replyTo && { replyTo }),
            ...(attachment && { attachment }),
            ...(stickerFields ?? {}),
            ...(voiceNoteData && { voiceNoteData }),
            ...(isForwarded && { isForwarded }),
        };

        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            const chatRoom: ChatRoom = {
                participants: [senderId, receiverId],
                lastMessageTime: messageData.timestamp,
                messages: [messageData as MessageData],
                unreadCount: 1,
                lastMessage: message,
            };
            await setDoc(chatRef, chatRoom);
        } else {
            const currentData = chatDoc.data() ?? {};
            await updateDoc(chatRef, {
                messages: arrayUnion(messageData),
                lastMessageTime: messageData.timestamp,
                unreadCount: (currentData.unreadCount || 0) + 1,
                lastMessage: message || (stickerData ? '🎨 Sticker' : voiceNoteData ? '🎤 Voice note' : attachment?.fileName || 'Attachment'),
            });
        }

        return messageData;
        }
    }

    public normalizeMessage(value: unknown): FullMessage | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const record = value as Record<string, unknown>;
        const rawTimestamp = record.timestamp;
        const timestampRecord = rawTimestamp && typeof rawTimestamp === 'object' ? rawTimestamp as Record<string, unknown> : {};
        const timestamp = rawTimestamp instanceof Timestamp
            ? rawTimestamp
            : new Timestamp(typeof timestampRecord.seconds === 'number' ? timestampRecord.seconds : 0, typeof timestampRecord.nanoseconds === 'number' ? timestampRecord.nanoseconds : 0);
        if (typeof record.senderId !== 'string' || typeof record.receiverId !== 'string' || typeof record.message !== 'string' || timestamp.seconds <= 0) return null;
        const normalizedId = typeof record.id === 'string' && record.id.trim() ? record.id : undefined;
        const normalizedMessage = {
            ...record,
            id: normalizedId,
            senderId: record.senderId,
            receiverId: record.receiverId,
            message: record.message,
            timestamp,
            status: record.status === 'read' || record.status === 'delivered' ? record.status : 'sent',
        } as FullMessage;
        return normalizedMessage.id
            ? normalizedMessage
            : { ...normalizedMessage, id: this.getMessageIdentity(normalizedMessage) };
    }

    public getMessageIdentity(message: FullMessage): string {
        if (message.id) return message.id;
        return this.getMessageFingerprint(message);
    }

    public getMessageFingerprint(message: FullMessage): string {
        const attachmentIdentity = message.attachment
            ? `${message.attachment.fileType}:${message.attachment.fileName}:${message.attachment.url}`
            : '';
        const stickerIdentity = message.stickerData?.stickerId
            ?? message.stickerId
            ?? message.stickerData?.stickerUrl
            ?? message.stickerUrl
            ?? '';
        const voiceIdentity = message.voiceNoteData?.audioUrl ?? message.audioUrl ?? '';
        return [
            'legacy',
            message.senderId,
            message.receiverId,
            message.timestamp.seconds,
            message.timestamp.nanoseconds,
            message.type ?? 'text',
            message.message,
            attachmentIdentity,
            stickerIdentity,
            voiceIdentity,
        ].join(':');
    }

    public async getArchiveStatus(userId: string, peerId: string): Promise<boolean> {
        try {
            const summaryDoc = await getDoc(doc(this.db, 'users', userId, 'conversationSummaries', peerId));
            if (summaryDoc.exists()) {
                return Boolean(summaryDoc.data()?.isArchived);
            }
        } catch {
            // fallback
        }
        return false;
    }

    public async setArchiveStatus(peerId: string, isArchived: boolean): Promise<void> {
        await this.apiService.request('/api/messaging', {
            authenticated: true,
            method: 'PATCH',
            body: { peerId, action: isArchived ? 'archive' : 'unarchive' },
        });
    }

    /**
     * Toggle an emoji reaction on a message
     */
    public async toggleReaction(
        chatRoomId: string,
        messageTimestamp: number,
        emoji: string,
        userId: string
    ): Promise<void> {
        await this.apiService.request('/api/messaging/actions', { authenticated: true, method: 'POST', body: { action: 'react', chatId: chatRoomId, timestampSeconds: messageTimestamp, emoji } });
        return;
        {
        const chatRef = doc(this.db, 'chats', chatRoomId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) return;

        const chatData = chatDoc.data() ?? {};
        const updatedMessages: FullMessage[] = (chatData.messages ?? []).map((msg: FullMessage) => {
            if (msg.timestamp.seconds !== messageTimestamp) return msg;
            const reactions: Record<string, string[]> = { ...(msg.reactions ?? {}) };
            const users = reactions[emoji] ?? [];
            if (users.includes(userId)) {
                reactions[emoji] = users.filter((u) => u !== userId);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
                reactions[emoji] = [...users, userId];
            }
            return { ...msg, reactions };
        });

        await updateDoc(chatRef, { messages: updatedMessages });
        }
    }

    /**
     * Mark messages as read for the given user
     */
    public async markMessagesAsRead(receiverId: string, senderId: string): Promise<void> {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(this.db, 'chats', chatRoomId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) return;

        const chatData = chatDoc.data() ?? {};
        const updatedMessages = (chatData.messages ?? []).map((msg: MessageData) => {
            if (msg.receiverId === senderId && msg.status !== 'read') {
                return { ...msg, status: 'read' };
            }
            return msg;
        });

        await updateDoc(chatRef, { messages: updatedMessages, unreadCount: 0 });
    }

    /**
     * Delete a message (for me or for everyone)
     */
    public async deleteMessage(
        receiverId: string,
        senderId: string,
        messageTimestamp: number,
        deleteForEveryone: boolean
    ): Promise<boolean> {
        try {
            const chatRoomId = this.getChatRoomId(senderId, receiverId);
            await this.apiService.request('/api/messaging/actions', { authenticated: true, method: 'POST', body: { action: 'delete', chatId: chatRoomId, timestampSeconds: messageTimestamp, deleteForEveryone } });
            return true;
            {
            const chatRef = doc(this.db, 'chats', chatRoomId);
            const chatDoc = await getDoc(chatRef);
            if (!chatDoc.exists()) return false;

            const chatData = chatDoc.data() ?? {};
            let updatedMessages: FullMessage[];

            if (deleteForEveryone) {
                updatedMessages = (chatData.messages ?? []).map((msg: FullMessage) => {
                    if (msg.timestamp?.seconds !== messageTimestamp) return msg;
                    const cleanedMsg: Record<string, unknown> = {
                        ...msg,
                        isDeletedForEveryone: true,
                        message: 'This message was deleted',
                        type: 'text',
                    };
                    delete cleanedMsg.attachment;
                    delete cleanedMsg.stickerUrl;
                    delete cleanedMsg.stickerId;
                    delete cleanedMsg.packId;
                    delete cleanedMsg.stickerWidth;
                    delete cleanedMsg.stickerHeight;
                    delete cleanedMsg.audioUrl;
                    delete cleanedMsg.audioDuration;
                    return cleanedMsg as FullMessage;
                });
            } else {
                updatedMessages = (chatData.messages ?? []).map((msg: FullMessage) => {
                    if (msg.timestamp?.seconds !== messageTimestamp) return msg;
                    return { ...msg, deletedFor: [...(msg.deletedFor ?? []), senderId] };
                });
            }

            await updateDoc(chatRef, {
                messages: updatedMessages,
                lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].message : '',
                lastMessageTime: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].timestamp : Timestamp.now(),
            });
            return true;
            }
        } catch (error) {
            console.error('[MessagingService.deleteMessage]', error);
            return false;
        }
    }

    /**
     * Clear all messages in a chat room
     */
    public async clearChatHistory(chatRoomId: string): Promise<void> {
        await this.apiService.request('/api/messaging/actions', { authenticated: true, method: 'POST', body: { action: 'clear', chatId: chatRoomId } });
        return;
        {
        const chatRef = doc(this.db, 'chats', chatRoomId);
        await updateDoc(chatRef, {
            messages: [],
            lastMessage: '',
            lastMessageTime: Timestamp.now(),
            unreadCount: 0,
        });
        }
    }

    /**
     * Subscribe to real-time message updates
     */
    public subscribeToMessages(
        receiverId: string,
        senderId: string,
        callback: (messages: FullMessage[]) => void
    ): () => void {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        const chatRef = doc(this.db, 'chats', chatRoomId);

        return onSnapshot(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const chatData = snapshot.data();
                const msgs: FullMessage[] = (chatData.messages || []).sort(
                    (a: FullMessage, b: FullMessage) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0)
                );
                callback(msgs);
            } else {
                callback([]);
            }
        });
    }
}

export const messagingService = MessagingService.getInstance();
