import { Timestamp } from 'firebase/firestore';
import type { ConversationEntry } from '@/lib/messaging/MessagingService';
import type { MessageData } from '@/lib/types/message';

export const mockConversations: ConversationEntry[] = [
  {
    uid: 'peer_user_456',
    firstName: 'Rishi',
    lastName: 'Kowlessar',
    userName: 'rishi06',
    email: 'rishi@ourlime.com',
    profilePicture: 'https://ourlime.com/avatars/rishi.png',
    role: 'user',
    accountType: 'personal',
    lastMessage: 'Hey, did you test the lockscreen notifications?',
    lastMessageTime: Timestamp.fromMillis(Date.now() - 120000),
    unreadCount: 2,
    isOnline: true,
    isPinned: true,
    isArchived: false,
    isMuted: false,
  },
  {
    uid: 'peer_user_789',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    userName: 'sarah_j',
    email: 'sarah@ourlime.com',
    profilePicture: 'https://ourlime.com/avatars/sarah.png',
    role: 'user',
    accountType: 'personal',
    lastMessage: '🎤 Voice message (0:14)',
    lastMessageTime: Timestamp.fromMillis(Date.now() - 3600000),
    unreadCount: 0,
    isOnline: false,
    isPinned: false,
    isArchived: true,
    isMuted: false,
  },
];

export const mockMessages: MessageData[] = [
  {
    senderId: 'peer_user_456',
    receiverId: 'regular_user_id_999',
    message: 'Hey Aaron, is the app ready for release?',
    timestamp: Timestamp.fromMillis(Date.now() - 300000),
    status: 'delivered',
  },
  {
    senderId: 'regular_user_id_999',
    receiverId: 'peer_user_456',
    message: 'Yes! Background push notifications and YouTube player are working perfectly.',
    timestamp: Timestamp.fromMillis(Date.now() - 120000),
    status: 'read',
  },
];
