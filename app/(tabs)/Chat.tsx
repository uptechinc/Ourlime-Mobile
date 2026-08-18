import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import { messagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';
import { simpleChatMessageService } from '@/lib/services/SimpleChatMessageService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { Timestamp } from 'firebase/firestore';
import { useConversations } from '@/lib/hooks/useConversations';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

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
  const { isDark, colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [composeVisible, setComposeVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [pinnedUids, setPinnedUids] = useState<Set<string>>(new Set());
  const [archivedUids, setArchivedUids] = useState<Set<string>>(new Set());
  const [mutedUids, setMutedUids] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentUserId = authService.getCurrentUser()?.uid ?? '';
  const { resource, refresh, loadMore, hasMore } = useConversations(currentUserId);
  const conversations: ConversationEntry[] = resource.data ?? [];
  const isLoading = resource.data === null && (resource.status === 'idle' || resource.status === 'hydrating');
  const refreshing = resource.status === 'refreshing';
  const loadError = resource.error?.message ?? null;

  const isSelectionMode = selectedUids.size > 0;
  const pinnedKey = `ourlime_pinned_chats_${currentUserId}`;
  const archivedKey = `ourlime_archived_chats_${currentUserId}`;
  const mutedKey = `ourlime_muted_chats_${currentUserId}`;

  // Load pinned, archived, and muted lists from storage
  useEffect(() => {
    if (!currentUserId) return;
    AsyncStorage.getItem(pinnedKey).then((val) => {
      if (val) {
        try {
          setPinnedUids(new Set(JSON.parse(val) as string[]));
        } catch {
          // ignore
        }
      }
    }).catch(() => {});

    AsyncStorage.getItem(archivedKey).then((val) => {
      if (val) {
        try {
          setArchivedUids(new Set(JSON.parse(val) as string[]));
        } catch {
          // ignore
        }
      }
    }).catch(() => {});

    AsyncStorage.getItem(mutedKey).then((val) => {
      if (val) {
        try {
          setMutedUids(new Set(JSON.parse(val) as string[]));
        } catch {
          // ignore
        }
      }
    }).catch(() => {});
  }, [currentUserId, pinnedKey, archivedKey, mutedKey]);

  // Sync firestore flags to local state sets
  useEffect(() => {
    if (conversations.length === 0) return;
    setPinnedUids((prev) => {
      const next = new Set(prev);
      conversations.forEach((c) => {
        if (c.isPinned) next.add(c.uid);
      });
      return next;
    });
    setArchivedUids((prev) => {
      const next = new Set(prev);
      conversations.forEach((c) => {
        if (c.isArchived) next.add(c.uid);
      });
      return next;
    });
    setMutedUids((prev) => {
      const next = new Set(prev);
      conversations.forEach((c) => {
        if (c.isMuted) next.add(c.uid);
      });
      return next;
    });
  }, [conversations]);

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  // Sort conversations with pinned items at the top (for non-archived views)
  const sortedConversations = [...conversations].sort((a, b) => {
    if (activeFilter !== 'archived') {
      const aPinned = pinnedUids.has(a.uid) || a.isPinned === true;
      const bPinned = pinnedUids.has(b.uid) || b.isPinned === true;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
    }
    return (b.lastMessageTime?.seconds ?? 0) - (a.lastMessageTime?.seconds ?? 0);
  });

  const tabFilteredConversations = sortedConversations.filter((user) => {
    if (!user) return false;
    const isArchived = archivedUids.has(user.uid) || user.isArchived === true;
    if (activeFilter === 'archived') return isArchived;
    if (isArchived) return false;
    if (activeFilter === 'unread') return (user.unreadCount ?? 0) > 0;
    return true;
  });

  const filteredConversations = tabFilteredConversations.filter((user) => {
    if (!user) return false;
    const isSearching = Boolean(searchQuery.trim());
    if (!isSearching) {
      return activeFilter === 'archived' ? true : Boolean(user.lastMessage || user.lastMessageTime || (user.unreadCount ?? 0) > 0);
    }
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''} ${user.userName ?? ''}`.toLowerCase();
    return name.includes(searchQuery.trim().toLowerCase());
  });

  const unreadFilterCount = conversations.filter((c) => !archivedUids.has(c.uid) && !c.isArchived && (c.unreadCount ?? 0) > 0).length;
  const archivedFilterCount = conversations.filter((c) => archivedUids.has(c.uid) || c.isArchived === true).length;

  const handleOpenChat = (user: UserProfile) => {
    if (isSelectionMode) {
      toggleSelectUser(user.uid);
      return;
    }
    router.push({ pathname: '/chat/[id]', params: { id: user.uid } });
  };

  const toggleSelectUser = (uid: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleLongPressUser = (uid: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleExitSelection = () => {
    setSelectedUids(new Set());
  };

  const handleSelectAll = () => {
    if (selectedUids.size === filteredConversations.length && filteredConversations.length > 0) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(filteredConversations.map((c) => c.uid)));
    }
  };

  const handleMarkAsReadSelected = async () => {
    const uids = Array.from(selectedUids);
    handleExitSelection();
    for (const uid of uids) {
      void simpleChatMessageService.markRead(uid);
      void conversationResourceService.patchConversation(currentUserId, uid, { unreadCount: 0 });
    }
  };

  const handleMarkAsUnreadSelected = async () => {
    const uids = Array.from(selectedUids);
    handleExitSelection();
    for (const uid of uids) {
      void simpleChatMessageService.markUnread(uid);
      void conversationResourceService.patchConversation(currentUserId, uid, { unreadCount: 1 });
    }
  };

  const handleTogglePinSelected = async () => {
    const uids = Array.from(selectedUids);
    const nextPinned = new Set(pinnedUids);
    const allPinned = uids.every((uid) => nextPinned.has(uid));
    uids.forEach((uid) => {
      if (allPinned) nextPinned.delete(uid);
      else nextPinned.add(uid);
    });
    setPinnedUids(nextPinned);
    await AsyncStorage.setItem(pinnedKey, JSON.stringify(Array.from(nextPinned))).catch(() => {});
    for (const uid of uids) {
      void simpleChatMessageService.setPinStatus(uid, !allPinned);
      void conversationResourceService.patchConversation(currentUserId, uid, { isPinned: !allPinned });
    }
    handleExitSelection();
  };

  const handleToggleArchiveSelected = async () => {
    const uids = Array.from(selectedUids);
    const nextArchived = new Set(archivedUids);
    const allArchived = uids.every((uid) => nextArchived.has(uid));
    uids.forEach((uid) => {
      if (allArchived) nextArchived.delete(uid);
      else nextArchived.add(uid);
    });
    setArchivedUids(nextArchived);
    await AsyncStorage.setItem(archivedKey, JSON.stringify(Array.from(nextArchived))).catch(() => {});
    for (const uid of uids) {
      void simpleChatMessageService.setArchiveStatus(uid, !allArchived);
      void conversationResourceService.patchConversation(currentUserId, uid, { isArchived: !allArchived });
    }
    handleExitSelection();
  };

  const handleToggleMuteSelected = async () => {
    const uids = Array.from(selectedUids);
    const nextMuted = new Set(mutedUids);
    const allMuted = uids.every((uid) => nextMuted.has(uid));
    uids.forEach((uid) => {
      if (allMuted) nextMuted.delete(uid);
      else nextMuted.add(uid);
    });
    setMutedUids(nextMuted);
    await AsyncStorage.setItem(mutedKey, JSON.stringify(Array.from(nextMuted))).catch(() => {});
    if (currentUserId) {
      for (const uid of uids) {
        const until = allMuted ? null : Number.MAX_SAFE_INTEGER;
        void messagingService.setMuteUntil(currentUserId, uid, until).catch(() => {});
        void conversationResourceService.patchConversation(currentUserId, uid, { isMuted: !allMuted, mutedUntil: until });
      }
    }
    handleExitSelection();
  };

  const handleDeleteSelected = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    const uids = Array.from(selectedUids);
    setShowDeleteConfirm(false);
    handleExitSelection();
    for (const uid of uids) {
      try {
        const chatRoomId = messagingService.getChatRoomId(currentUserId, uid);
        await messagingService.clearChatHistory(chatRoomId);
        void conversationResourceService.patchConversation(currentUserId, uid, {
          lastMessage: '',
          unreadCount: 0,
        });
      } catch {
        // Continue deleting rest
      }
    }
  };

  const allSelectedPinned = Array.from(selectedUids).every((uid) => pinnedUids.has(uid));
  const allSelectedArchived = Array.from(selectedUids).every((uid) => archivedUids.has(uid));
  const allSelectedMuted = Array.from(selectedUids).every((uid) => mutedUids.has(uid));
  const anyUnreadSelected = selectedUids.size > 0
    ? Array.from(selectedUids).some((uid) => {
        const item = conversations.find((c) => c.uid === uid);
        return (item?.unreadCount ?? 0) > 0;
      })
    : filteredConversations.some((c) => (c.unreadCount ?? 0) > 0);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isSelectionMode ? '#10b981' : colors.surface} />

      {/* Header / Selection Action Bar */}
      {isSelectionMode ? (
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#10b981',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={handleExitSelection} hitSlop={12}>
              <Feather name="x" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#ffffff' }}>
              {selectedUids.size}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={handleSelectAll} hitSlop={10} accessibilityLabel="Select all">
              <Feather name="check-square" size={20} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTogglePinSelected} hitSlop={10} accessibilityLabel="Pin conversation">
              <Ionicons name={allSelectedPinned ? 'bookmark' : 'bookmark-outline'} size={20} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleToggleArchiveSelected} hitSlop={10} accessibilityLabel={allSelectedArchived ? "Unarchive conversation" : "Archive conversation"}>
              <Feather name="archive" size={20} color="#ffffff" />
            </TouchableOpacity>

            {anyUnreadSelected ? (
              <TouchableOpacity onPress={handleMarkAsReadSelected} hitSlop={10} accessibilityLabel="Mark as read">
                <Feather name="check" size={20} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleMarkAsUnreadSelected} hitSlop={10} accessibilityLabel="Mark as unread">
                <Feather name="mail" size={20} color="#ffffff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleToggleMuteSelected} hitSlop={10} accessibilityLabel="Mute notifications">
              <Feather name={allSelectedMuted ? 'bell' : 'bell-off'} size={20} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDeleteSelected} hitSlop={10} accessibilityLabel="Delete chats">
              <Feather name="trash-2" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Messages</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setComposeVisible(true)} style={{ padding: 6 }} accessibilityLabel="Start a new conversation">
              <Feather name="edit" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar */}
      {!isSelectionMode && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.control,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}>
            <Feather name="search" size={18} color={colors.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.text }}
              placeholder="Search conversations..."
              placeholderTextColor={colors.mutedText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={18} color={colors.mutedText} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Filter Chips: All | Unread | Archived */}
      {!isSelectionMode && (
        <View style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          gap: 8,
        }}>
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: activeFilter === 'all' ? '#10b981' : colors.control,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: activeFilter === 'all' ? '#ffffff' : colors.text,
            }}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('unread')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: activeFilter === 'unread' ? '#10b981' : colors.control,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: activeFilter === 'unread' ? '#ffffff' : colors.text,
            }}>
              Unread
            </Text>
            {unreadFilterCount > 0 && (
              <View style={{
                backgroundColor: activeFilter === 'unread' ? '#ffffff' : '#10b981',
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: activeFilter === 'unread' ? '#10b981' : '#ffffff',
                }}>
                  {unreadFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('archived')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: activeFilter === 'archived' ? '#10b981' : colors.control,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: activeFilter === 'archived' ? '#ffffff' : colors.text,
            }}>
              Archived
            </Text>
            {archivedFilterCount > 0 && (
              <View style={{
                backgroundColor: activeFilter === 'archived' ? '#ffffff' : colors.border,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: activeFilter === 'archived' ? '#10b981' : colors.text,
                }}>
                  {archivedFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Conversations List */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
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
            <Feather name="alert-triangle" size={36} color="#c64d53" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#991b1b' }}>Messages unavailable</Text>
            <Text style={{ marginTop: 6, color: colors.mutedText, textAlign: 'center' }}>{loadError}</Text>
            <TouchableOpacity onPress={() => void refresh()} style={{ marginTop: 16, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Feather name="message-circle" size={36} color="#10b981" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
              {searchQuery.trim()
                ? 'No Matching Conversations'
                : activeFilter === 'archived'
                ? 'No Archived Conversations'
                : activeFilter === 'unread'
                ? 'No Unread Messages'
                : 'No Messages Yet'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedText, textAlign: 'center', paddingHorizontal: 32 }}>
              {searchQuery.trim()
                ? 'Search for a friend to start a new chat.'
                : activeFilter === 'archived'
                ? 'Archived conversations will appear here.'
                : activeFilter === 'unread'
                ? 'All your conversations are caught up.'
                : 'Connect with friends on Ourlime to start messaging.'}
            </Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <TouchableOpacity onPress={() => void refresh()} style={{ marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#fff7ed' }}>
                <Text style={{ color: '#9a3412', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Showing saved conversations · Tap to retry</Text>
              </TouchableOpacity>
            ) : null}

            {filteredConversations.map((user) => {
              const hasUnread = (user.unreadCount ?? 0) > 0;
              const isSelected = selectedUids.has(user.uid);
              const isPinned = pinnedUids.has(user.uid);
              const isMuted = mutedUids.has(user.uid);

              return (
                <TouchableOpacity
                  key={user.uid}
                  onPress={() => handleOpenChat(user)}
                  onLongPress={() => handleLongPressUser(user.uid)}
                  delayLongPress={220}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? (isDark ? '#064e3b' : '#ecfdf5') : colors.surface,
                    padding: 14,
                    borderRadius: 18,
                    marginBottom: 8,
                    borderWidth: isSelected ? 2 : hasUnread ? 1.5 : 1,
                    borderColor: isSelected ? '#10b981' : hasUnread ? '#10b981' : colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  {/* Selection Check Circle */}
                  {isSelectionMode && (
                    <View style={{ marginRight: 12 }}>
                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? '#10b981' : colors.mutedText,
                        backgroundColor: isSelected ? '#10b981' : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && <Feather name="check" size={14} color="#ffffff" />}
                      </View>
                    </View>
                  )}

                  {/* Avatar with online dot */}
                  <View style={{ position: 'relative' }}>
                    <UserAvatar profileImage={user.profilePicture} firstName={user.firstName ?? user.userName ?? 'U'} size={52} />
                    {user.isOnline ? (
                      <View style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#10b981',
                        borderWidth: 2,
                        borderColor: colors.surface,
                      }} />
                    ) : null}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: hasUnread ? '800' : '600', color: colors.text }} numberOfLines={1}>
                          {user.firstName} {user.lastName}
                        </Text>
                        {isPinned && <Ionicons name="bookmark" size={12} color="#10b981" />}
                        {isMuted && <Feather name="bell-off" size={12} color={colors.mutedText} />}
                      </View>
                      <Text style={{ fontSize: 11, color: hasUnread ? '#10b981' : colors.mutedText, fontWeight: hasUnread ? '700' : '400' }}>
                        {formatLastMessageTime(user.lastMessageTime)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: hasUnread ? colors.text : colors.mutedText, fontWeight: hasUnread ? '600' : '400', flex: 1 }} numberOfLines={1}>
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

                  {!isSelectionMode && (
                    <Feather name="chevron-right" size={16} color={colors.icon} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })}
            {hasMore ? (
              <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#ecfdf5' }}>
                <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>Load older conversations</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <Pressable onPress={() => setShowDeleteConfirm(false)} style={styles.modalOverlay}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Feather name="trash-2" size={26} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete {selectedUids.size} Chat{selectedUids.size > 1 ? 's' : ''}?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              This will clear the message history for the selected conversations from your device.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={[styles.modalButton, { backgroundColor: colors.control }]}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmDelete} style={[styles.modalButton, { backgroundColor: '#ef4444' }]}>
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New Message Compose Modal */}
      <Modal visible={composeVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposeVisible(false)}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: colors.text }}>New message</Text>
            <TouchableOpacity onPress={() => setComposeVisible(false)}>
              <Feather name="x" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {conversations.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Feather name="users" size={38} color="#10b981" />
                <Text style={{ marginTop: 10, fontWeight: '800', color: colors.text }}>Add friends to start chatting</Text>
              </View>
            ) : (
              conversations.map((friend) => (
                <TouchableOpacity
                  key={friend.uid}
                  onPress={() => { setComposeVisible(false); handleOpenChat(friend); }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 15, marginBottom: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <UserAvatar profileImage={friend.profilePicture} firstName={friend.firstName || friend.userName} size={46} />
                  <View style={{ flex: 1, marginLeft: 11 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{friend.firstName} {friend.lastName}</Text>
                    <Text style={{ color: colors.mutedText, marginTop: 2 }}>@{friend.userName}</Text>
                  </View>
                  <Feather name="message-circle" size={19} color="#10b981" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
