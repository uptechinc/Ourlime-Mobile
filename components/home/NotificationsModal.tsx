import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import { FriendshipService } from '@/lib/relationships/friendshipService';
import { AuthService } from '@/lib/services/AuthService';
import { SkeletonNotificationRow } from './SkeletonLoaders';
import type { NotificationType, NotificationData } from '@/lib/types/notification';

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
};

const friendshipService = FriendshipService.getInstance();
const authService = AuthService.getInstance();

type SortMode = 'unread_first' | 'newest_first';
type FilterCategory = 'all' | 'unread' | 'friend_request' | 'like' | 'comment' | 'mention' | 'community';

type DialogState = {
  visible: boolean;
  type: CustomModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
};

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markAsRead, markAsUnread, markAllAsRead, refreshNotifications } = useNotifications();

  const [sortMode, setSortMode] = useState<SortMode>('unread_first');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showReadNotifs, setShowReadNotifs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Track resolved friend request notifications (Web Parity)
  const [resolvedRequestIds, setResolvedRequestIds] = useState<Set<string>>(new Set());

  // Modern Dialog State
  const [dialogState, setDialogState] = useState<DialogState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const currentUserId = authService.getCurrentUser()?.uid;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const closeDialog = () => setDialogState((prev) => ({ ...prev, visible: false }));

  // Strict normalization helper
  const isItemRead = (n: NotificationData) => Boolean(n.isRead === true || (n as any).isRead === 'true' || (n as any).isRead === 1);

  // Filter list
  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (activeFilter === 'unread') {
      list = list.filter((n) => !isItemRead(n));
    } else if (activeFilter === 'friend_request') {
      list = list.filter((n) => n.type === 'friend_request' || n.type === 'friend_accepted');
    } else if (activeFilter === 'community') {
      list = list.filter((n) => n.type?.startsWith('community_'));
    } else if (activeFilter !== 'all') {
      list = list.filter((n) => n.type === activeFilter);
    }
    return list;
  }, [notifications, activeFilter]);

  // Sort list
  const sortedNotifications = useMemo(() => {
    const copy = [...filteredNotifications];
    copy.sort((a, b) => {
      const aRead = isItemRead(a);
      const bRead = isItemRead(b);
      if (sortMode === 'unread_first' && aRead !== bRead) {
        return aRead ? 1 : -1;
      }
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return bTime - aTime;
    });
    return copy;
  }, [filteredNotifications, sortMode]);

  // Unread vs Read items
  const unreadItems = useMemo(() => sortedNotifications.filter((n) => !isItemRead(n)), [sortedNotifications]);
  const readItems = useMemo(() => sortedNotifications.filter((n) => isItemRead(n)), [sortedNotifications]);

  // Count unread vs read items among current selection
  const selectedUnreadCount = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const item = sortedNotifications.find((n) => n.id === id);
      return item && !isItemRead(item);
    }).length;
  }, [selectedIds, sortedNotifications]);

  const selectedReadCount = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const item = sortedNotifications.find((n) => n.id === id);
      return item && isItemRead(item);
    }).length;
  }, [selectedIds, sortedNotifications]);

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedNotifications.length && sortedNotifications.length > 0) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      const validIds = sortedNotifications.map((n) => n.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
      setSelectedIds(new Set(validIds));
      setSelectionMode(true);
    }
  };

  const toggleSelectItem = (id?: string) => {
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    setSelectionMode(next.size > 0);
  };

  const handleLongPressCard = (id?: string) => {
    if (!id) return;
    setSelectionMode(true);
    toggleSelectItem(id);
  };

  const handlePromptBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDialogState({
      visible: true,
      type: 'danger',
      title: 'Delete Notifications?',
      message: `Are you sure you want to delete ${selectedIds.size} selected notification${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeDialog();
        if (!currentUserId) return;
        for (const id of selectedIds) {
          await notificationHelpers.deleteNotification(currentUserId, id);
        }
        setSelectedIds(new Set());
        setSelectionMode(false);
        await refreshNotifications();
      },
    });
  };

  const handlePromptSingleDelete = (id?: string) => {
    if (!id) return;
    setDialogState({
      visible: true,
      type: 'danger',
      title: 'Delete Notification?',
      message: 'Are you sure you want to delete this notification?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeDialog();
        if (!currentUserId) return;
        await notificationHelpers.deleteNotification(currentUserId, id);
        await refreshNotifications();
      },
    });
  };

  const handleBulkMarkRead = async () => {
    if (!currentUserId || selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const item = sortedNotifications.find((n) => n.id === id);
      if (item && !isItemRead(item)) {
        await markAsRead(id);
      }
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkMarkUnread = async () => {
    if (!currentUserId || selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const item = sortedNotifications.find((n) => n.id === id);
      if (item && isItemRead(item)) {
        await markAsUnread(id);
      }
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleItemPress = async (item: NotificationData) => {
    if (selectionMode) {
      toggleSelectItem(item.id);
      return;
    }
    if (item.id && !isItemRead(item)) {
      await markAsRead(item.id);
    }
    const username = item.userDetails?.userName || item.metadata?.sourceUserName;
    if (username) {
      onClose();
      router.push(`/profile/${username}` as any);
    } else if (item.metadata?.actionUrl) {
      onClose();
      router.push(item.metadata.actionUrl as any);
    }
  };

  const handleAcceptFriendRequest = async (item: NotificationData) => {
    const senderId = item.metadata?.sourceUserId || item.metadata?.sourceId || item.metadata?.senderId;
    const senderName = item.userDetails?.firstName || item.userDetails?.userName || 'Friend';
    if (!currentUserId || !senderId) {
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Unable to Process',
        message: 'Invalid friend request data.',
        confirmText: 'OK',
      });
      return;
    }

    try {
      let statusRes = await friendshipService.getFriendshipStatus(currentUserId, senderId);
      let fData = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;

      if (!fData?.id) {
        statusRes = await friendshipService.getFriendshipStatus(senderId, currentUserId);
        fData = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;
      }

      if (fData?.id) {
        await friendshipService.updateFriendshipStatus(fData.id, 'accepted');
      } else {
        await friendshipService.sendFriendRequest(senderId, currentUserId);
      }

      if (item.id) {
        const nid = item.id;
        await markAsRead(nid);
        setResolvedRequestIds((prev) => new Set(prev).add(nid));
      }
      await notificationHelpers.createFriendAcceptedNotification(senderId, currentUserId);
      await refreshNotifications();

      setDialogState({
        visible: true,
        type: 'success',
        title: 'Friend Request Accepted',
        message: `You and ${senderName} are now friends!`,
        confirmText: 'Great!',
      });
    } catch (e) {
      console.error('[handleAcceptFriendRequest]', e);
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Action Failed',
        message: 'Failed to accept friend request. Please try again.',
        confirmText: 'OK',
      });
    }
  };

  const handleDeclineFriendRequest = async (item: NotificationData) => {
    const senderId = item.metadata?.sourceUserId || item.metadata?.sourceId || item.metadata?.senderId;
    if (!currentUserId || !senderId) return;

    try {
      let statusRes = await friendshipService.getFriendshipStatus(currentUserId, senderId);
      let fData = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;

      if (!fData?.id) {
        statusRes = await friendshipService.getFriendshipStatus(senderId, currentUserId);
        fData = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;
      }

      if (fData?.id) {
        await friendshipService.updateFriendshipStatus(fData.id, 'declined');
      }
      if (item.id) {
        const nid = item.id;
        await markAsRead(nid);
        setResolvedRequestIds((prev) => new Set(prev).add(nid));
      }
      await refreshNotifications();
    } catch (e) {
      console.error('[handleDeclineFriendRequest]', e);
    }
  };

  const renderNotificationCard = (item: NotificationData) => {
    const isSelected = item.id ? selectedIds.has(item.id) : false;
    const itemRead = isItemRead(item);
    const isFriendRequest = item.type === 'friend_request';
    const isResolved = item.id ? resolvedRequestIds.has(item.id) : false;
    const timeAgoStr = notificationHelpers.getTimeAgo(item.createdAt);

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => void handleItemPress(item)}
        onLongPress={() => handleLongPressCard(item.id)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: 14,
          borderRadius: 16,
          marginBottom: 10,
          backgroundColor: itemRead ? '#ffffff' : '#f0fdf4',
          borderWidth: 1,
          borderColor: itemRead ? '#f1f5f9' : '#bbf7d0',
        }}
      >
        {/* Checkbox (Shows when in Selection Mode or when item is selected) */}
        {(selectionMode || selectedIds.size > 0) && (
          <TouchableOpacity onPress={() => toggleSelectItem(item.id)} style={{ paddingRight: 10, paddingTop: 10 }}>
            <Icon name={isSelected ? 'check-square' : 'square'} size={18} color={isSelected ? '#10b981' : '#cbd5e1'} />
          </TouchableOpacity>
        )}

        {/* User Avatar */}
        <UserAvatar
          profileImage={item.userDetails?.profileImage || item.metadata?.sourceProfileImage}
          firstName={item.userDetails?.firstName || item.title || 'U'}
          size={44}
        />

        {/* Card Content */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
              {item.title || notificationHelpers.formatNotificationTitle(item.type)}
            </Text>
            <TouchableOpacity onPress={() => handlePromptSingleDelete(item.id)} style={{ padding: 4 }}>
              <Icon name="trash-2" size={14} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 }}>
            {item.message || notificationHelpers.formatNotificationMessage(item.type, item.userDetails?.userName || 'Someone')}
          </Text>

          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: '500' }}>
            {timeAgoStr}
          </Text>

          {/* ── Friend Request Action Buttons / Resolved State (Web Parity) ── */}
          {isFriendRequest && (
            <View style={{ marginTop: 10 }}>
              {isResolved ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="check-circle" size={15} color="#10b981" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>
                    Request handled
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => void handleAcceptFriendRequest(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#10b981',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Icon name="check" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void handleDeclineFriendRequest(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#f1f5f9',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                    }}
                  >
                    <Icon name="x" size={15} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '700' }}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {!itemRead && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginLeft: 8, marginTop: 4 }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" />

        {/* Modern Confirmation Dialog */}
        <CustomModal
          visible={dialogState.visible}
          type={dialogState.type}
          title={dialogState.title}
          message={dialogState.message}
          confirmText={dialogState.confirmText}
          cancelText={dialogState.cancelText}
          onConfirm={dialogState.onConfirm}
          onClose={closeDialog}
        />

        {/* Modal Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 8 }}>
              <Icon name="x" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#10b981', marginLeft: 8 }}>
                  {unreadCount} unread
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={() => void markAllAsRead()} style={{ padding: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Categories Pill Bar */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#ffffff' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'friend_request', label: 'Friends' },
              { id: 'like', label: 'Likes' },
              { id: 'comment', label: 'Comments' },
              { id: 'mention', label: 'Mentions' },
              { id: 'community', label: 'Communities' },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveFilter(tab.id as FilterCategory)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor: isActive ? '#10b981' : '#f1f5f9',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#ffffff' : '#64748b' }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selection & Controls Bar */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
          backgroundColor: '#f8fafc',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Select All / Deselect All */}
            <TouchableOpacity onPress={toggleSelectAll} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <Icon
                name={selectedIds.size > 0 && selectedIds.size === sortedNotifications.length ? 'check-square' : 'square'}
                size={18}
                color={selectedIds.size > 0 ? '#10b981' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>
                {selectedIds.size === sortedNotifications.length && sortedNotifications.length > 0 ? 'Deselect all' : 'Select all'}
              </Text>
            </TouchableOpacity>

            {/* Bulk Action Buttons */}
            {selectedIds.size > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedUnreadCount > 0 && (
                  <TouchableOpacity
                    onPress={() => void handleBulkMarkRead()}
                    style={{ backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                      Mark Read ({selectedUnreadCount})
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedReadCount > 0 && (
                  <TouchableOpacity
                    onPress={() => void handleBulkMarkUnread()}
                    style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                      Mark Unread ({selectedReadCount})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handlePromptBulkDelete}
                  style={{ backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                    Delete ({selectedIds.size})
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setSortMode((s) => (s === 'unread_first' ? 'newest_first' : 'unread_first'))}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
              >
                <Icon name="sliders" size={14} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600' }}>
                  {sortMode === 'unread_first' ? 'Unread first' : 'Newest first'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content List */}
        <ScrollView
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        >
          {isLoading ? (
            <View>
              <SkeletonNotificationRow />
              <SkeletonNotificationRow />
              <SkeletonNotificationRow />
            </View>
          ) : sortedNotifications.length === 0 ? (
            <View style={{ paddingVertical: 80, alignItems: 'center' }}>
              <Icon name="bell-off" size={48} color="#cbd5e1" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 14 }}>No Notifications</Text>
              <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
                When someone likes your posts, comments, or sends friend requests, you will see them here.
              </Text>
            </View>
          ) : (
            <>
              {/* Unread Section Header */}
              {unreadItems.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981', letterSpacing: 0.5 }}>
                    UNREAD · {unreadItems.length}
                  </Text>
                </View>
              )}

              {/* Render Unread Notifications at the Top */}
              {unreadItems.map(renderNotificationCard)}

              {/* ── Web Parity "Show read notifications" / "Hide read notifications" Toggle Button ── */}
              {readItems.length > 0 && (
                <View style={{ marginTop: 16, marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => setShowReadNotifs((v) => !v)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#ffffff',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                    }}
                  >
                    <Icon name={showReadNotifs ? 'bell-off' : 'bell'} size={15} color="#64748b" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                      {showReadNotifs ? 'Hide read notifications' : 'Show read notifications'}
                    </Text>
                    <View style={{
                      marginLeft: 8,
                      backgroundColor: '#e2e8f0',
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                        {readItems.length}
                      </Text>
                    </View>
                    <Icon name={showReadNotifs ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>

                  {/* Render Read Notifications Below when Expanded */}
                  {showReadNotifs && (
                    <View style={{ marginTop: 12 }}>
                      {readItems.map(renderNotificationCard)}
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
