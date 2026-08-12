import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import type { ConversationEntry } from '@/lib/messaging/MessagingService';
import { Timestamp } from 'firebase/firestore';
import { useConversations } from '@/lib/hooks/useConversations';

const authService = AuthService.getInstance();

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
  const [composeVisible, setComposeVisible] = useState(false);
  const currentUserId = authService.getCurrentUser()?.uid ?? '';
  const { resource, refresh, loadMore, hasMore } = useConversations(currentUserId);
  const conversations: ConversationEntry[] = resource.data ?? [];
  const isLoading = resource.data === null && (resource.status === 'idle' || resource.status === 'hydrating');
  const refreshing = resource.status === 'refreshing';
  const loadError = resource.error?.message ?? null;

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const filteredConversations = conversations.filter((user) => {
    if (!searchQuery.trim()) return true;
    const name = `${user.firstName} ${user.lastName} ${user.userName}`.toLowerCase();
    return name.includes(searchQuery.trim().toLowerCase());
  });

  const handleOpenChat = (user: UserProfile) => {
    router.push({ pathname: '/chat/[id]', params: { id: user.uid } });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setComposeVisible(true)} style={{ padding: 6 }} accessibilityLabel="Start a new conversation">
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
        ) : loadError && conversations.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <Icon name="alert-triangle" size={36} color="#c64d53" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#991b1b' }}>Messages unavailable</Text>
            <Text style={{ marginTop: 6, color: '#64748b', textAlign: 'center' }}>{loadError}</Text>
            <TouchableOpacity onPress={() => void refresh()} style={{ marginTop: 16, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 10 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text></TouchableOpacity>
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
          <>
          {loadError ? <TouchableOpacity onPress={() => void refresh()} style={{ marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#fff7ed' }}><Text style={{ color: '#9a3412', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Showing saved conversations · Tap to retry</Text></TouchableOpacity> : null}
          {filteredConversations.map((user) => {
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
                  {user.isOnline ? <View style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  }} /> : null}
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
          })}
          {hasMore ? <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#ecfdf5' }}><Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>Load older conversations</Text></TouchableOpacity> : null}
          </>
        )}
      </ScrollView>
      <Modal visible={composeVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposeVisible(false)}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}><Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: '#0f172a' }}>New message</Text><TouchableOpacity onPress={() => setComposeVisible(false)}><Icon name="x" size={24} color="#475569" /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {conversations.length === 0 ? <View style={{ paddingVertical: 60, alignItems: 'center' }}><Icon name="users" size={38} color="#10b981" /><Text style={{ marginTop: 10, fontWeight: '800', color: '#334155' }}>Add friends to start chatting</Text></View> : conversations.map((friend) => <TouchableOpacity key={friend.uid} onPress={() => { setComposeVisible(false); handleOpenChat(friend); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 15, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}><UserAvatar profileImage={friend.profilePicture} firstName={friend.firstName || friend.userName} size={46} /><View style={{ flex: 1, marginLeft: 11 }}><Text style={{ color: '#0f172a', fontWeight: '800' }}>{friend.firstName} {friend.lastName}</Text><Text style={{ color: '#64748b', marginTop: 2 }}>@{friend.userName}</Text></View><Icon name="message-circle" size={19} color="#10b981" /></TouchableOpacity>)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
