import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import { messagingService } from '@/lib/messaging/MessagingService';
import { Timestamp } from 'firebase/firestore';

const authService = AuthService.getInstance();

type ConversationEntry = UserProfile & {
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  unreadCount?: number;
};

function formatLastMessageTime(ts?: Timestamp): string {
  if (!ts) return '';
  const date = new Date(ts.seconds * 1000);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLastMessagePreview(msg?: string, userName?: string): string {
  if (!msg) return `@${userName ?? ''}`;
  if (msg === '[SYS:CALL_ENDED]') return '📞 Call ended';
  if (msg === '[SYS:VOICE_CALL_INVITE]') return '📞 Voice call';
  if (msg === '[SYS:VIDEO_CALL_INVITE]') return '📹 Video call';
  return msg;
}

export default function ChatTabScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = authService.getCurrentUser()?.uid ?? '';

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      // 1. Query friendship collection for accepted friendships
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, 'friendship'), where('userId1', '==', currentUserId), where('friendshipStatus', '==', 'accepted'))),
        getDocs(query(collection(db, 'friendship'), where('userId2', '==', currentUserId), where('friendshipStatus', '==', 'accepted'))),
      ]);

      const friendIds = new Set<string>([
        ...snap1.docs.map((d) => d.data().userId2 as string),
        ...snap2.docs.map((d) => d.data().userId1 as string),
      ]);

      // 2. Hydrate friend profiles with last message data
      const entries: ConversationEntry[] = [];

      for (const fId of friendIds) {
        if (!fId || fId === currentUserId) continue;
        const profile = await authService.getUserProfile(fId);
        if (!profile) continue;

        // Load last message from chat room
        const chatRoomId = messagingService.getChatRoomId(currentUserId, fId);
        const chatDoc = await getDoc(doc(db, 'chats', chatRoomId));
        let lastMessage: string | undefined;
        let lastMessageTime: Timestamp | undefined;
        let unreadCount = 0;

        if (chatDoc.exists()) {
          const data = chatDoc.data();
          lastMessage = data.lastMessage;
          lastMessageTime = data.lastMessageTime;
          unreadCount = data.unreadCount ?? 0;

          // Only count unread messages addressed to me
          if (data.messages && Array.isArray(data.messages)) {
            unreadCount = data.messages.filter(
              (m: { receiverId: string; status: string }) =>
                m.receiverId === currentUserId && m.status !== 'read'
            ).length;
          }
        }

        entries.push({ ...profile, lastMessage, lastMessageTime, unreadCount });
      }

      // Sort by last message time (most recent first)
      entries.sort((a, b) => {
        const aTime = a.lastMessageTime?.seconds ?? 0;
        const bTime = b.lastMessageTime?.seconds ?? 0;
        return bTime - aTime;
      });

      // Fallback: if no friends yet, show all users
      if (entries.length === 0) {
        const usersSnap = await getDocs(query(collection(db, 'users')));
        for (const userDoc of usersSnap.docs) {
          if (userDoc.id === currentUserId) continue;
          const profile = await authService.getUserProfile(userDoc.id);
          if (profile) entries.push(profile);
          if (entries.length >= 20) break; // cap fallback list
        }
      }

      setConversations(entries);
    } catch (error) {
      console.error('[ChatTabScreen.loadConversations]', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((user) => {
    if (!searchQuery.trim()) return true;
    const name = `${user.firstName} ${user.lastName} ${user.userName}`.toLowerCase();
    return name.includes(searchQuery.trim().toLowerCase());
  });

  const handleOpenChat = (user: UserProfile) => {
    router.push(`/chat/${user.uid}` as any);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={{ padding: 6 }}>
            <Icon name="edit" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f1f5f9',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}>
          <Icon name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: '#0f172a' }}
            placeholder="Search conversations..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations List */}
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {isLoading ? (
          <View>
            <SkeletonChatRow />
            <SkeletonChatRow />
            <SkeletonChatRow />
            <SkeletonChatRow />
            <SkeletonChatRow />
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="message-circle" size={36} color="#10b981" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 6 }}>No Messages Yet</Text>
            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 32 }}>
              Connect with friends on Ourlime to start messaging.
            </Text>
          </View>
        ) : (
          filteredConversations.map((user) => {
            const hasUnread = (user.unreadCount ?? 0) > 0;
            return (
              <TouchableOpacity
                key={user.uid}
                onPress={() => handleOpenChat(user)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  padding: 14,
                  borderRadius: 18,
                  marginBottom: 8,
                  borderWidth: hasUnread ? 1.5 : 1,
                  borderColor: hasUnread ? '#10b981' : '#f1f5f9',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                {/* Avatar with online dot */}
                <View style={{ position: 'relative' }}>
                  <UserAvatar profileImage={user.profilePicture} firstName={user.firstName ?? user.userName ?? 'U'} size={52} />
                  <View style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  }} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <Text style={{ fontSize: 16, fontWeight: hasUnread ? '800' : '600', color: '#1e293b' }} numberOfLines={1}>
                      {user.firstName} {user.lastName}
                    </Text>
                    <Text style={{ fontSize: 11, color: hasUnread ? '#10b981' : '#94a3b8', fontWeight: hasUnread ? '700' : '400' }}>
                      {formatLastMessageTime(user.lastMessageTime)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: hasUnread ? '#374151' : '#94a3b8', fontWeight: hasUnread ? '600' : '400', flex: 1 }} numberOfLines={1}>
                      {formatLastMessagePreview(user.lastMessage, user.userName)}
                    </Text>
                    {hasUnread && (
                      <View style={{ backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 }}>
                        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                          {user.unreadCount! > 99 ? '99+' : user.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Icon name="chevron-right" size={16} color="#cbd5e1" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
