import { auth, db, storage } from '@/lib/firebaseConfig';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, onSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { CallEventMessage } from '@/lib/types/call';
import type { MessageData, ReplyReference } from '@/lib/types/message';
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

export type ChatUploadOptions = {
    /** 0-100 while bytes are uploading. */
    onProgress?: (percentage: number) => void;
    /** Aborting cancels the upload. */
    signal?: AbortSignal;
};

export class ChatUploadCancelledError extends Error {
    public constructor() {
        super('Upload cancelled');
        this.name = 'ChatUploadCancelledError';
    }
}

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
     * Uploads a local chat file to Firebase Storage with progress and cancel.
     * Uses XMLHttpRequest to turn the local URI into a native RN Blob (falls back to base64 when that fails).
     */
    public async uploadFile(
        uri: string,
        fileName: string,
        mimeType: string,
        userId: string,
        options: ChatUploadOptions = {}
    ): Promise<Attachment> {
        const safeName = fileName.replace(/[\\/#?]+/g, '_');
        const storagePath = `chats/${userId}/${Date.now()}_${safeName}`;
        const { url, sizeBytes } = await this.uploadToStorage(uri, storagePath, mimeType, options);
        return { url, fileName, fileType: mimeType, fileSize: sizeBytes };
    }

    /**
     * Uploads a recorded voice note to voiceNotes/{uid}/ (same place and fields as the website).
     * AAC .m4a is used because it plays on iOS, Android and every browser.
     */
    public async uploadVoiceNote(uri: string, userId: string, durationSeconds: number, options: ChatUploadOptions = {}): Promise<VoiceNoteData> {
        const storagePath = `voiceNotes/${userId}/${Date.now()}_voice.m4a`;
        const { url } = await this.uploadToStorage(uri, storagePath, 'audio/mp4', options);
        return { type: 'voiceNote', audioUrl: url, audioDuration: Math.max(1, Math.round(durationSeconds)) };
    }

    private async uploadToStorage(uri: string, storagePath: string, contentType: string, options: ChatUploadOptions): Promise<{ url: string; sizeBytes: number }> {
        if (options.signal?.aborted) throw new ChatUploadCancelledError();
        const storageRef = ref(storage, storagePath);
        let data: Blob | Uint8Array;
        try {
            data = await this.uriToBlob(uri);
        } catch (blobError: unknown) {
            console.warn('[MessagingService.uploadToStorage] Blob read failed, using base64:', blobError instanceof Error ? blobError.message : String(blobError));
            data = base64ToUint8Array(await readAsStringAsync(uri, { encoding: EncodingType.Base64 }));
        }
        const sizeBytes = data instanceof Uint8Array ? data.byteLength : data.size;
        let task: UploadTask | null = null;
        const handleAbort = () => task?.cancel();
        options.signal?.addEventListener('abort', handleAbort);
        try {
            task = uploadBytesResumable(storageRef, data, { contentType });
            await new Promise<void>((resolve, reject) => {
                task?.on('state_changed', (snapshot) => {
                    if (snapshot.totalBytes > 0) options.onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
                }, (error) => {
                    reject(options.signal?.aborted || (error as { code?: string }).code === 'storage/canceled' ? new ChatUploadCancelledError() : error);
                }, () => resolve());
            });
        } finally {
            options.signal?.removeEventListener('abort', handleAbort);
            const closeableBlob = data as Blob & { close?: () => void };
            if (typeof closeableBlob.close === 'function') {
                try { closeableBlob.close(); } catch { /* already released */ }
            }
        }
        return { url: await getDownloadURL(storageRef), sizeBytes };
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

    /** Edits your own text message (the server enforces the 20-minute window and sender check). */
    public async editMessage(receiverId: string, senderId: string, messageTimestamp: number, nextText: string): Promise<void> {
        const chatRoomId = this.getChatRoomId(senderId, receiverId);
        await this.chatData.applyMessageAction({ action: 'edit', chatId: chatRoomId, timestampSeconds: messageTimestamp, message: nextText });
    }

    /** Starred messages live at users/{uid}/starredMessages/{friendId}_{messageId} (same as the website). */
    public async getStarredMessageIds(currentUserId: string, friendId: string): Promise<Set<string>> {
        const snapshot = await getDocs(query(collection(db, 'users', currentUserId, 'starredMessages'), where('friendId', '==', friendId)));
        return new Set(snapshot.docs.map((document) => String(document.data().messageId ?? '')).filter(Boolean));
    }

    public async setMessageStarred(currentUserId: string, friendId: string, messageId: string, starred: boolean): Promise<void> {
        const starReference = doc(db, 'users', currentUserId, 'starredMessages', `${friendId}_${encodeURIComponent(messageId)}`);
        if (starred) await setDoc(starReference, { friendId, messageId, starredAt: serverTimestamp() });
        else await deleteDoc(starReference);
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
