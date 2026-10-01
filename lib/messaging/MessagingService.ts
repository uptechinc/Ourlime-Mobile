import { auth, db, storage } from '@/lib/firebaseConfig';
import { doc, getDoc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { readAsStringAsync, EncodingType, getInfoAsync } from 'expo-file-system/legacy';
import type { CallEventMessage } from '@/lib/types/call';
import type { MessageData, ChatRoom, ReplyReference } from '@/lib/types/message';
import type { UserProfile } from '@/lib/services/AuthService';
import { chatDataService } from '@/lib/services/ChatDataService';

export type ConversationEntry = UserProfile & {
    lastMessage?: string;
    lastMessageSenderId?: string;
    lastMessageTime?: Timestamp;
    unreadCount: number;
    isOnline: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
    isMuted?: boolean;
    mutedUntil?: number | null;
};

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
    private readonly chatData = chatDataService;

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
        const page = await this.chatData.getChatFriendsPage(20, cursor);
        const items = page.items.map((friend): ConversationEntry => ({
            uid: friend.id,
            firstName: friend.firstName,
            lastName: friend.lastName,
            userName: friend.userName,
            email: '',
            accountType: 'user',
            profilePicture: friend.profileImage,
            lastMessage: friend.lastMessage || undefined,
            lastMessageSenderId: friend.lastMessageSenderId,
            lastMessageTime: friend.lastMessageTime ?? undefined,
            unreadCount: friend.lastMessageSenderId === currentUserId ? 0 : friend.unreadCount,
            isOnline: friend.isOnline,
            isPinned: friend.isPinned,
            isArchived: friend.isArchived,
            isMuted: friend.isMuted,
            mutedUntil: friend.mutedUntil,
        }));
        return { items, nextCursor: page.nextCursor };
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
        if (auth.currentUser?.uid !== senderId) throw new Error('Please sign in again to send messages.');
        const record = await this.chatData.sendMessage({ receiverId, message, replyTo, attachment, stickerData, voiceNoteData, isForwarded });
        const sent = this.normalizeMessage(record);
        if (!sent) throw new Error('Message could not be sent.');
        return sent;
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
        await this.chatData.updateConversation(peerId, isArchived ? 'archive' : 'unarchive');
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
        await this.chatData.applyMessageAction({ action: 'react', chatId: chatRoomId, timestampSeconds: messageTimestamp, emoji });
    }

    /**
     * Mark messages as read for the current user in a conversation with peerId
     */
    public async markMessagesAsRead(currentUserId: string, peerId: string): Promise<void> {
        if (!currentUserId || !peerId || auth.currentUser?.uid !== currentUserId) return;
        try {
            await this.chatData.updateConversation(peerId, 'read');
        } catch (error) {
            console.log('[MessagingService][markMessagesAsRead] Read update failed:', error);
        }
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
            await this.chatData.applyMessageAction({ action: 'delete', chatId: chatRoomId, timestampSeconds: messageTimestamp, deleteForEveryone });
            return true;
        } catch (error) {
            console.error('[MessagingService.deleteMessage]', error);
            return false;
        }
    }

    /**
     * Clear all messages in a chat room
     */
    public async clearChatHistory(chatRoomId: string): Promise<void> {
        await this.chatData.applyMessageAction({ action: 'clear', chatId: chatRoomId });
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
