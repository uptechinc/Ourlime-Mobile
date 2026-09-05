import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter, type Href } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { AuthService } from '@/lib/services/AuthService';
import { SkeletonNotificationRow } from './SkeletonLoaders';
import type { NotificationData } from '@/lib/types/notification';
import { notificationDestinationRegistry } from '@/lib/navigation/NotificationDestinationRegistry';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

type NotificationsModalProps = {
  visible?: boolean;
  onClose: () => void;
  mode?: 'modal' | 'screen';
  initialNotificationId?: string;
};

const relationshipService = RelationshipService.getInstance();
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

const getNotificationTime = (createdAt: NotificationData['createdAt']): number => {
  if (!createdAt) return 0;
  if (typeof createdAt === 'object' && 'seconds' in createdAt) return createdAt.seconds * 1000;
  return new Date(createdAt).getTime();
};

export default function NotificationsModal({ visible = true, onClose, mode = 'modal', initialNotificationId }: NotificationsModalProps) {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const swipeDismiss = useSwipeDismiss({ visible: visible && mode === 'modal', onDismiss: onClose });
  const { notifications, unreadCount, readCount, isLoading, hasMore, loadMore, markAsRead, markManyAsRead, markManyAsUnread, markAllAsRead, deleteNotifications, refreshNotifications } = useNotifications();

  const [sortMode, setSortMode] = useState<SortMode>('unread_first');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showReadNotifs, setShowReadNotifs] = useState(false);
  const [isUnreadExpanded, setIsUnreadExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [bulkLoadingAction, setBulkLoadingAction] = useState<'read' | 'unread' | 'delete' | null>(null);

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

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try { await loadMore(); } finally { setLoadingMore(false); }
  };

  const handleToggleRead = async () => {
    if (!showReadNotifs && readItems.length === 0 && hasMore) {
      setLoadingMore(true);
      try {
        await loadMore();
      } finally {
        setLoadingMore(false);
      }
    }
    setShowReadNotifs((prev) => !prev);
  };

  const closeDialog = () => setDialogState((prev) => ({ ...prev, visible: false }));

  // Strict normalization helper
  const isItemRead = (notification: NotificationData) => notification.isRead;

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
      const aTime = getNotificationTime(a.createdAt);
      const bTime = getNotificationTime(b.createdAt);
      return bTime - aTime;
    });
    return copy;
  }, [filteredNotifications, sortMode]);

  // Unread vs Read items
  const unreadItems = useMemo(() => sortedNotifications.filter((n) => !isItemRead(n)), [sortedNotifications]);
  const readItems = useMemo(() => sortedNotifications.filter((n) => isItemRead(n)), [sortedNotifications]);

  const displayReadCount = useMemo(() => {
    if (activeFilter === 'all' || activeFilter === 'unread') {
      return readCount;
    }
    return readItems.length;
  }, [activeFilter, readCount, readItems.length]);

  const displayUnreadCount = useMemo(() => {
    if (activeFilter === 'all' || activeFilter === 'unread') {
      return unreadCount;
    }
    return unreadItems.length;
  }, [activeFilter, unreadCount, unreadItems.length]);

  // Visible notifications currently shown in the list
  const visibleNotifications = useMemo(() => {
    if (sortMode === 'newest_first') return sortedNotifications;
    const items: NotificationData[] = [];
    if (isUnreadExpanded) items.push(...unreadItems);
    if (showReadNotifs) items.push(...readItems);
    return items;
  }, [sortMode, sortedNotifications, isUnreadExpanded, unreadItems, showReadNotifs, readItems]);

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
    const targetItems = visibleNotifications;
    if (selectedIds.size > 0 && selectedIds.size >= targetItems.length && targetItems.length > 0) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      const validIds = targetItems.map((n) => n.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
      setSelectedIds(new Set(validIds));
      setSelectionMode(validIds.length > 0);
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
    if (selectedIds.size === 0 || bulkLoadingAction !== null) return;
    setDialogState({
      visible: true,
      type: 'danger',
      title: 'Delete Notifications?',
      message: `Are you sure you want to delete ${selectedIds.size} selected notification${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        if (!currentUserId) return;
        setBulkLoadingAction('delete');
        try {
          await deleteNotifications(Array.from(selectedIds));
          setSelectedIds(new Set());
          setSelectionMode(false);
          closeDialog();
        } catch (error: unknown) {
          closeDialog();
          setDialogState({ visible: true, type: 'error', title: 'Notifications not deleted', message: error instanceof Error ? error.message : 'The selected notifications could not be deleted.', confirmText: 'OK' });
        } finally {
          setBulkLoadingAction(null);
        }
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
        try {
          await deleteNotifications([id]);
        } catch (error: unknown) {
          setDialogState({ visible: true, type: 'error', title: 'Notification not deleted', message: error instanceof Error ? error.message : 'The notification could not be deleted.', confirmText: 'OK' });
        }
      },
    });
  };

  const handleBulkMarkRead = async () => {
    if (!currentUserId || selectedIds.size === 0 || bulkLoadingAction !== null) return;
    const unreadIds = Array.from(selectedIds).filter((id) => sortedNotifications.some((notification) => notification.id === id && !isItemRead(notification)));
    if (unreadIds.length === 0) return;
    setBulkLoadingAction('read');
    try {
      await markManyAsRead(unreadIds);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (error: unknown) {
      setDialogState({ visible: true, type: 'error', title: 'Notifications not updated', message: error instanceof Error ? error.message : 'The selected notifications could not be marked as read.', confirmText: 'OK' });
    } finally {
      setBulkLoadingAction(null);
    }
  };

  const handleBulkMarkUnread = async () => {
    if (!currentUserId || selectedIds.size === 0 || bulkLoadingAction !== null) return;
    const readIds = Array.from(selectedIds).filter((id) => sortedNotifications.some((notification) => notification.id === id && isItemRead(notification)));
    if (readIds.length === 0) return;
    setBulkLoadingAction('unread');
    try {
      await markManyAsUnread(readIds);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (error: unknown) {
      setDialogState({ visible: true, type: 'error', title: 'Notifications not updated', message: error instanceof Error ? error.message : 'The selected notifications could not be marked as unread.', confirmText: 'OK' });
    } finally {
      setBulkLoadingAction(null);
    }
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
    const destinationData = {
      ...item.metadata,
      type: item.type,
      notificationId: item.id,
      userName: username,
      path: item.metadata?.actionUrl,
    };
    const destination = notificationDestinationRegistry.resolve(notificationDestinationRegistry.normalize(destinationData));
    const destinationPathname = typeof destination.route === 'string'
      ? destination.route.split(/[?#]/)[0]
      : typeof destination.route === 'object' && 'pathname' in destination.route
        ? destination.route.pathname
        : '';
    if (mode === 'screen' && destinationPathname === '/notifications') return;
    if (mode === 'modal') onClose();
    router.push(destination.route);
  };

  const handleViewAll = () => {
    onClose();
    router.push('/notifications' as Href);
  };

  const handleMarkAllRead = async (): Promise<void> => {
    if (unreadCount === 0 || markingAllRead) return;
    setMarkingAllRead(true);
    try {
      await markAllAsRead();
    } catch (error: unknown) {
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Notifications not updated',
        message: error instanceof Error ? error.message : 'Notifications could not be marked as read.',
        confirmText: 'OK',
      });
    } finally {
      setMarkingAllRead(false);
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
      await relationshipService.respondToFriendRequest(senderId, currentUserId, 'accept');

      if (item.id) {
        const nid = item.id;
        await markAsRead(nid);
        setResolvedRequestIds((prev) => new Set(prev).add(nid));
      }
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
      await relationshipService.respondToFriendRequest(senderId, currentUserId, 'decline');
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
          backgroundColor: itemRead ? colors.surface : colors.successSurface,
          borderWidth: 1,
          borderColor: item.id === initialNotificationId ? colors.accent : itemRead ? colors.border : colors.successText,
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
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              {item.title || notificationHelpers.formatNotificationTitle(item.type)}
            </Text>
            <TouchableOpacity onPress={() => handlePromptSingleDelete(item.id)} style={{ padding: 4 }}>
              <Icon name="trash-2" size={14} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: colors.secondaryText, marginTop: 4, lineHeight: 18 }}>
            {item.message || notificationHelpers.formatNotificationMessage(item.type, item.userDetails?.userName || 'Someone')}
          </Text>

          <Text style={{ fontSize: 11, color: colors.mutedText, marginTop: 6, fontWeight: '500' }}>
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
                      backgroundColor: colors.control,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon name="x" size={15} color={colors.icon} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '700' }}>Decline</Text>
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

  const workspace = (
      <Animated.View style={[{ flex: 1 }, mode === 'modal' ? swipeDismiss.animatedStyle : undefined]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
        {mode === 'modal' ? <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close notifications" /> : null}

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
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={mode === 'screen' ? 'Go back' : 'Close notifications'} onPress={onClose} hitSlop={8} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
              <Icon name={mode === 'screen' ? 'arrow-left' : 'x'} size={24} color={colors.icon} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>Notifications</Text>
          </View>

          <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {mode === 'modal' ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="View all notifications"
                onPress={handleViewAll}
                hitSlop={6}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accentText }}>View all</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              accessibilityState={{ disabled: unreadCount === 0 || markingAllRead, busy: markingAllRead }}
              disabled={unreadCount === 0 || markingAllRead}
              onPress={() => void handleMarkAllRead()}
              hitSlop={6}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, opacity: unreadCount === 0 ? 0.45 : 1 }}
            >
              {markingAllRead ? <ActivityIndicator size="small" color="#10b981" /> : <Icon name="check-circle" size={21} color="#10b981" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Categories Pill Bar */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
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
                    backgroundColor: isActive ? colors.selectedControl : colors.control,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? colors.selectedText : colors.secondaryText }}>
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
          borderBottomColor: colors.border,
          backgroundColor: colors.canvas,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Select All / Deselect All */}
            <TouchableOpacity onPress={toggleSelectAll} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <Icon
                name={selectedIds.size > 0 && selectedIds.size === visibleNotifications.length ? 'check-square' : 'square'}
                size={18}
                color={selectedIds.size > 0 ? '#10b981' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={{ fontSize: 13, color: colors.secondaryText, fontWeight: '700' }}>
                {selectedIds.size === visibleNotifications.length && visibleNotifications.length > 0 ? 'Deselect all' : 'Select all'}
              </Text>
            </TouchableOpacity>

            {/* Bulk Action Buttons */}
            {selectedIds.size > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedUnreadCount > 0 && (
                  <TouchableOpacity
                    disabled={bulkLoadingAction !== null}
                    onPress={() => void handleBulkMarkRead()}
                    style={{
                      backgroundColor: '#10b981',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      opacity: bulkLoadingAction !== null ? 0.6 : 1,
                    }}
                  >
                    {bulkLoadingAction === 'read' ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : null}
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                      Mark Read ({selectedUnreadCount})
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedReadCount > 0 && (
                  <TouchableOpacity
                    disabled={bulkLoadingAction !== null}
                    onPress={() => void handleBulkMarkUnread()}
                    style={{
                      backgroundColor: '#3b82f6',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      opacity: bulkLoadingAction !== null ? 0.6 : 1,
                    }}
                  >
                    {bulkLoadingAction === 'unread' ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : null}
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                      Mark Unread ({selectedReadCount})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  disabled={bulkLoadingAction !== null}
                  onPress={handlePromptBulkDelete}
                  style={{
                    backgroundColor: '#ef4444',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    opacity: bulkLoadingAction !== null ? 0.6 : 1,
                  }}
                >
                  {bulkLoadingAction === 'delete' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : null}
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
                <Text style={{ fontSize: 13, color: colors.mutedText, fontWeight: '600' }}>
                  {sortMode === 'unread_first' ? 'Unread first' : 'Newest first'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content List */}
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.canvas }}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
          onScroll={({ nativeEvent }) => {
            const remaining = nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height;
            if (remaining < 180) void handleLoadMore();
          }}
          scrollEventThrottle={200}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 14 }}>No Notifications</Text>
              <Text style={{ fontSize: 14, color: colors.mutedText, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
                When someone likes your posts, comments, or sends friend requests, you will see them here.
              </Text>
            </View>
          ) : (
            <>
              {sortMode === 'unread_first' ? (
                <>
                  {/* ── Unread Collapsible Section ── */}
                  {unreadItems.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={() => setIsUnreadExpanded((v) => !v)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
                          marginBottom: isUnreadExpanded ? 10 : 4,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 8 }} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981', letterSpacing: 0.5 }}>
                            UNREAD
                          </Text>
                          <View
                            style={{
                              marginLeft: 8,
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                              borderRadius: 10,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>
                              {displayUnreadCount}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10b981', marginRight: 4 }}>
                            {isUnreadExpanded ? 'Collapse' : 'Expand'}
                          </Text>
                          <Icon name={isUnreadExpanded ? 'chevron-up' : 'chevron-down'} size={15} color="#10b981" />
                        </View>
                      </TouchableOpacity>

                      {/* Render Unread Notifications when Expanded */}
                      {isUnreadExpanded && unreadItems.map(renderNotificationCard)}
                    </View>
                  )}

                  {/* ── Read Collapsible Section ── */}
                  {(displayReadCount > 0 || readItems.length > 0) && (
                    <View style={{ marginTop: unreadItems.length > 0 ? 8 : 0, marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => void handleToggleRead()}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.surface,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          marginBottom: showReadNotifs ? 10 : 0,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8', marginRight: 8 }} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.secondaryText, letterSpacing: 0.5 }}>
                            READ
                          </Text>
                          <View
                            style={{
                              marginLeft: 8,
                              backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#e2e8f0',
                              borderRadius: 10,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText }}>
                              {displayReadCount}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginRight: 4 }}>
                            {showReadNotifs ? 'Collapse' : 'Expand'}
                          </Text>
                          {loadingMore && !showReadNotifs && readItems.length === 0 ? (
                            <ActivityIndicator size="small" color={colors.secondaryText} style={{ transform: [{ scale: 0.8 }] }} />
                          ) : (
                            <Icon name={showReadNotifs ? 'chevron-up' : 'chevron-down'} size={15} color={colors.secondaryText} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Render Read Notifications Below when Expanded */}
                      {showReadNotifs && (
                        <View style={{ marginTop: 10 }}>
                          {readItems.map(renderNotificationCard)}
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                /* Pure chronological newest first */
                sortedNotifications.map(renderNotificationCard)
              )}
              {loadingMore ? <ActivityIndicator color="#10b981" style={{ marginVertical: 16 }} /> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      </Animated.View>
  );

  if (mode === 'screen') return workspace;

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      {workspace}
    </Modal>
  );
}
