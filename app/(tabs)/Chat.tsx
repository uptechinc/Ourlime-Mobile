import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import { messagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';
import { simpleChatMessageService } from '@/lib/services/SimpleChatMessageService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { Timestamp } from 'firebase/firestore';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useConversations } from '@/lib/hooks/useConversations';
import { useActivityStatuses } from '@/lib/hooks/useActivityStatuses';
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_LABELS } from '@/lib/services/PresenceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';

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

function formatLastMessagePreview(msg?: string, userName?: string, sentByViewer = false): string {
  if (!msg) return `@${userName ?? ''}`;
  if (msg === '[SYS:CALL_ENDED]') return '📞 Call ended';
  if (msg === '[SYS:VOICE_CALL_INVITE]') return '📞 Voice call';
  if (msg === '[SYS:VIDEO_CALL_INVITE]') return '📹 Video call';
  const sharedPreview = sharedContentMessageService.getConversationListPreview(msg, sentByViewer);
  if (sharedPreview) return sharedPreview;
  return msg;
}


type SelectionAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};
export default function ChatTabScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [composeVisible, setComposeVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [mutedUids, setMutedUids] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentUserId = authService.getCurrentUser()?.uid ?? '';
  const { resource, refresh, loadMore, hasMore } = useConversations(currentUserId);
  const conversations: ConversationEntry[] = useMemo(() => resource.data ?? [], [resource.data]);
  const isLoading = resource.data === null && (resource.status === 'idle' || resource.status === 'hydrating');
  const refreshing = resource.status === 'refreshing';
  const loadError = resource.error?.message ?? null;

  const isSelectionMode = selectedUids.size > 0;
  const archivedKey = `ourlime_archived_chats_${currentUserId}`;
  const mutedKey = `ourlime_muted_chats_${currentUserId}`;

  // Pinned and archived come only from the conversation summaries, so an
  // unarchive/unpin made anywhere (chat settings, another device) takes effect here.
  const pinnedUids = useMemo(() => new Set(conversations.filter((c) => c.isPinned).map((c) => c.uid)), [conversations]);
  // Live online / busy / away / working / offline for everyone in the list (same as the website).
  const conversationUids = useMemo(() => conversations.map((conversation) => conversation.uid), [conversations]);
  const activityStatuses = useActivityStatuses(conversationUids);
  const archivedUids = useMemo(() => new Set(conversations.filter((c) => c.isArchived).map((c) => c.uid)), [conversations]);

  // Mute lives in chatMuteSettings, mirrored to storage. Reload on focus so a
  // change made inside a chat is reflected when returning to this tab.
  useFocusEffect(useCallback(() => {
    if (!currentUserId) return;
    AsyncStorage.getItem(mutedKey).then((val) => {
      try {
        const stored = val ? new Set(JSON.parse(val) as string[]) : new Set<string>();
        setMutedUids(stored);
      } catch {
        // ignore
      }
    }).catch(() => {});
  }, [currentUserId, mutedKey]));

  // Keep the storage mirror used by push suppression in step with Firestore.
  useEffect(() => {
    if (!currentUserId || resource.data === null) return;
    void AsyncStorage.setItem(archivedKey, JSON.stringify(Array.from(archivedUids))).catch(() => {});
  }, [archivedKey, archivedUids, currentUserId, resource.data]);

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
    if (activeFilter === 'unread') return user.lastMessageSenderId !== currentUserId && (user.unreadCount ?? 0) > 0;
    return true;
  });

  const filteredConversations = tabFilteredConversations.filter((user) => {
    if (!user) return false;
    const isSearching = Boolean(searchQuery.trim());
    if (!isSearching) {
      return activeFilter === 'archived' ? true : Boolean(user.lastMessage || user.lastMessageTime || (user.lastMessageSenderId !== currentUserId && (user.unreadCount ?? 0) > 0));
    }
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''} ${user.userName ?? ''}`.toLowerCase();
    return name.includes(searchQuery.trim().toLowerCase());
  });

  const unreadFilterCount = conversations.filter((c) => !archivedUids.has(c.uid) && !c.isArchived && c.lastMessageSenderId !== currentUserId && (c.unreadCount ?? 0) > 0).length;
  const archivedFilterCount = conversations.filter((c) => archivedUids.has(c.uid) || c.isArchived === true).length;

  const handleOpenChat = (user: UserProfile) => {
    if (isSelectionMode) {
      toggleSelectUser(user.uid);
      return;
    }
    if (currentUserId) {
      void conversationResourceService.patchConversation(currentUserId, user.uid, { unreadCount: 0 });
      void simpleChatMessageService.markRead(user.uid);
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
    const allPinned = uids.every((uid) => pinnedUids.has(uid));
    for (const uid of uids) {
      void simpleChatMessageService.setPinStatus(uid, !allPinned);
      void conversationResourceService.patchConversation(currentUserId, uid, { isPinned: !allPinned });
    }
    handleExitSelection();
  };

  const handleToggleArchiveSelected = async () => {
    const uids = Array.from(selectedUids);
    const allArchived = uids.every((uid) => archivedUids.has(uid));
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
        await conversationResourceService.removeConversation(currentUserId, uid);
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
        return item?.lastMessageSenderId !== currentUserId && (item?.unreadCount ?? 0) > 0;
      })
    : filteredConversations.some((c) => c.lastMessageSenderId !== currentUserId && (c.unreadCount ?? 0) > 0);
  const allVisibleSelected = filteredConversations.length > 0 && selectedUids.size === filteredConversations.length;

  // Labelled actions for the selection bar; the label always says what a tap will do.
  const selectionActions: SelectionAction[] = [
    { key: 'pin', label: allSelectedPinned ? 'Unpin' : 'Pin', icon: allSelectedPinned ? 'pin' : 'pin-outline', onPress: () => void handleTogglePinSelected() },
    { key: 'archive', label: allSelectedArchived ? 'Unarchive' : 'Archive', icon: allSelectedArchived ? 'arrow-undo-outline' : 'archive-outline', onPress: () => void handleToggleArchiveSelected() },
    anyUnreadSelected
      ? { key: 'read', label: 'Read', icon: 'mail-open-outline', onPress: () => void handleMarkAsReadSelected() }
      : { key: 'unread', label: 'Unread', icon: 'mail-unread-outline', onPress: () => void handleMarkAsUnreadSelected() },
    { key: 'mute', label: allSelectedMuted ? 'Unmute' : 'Mute', icon: allSelectedMuted ? 'notifications-outline' : 'notifications-off-outline', onPress: () => void handleToggleMuteSelected() },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', onPress: handleDeleteSelected, destructive: true },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header / Selection Action Bar */}
      {isSelectionMode ? (
        <View style={{
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <TouchableOpacity
            onPress={handleExitSelection}
            accessibilityRole="button"
            accessibilityLabel="Cancel selection"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 19, fontWeight: '800', color: colors.text }}>
            {selectedUids.size} selected
          </Text>
          <TouchableOpacity
            onPress={handleSelectAll}
            accessibilityRole="button"
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.successSurface }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accentText }}>
              {allVisibleSelected ? 'Clear' : 'Select all'}
            </Text>
          </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setComposeVisible(true)} style={{ padding: 6 }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Start a new conversation">
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
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: isSelectionMode ? 120 : 80 }}
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
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.destructiveText }}>Messages unavailable</Text>
            <Text style={{ marginTop: 6, color: colors.mutedText, textAlign: 'center' }}>{loadError}</Text>
            <TouchableOpacity onPress={() => void refresh()} style={{ marginTop: 16, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
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
              <TouchableOpacity onPress={() => void refresh()} accessibilityRole="button" style={{ marginBottom: 8, minHeight: 44, justifyContent: 'center', padding: 10, borderRadius: 12, backgroundColor: colors.warningSurface }}>
                <Text style={{ color: colors.warningText, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Showing saved conversations · Tap to retry</Text>
              </TouchableOpacity>
            ) : null}

            {filteredConversations.map((user) => {
              const hasUnread = user.lastMessageSenderId !== currentUserId && (user.unreadCount ?? 0) > 0;
              const isSelected = selectedUids.has(user.uid);
              const isPinned = pinnedUids.has(user.uid);
              const isMuted = mutedUids.has(user.uid);
              const activityStatus = activityStatuses[user.uid] ?? (user.isOnline ? 'online' : 'offline');

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
                    {activityStatus !== 'offline' ? (
                      <View
                        accessibilityLabel={`${user.firstName ?? 'Friend'} is ${ACTIVITY_STATUS_LABELS[activityStatus].toLowerCase()}`}
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 2,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: ACTIVITY_STATUS_COLORS[activityStatus],
                          borderWidth: 2,
                          borderColor: colors.surface,
                        }}
                      />
                    ) : null}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: hasUnread ? '800' : '600', color: colors.text }} numberOfLines={1}>
                          {user.firstName} {user.lastName}
                        </Text>
                        {isPinned && <Ionicons name="pin" size={12} color="#10b981" accessibilityLabel="Pinned" />}
                        {isMuted && <Feather name="bell-off" size={12} color={colors.mutedText} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACTIVITY_STATUS_COLORS[activityStatus] }} />
                          <Text style={{ fontSize: 11, color: colors.mutedText, fontWeight: '600' }}>{ACTIVITY_STATUS_LABELS[activityStatus]}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: hasUnread ? '#10b981' : colors.mutedText, fontWeight: hasUnread ? '700' : '400' }}>
                        {formatLastMessageTime(user.lastMessageTime)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: hasUnread ? 8 : 0 }}>
                        {user.lastMessageSenderId === currentUserId && Boolean(user.lastMessage) && (
                          <Ionicons
                            name="checkmark-done"
                            size={14}
                            color={colors.mutedText}
                            style={{ marginRight: 4 }}
                            accessibilityLabel="Last message sent by you"
                          />
                        )}
                        <Text style={{ fontSize: 13, color: hasUnread ? colors.text : colors.mutedText, fontWeight: hasUnread ? '600' : '400', flex: 1 }} numberOfLines={1}>
                          {formatLastMessagePreview(user.lastMessage, user.userName, user.lastMessageSenderId === currentUserId)}
                        </Text>
                      </View>
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
              <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.successSurface }}>
                <Text style={{ color: colors.successText, fontSize: 12, fontWeight: '700' }}>Load older conversations</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>

      <CustomModal
        visible={showDeleteConfirm}
        type="danger"
        title={`Delete ${selectedUids.size} chat${selectedUids.size === 1 ? '' : 's'}?`}
        message="This clears the selected conversation history from this device."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* New Message Compose Modal */}
      <Modal visible={composeVisible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={() => setComposeVisible(false)}>
        <SwipeDismissSurface visible={composeVisible} onDismiss={() => setComposeVisible(false)} handleColor={colors.border} accessibilityLabel="Swipe down to close new message" style={{ flex: 1, backgroundColor: colors.canvas }}>
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
        </SwipeDismissSurface>
      </Modal>
      {isSelectionMode ? (
        <View style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          flexDirection: 'row',
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.elevated,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
        }}>
          {selectionActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${action.label} ${selectedUids.size === 1 ? 'chat' : 'chats'}`}
              style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14 }}
            >
              <Ionicons name={action.icon} size={22} color={action.destructive ? colors.destructive : colors.icon} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: action.destructive ? colors.destructiveText : colors.secondaryText }}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
