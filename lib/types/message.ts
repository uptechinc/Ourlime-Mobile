import { Timestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/services/AuthService';

/**
 * Represents a chat message with reply functionality
 */
export type Message = {
    id?: string;
    message: string;
    senderId: string;
    receiverId: string;
    status: 'sent' | 'delivered' | 'read';
    timestamp: Timestamp;
    replyTo?: ReplyReference;
};

/**
 * Reference to a message being replied to
 */
export type ReplyReference = {
    messageId: string;
    originalMessage: string;
    originalSenderId: string;
    originalTimestamp: Timestamp;
};

/**
 * Message data structure for Firestore storage
 */
export type MessageData = {
    senderId: string;
    receiverId: string;
    message: string;
    timestamp: Timestamp;
    status: 'sent' | 'delivered' | 'read';
    replyTo?: ReplyReference;
};

/**
 * Chat room structure in Firestore
 */
export type ChatRoom = {
    participants: string[];
    lastMessageTime: Timestamp;
    messages: MessageData[];
    unreadCount?: number;
    lastMessage?: string;
};

/**
 * Props for friend messages component
 */
export type FriendMessagesProps = {
    selectedFriend: UserProfile;
    isCompact: boolean;
    onBack?: () => void;
};

/**
 * Message reactions structure
 */
export type MessageReactions = Record<string, { [emoji: string]: string[] }>;
