import { db } from '@/lib/firebaseConfig';
import { 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc,
  deleteField
} from 'firebase/firestore';
import { NotificationData, NotificationType } from '@/lib/types/notification';
import { appServerService } from '@/lib/services/AppServerService';

type ClearableSocialNotificationType = 'friend_request' | 'follow';
export type SocialNotificationInput =
  | { kind: 'friend_request' | 'friend_accepted' | 'friend_declined' | 'follow'; targetUserId: string }
  | { kind: 'community_join_request'; communityId: string }
  | { kind: 'community_accepted' | 'community_rejected' | 'community_removed'; communityId: string; targetUserId: string };

const toTimestampMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof value === 'object') {
    const record = value as { seconds?: unknown; toMillis?: unknown; toDate?: unknown };
    if (typeof record.toMillis === 'function') return (record.toMillis as () => number)();
    if (typeof record.toDate === 'function') return (record.toDate as () => Date)().getTime();
    if (typeof record.seconds === 'number') return record.seconds * 1000;
  }
  return 0;
};

export const notificationHelpers = {
  createNotification(data: Partial<NotificationData>): NotificationData {
    return {
      userId: data.userId || '',
      type: data.type || 'mention',
      title: data.title || '',
      message: data.message || '',
      isRead: data.isRead || false,
      createdAt: data.createdAt || Timestamp.now(),
      metadata: data.metadata || {},
      userDetails: data.userDetails || {}
    };
  },

  /**
   * Friend, follow and community-membership notices go through the sendSocialNotification callable: the Firestore
   * rules let no client write another member's inbox. The server checks the relationship, builds the text and sends
   * the device push, so the caller only names the kind and the recipient (the sender is always the signed-in user).
   */
  async sendSocialNotification(input: SocialNotificationInput): Promise<boolean> {
    try {
      const result = await appServerService.call<{ sent: boolean }>('sendSocialNotification', input);
      return result.sent;
    } catch (error: unknown) {
      console.error('[notificationHelpers.sendSocialNotification] Error:', error instanceof Error ? error.message : error);
      return false;
    }
  },

  /** Removes the friend-request or follow notices the signed-in user caused in targetUserId's inbox (after the relationship ended). */
  async clearSocialNotifications(targetUserId: string, types: ClearableSocialNotificationType[]): Promise<void> {
    if (!targetUserId || types.length === 0) return;
    try {
      await appServerService.call<{ removed: number }>('clearSocialNotifications', { targetUserId, types });
    } catch (error: unknown) {
      console.error('[notificationHelpers.clearSocialNotifications] Error:', error instanceof Error ? error.message : error);
    }
  },

  // Get notifications for a user
  async getUserNotifications(userId: string, limitCount: number = 20): Promise<NotificationData[]> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      
      if (!userNotifDoc.exists()) {
        return [];
      }
      
      const data = userNotifDoc.data();
      const notificationsMap: Record<string, unknown> = data.notificationsMap || {};
      
      const notifications = Object.entries(notificationsMap)
        .flatMap(([id, value]) => {
          if (!value || typeof value !== 'object') return [];
          const notif = value as Record<string, unknown>;
          return [{
            ...notif,
            id: typeof notif.id === 'string' ? notif.id : id,
            isRead: notif.isRead === true || notif.isRead === 'true' || notif.isRead === 1,
          } as NotificationData];
        })
        .sort((a, b) => {
          const timeA = toTimestampMillis(a.createdAt);
          const timeB = toTimestampMillis(b.createdAt);
          return timeB - timeA;
        })
        .slice(0, limitCount);
      
      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) return 0;
      const data = userNotifDoc.data();
      return data.unreadCount || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  // Mark a notification as read
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) return false;

      const data = userNotifDoc.data();
      const currentUnread = data.unreadCount || 0;

      await updateDoc(userNotifRef, {
        [`notificationsMap.${notificationId}.isRead`]: true,
        unreadCount: Math.max(0, currentUnread - 1)
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Mark a notification as unread
  async markAsUnread(userId: string, notificationId: string): Promise<boolean> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) return false;

      const data = userNotifDoc.data();
      const currentUnread = data.unreadCount || 0;

      await updateDoc(userNotifRef, {
        [`notificationsMap.${notificationId}.isRead`]: false,
        unreadCount: currentUnread + 1
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      return false;
    }
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) return false;

      const data = userNotifDoc.data();
      const notificationsMap = data.notificationsMap || {};

      const updatedMap = { ...notificationsMap };
      Object.keys(updatedMap).forEach(id => {
        updatedMap[id] = { ...updatedMap[id], isRead: true };
      });

      await updateDoc(userNotifRef, {
        notificationsMap: updatedMap,
        unreadCount: 0
      });
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  },

  // Delete individual notification
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) return false;

      const data = userNotifDoc.data();
      const notifItem = data.notificationsMap?.[notificationId];
      const wasUnread = notifItem && (notifItem.isRead === false || notifItem.isRead === 'false' || notifItem.isRead === 0);
      
      await updateDoc(userNotifRef, {
        [`notificationsMap.${notificationId}`]: deleteField(),
        notificationCount: Math.max(0, (data.notificationCount || 1) - 1),
        unreadCount: wasUnread ? Math.max(0, (data.unreadCount || 1) - 1) : (data.unreadCount || 0)
      });
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  // Clear all notifications
  async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      await updateDoc(userNotifRef, {
        notificationsMap: {},
        notificationCount: 0,
        unreadCount: 0
      });
      return true;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  },

  async createFriendRequestNotification(targetUserId: string): Promise<boolean> {
    return this.sendSocialNotification({ kind: 'friend_request', targetUserId });
  },

  async createFollowNotification(targetUserId: string): Promise<boolean> {
    return this.sendSocialNotification({ kind: 'follow', targetUserId });
  },

  async createFriendAcceptedNotification(targetUserId: string): Promise<boolean> {
    return this.sendSocialNotification({ kind: 'friend_accepted', targetUserId });
  },

  async createFriendRequestDeclinedNotification(targetUserId: string): Promise<boolean> {
    return this.sendSocialNotification({ kind: 'friend_declined', targetUserId });
  },

  // Format notification title
  formatNotificationTitle(type: NotificationType): string {
    const titles: Record<string, string> = {
      friend_request: 'New Friend Request',
      friend_accepted: 'Friend Request Accepted',
      friend_declined: 'Friend Request Declined',
      follow: 'New Follower',
      like: 'New Like',
      comment: 'New Comment',
      repost: 'New Repost',
      mention: 'New Mention',
      community_invite: 'Community Invitation',
      role_change: 'Role Changed',
      community_report: 'Community Report',
      report_action: 'Report Update',
      community_accepted: 'Join Request Accepted',
      community_rejected: 'Join Request Declined',
      community_removed: 'Removed from Community',
      beta_management: 'Beta Program Update'
    };
    return titles[type] || 'New Notification';
  },

  // Format notification message
  formatNotificationMessage(type: NotificationType, actorName: string): string {
    const messages: Record<string, string> = {
      friend_request: `${actorName} sent you a friend request`,
      friend_accepted: `${actorName} accepted your friend request`,
      friend_declined: `${actorName} declined your friend request`,
      follow: `${actorName} started following you`,
      like: `${actorName} liked your post`,
      comment: `${actorName} commented on your post`,
      repost: `${actorName} reposted your post`,
      mention: `${actorName} mentioned you in a post`,
      community_invite: `${actorName} invited you to join a community`,
      role_change: `${actorName} changed your role`,
      community_report: `${actorName} reported community content`,
      report_action: `${actorName} took action on a report`,
      community_accepted: `Your request to join has been accepted`,
      community_rejected: `Your request to join has been declined`,
      community_removed: `You have been removed from the community`,
      beta_management: `Your beta access has been updated`
    };
    return messages[type] || `${actorName} interacted with you`;
  },

  // Format time ago (pure JavaScript without external libraries)
  getTimeAgo(timestamp: unknown): string {
    if (!timestamp) return 'recently';
    
    try {
      let millis = 0;
      if (typeof timestamp === 'object' && timestamp !== null && 'toMillis' in timestamp && typeof timestamp.toMillis === 'function') {
        millis = timestamp.toMillis();
      } else if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        millis = timestamp.toDate().getTime();
      } else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp && typeof timestamp.seconds === 'number') {
        millis = timestamp.seconds * 1000;
      } else if (timestamp instanceof Date) {
        millis = timestamp.getTime();
      } else if (typeof timestamp === 'number') {
        millis = timestamp;
      } else if (typeof timestamp === 'string') {
        millis = new Date(timestamp).getTime();
      }

      if (!millis || Number.isNaN(millis)) return 'recently';

      const secondsAgo = Math.max(0, Math.floor((Date.now() - millis) / 1000));
      if (secondsAgo < 10) return 'Just now';
      if (secondsAgo < 60) return `${secondsAgo}s ago`;
      const minutesAgo = Math.floor(secondsAgo / 60);
      if (minutesAgo < 60) return `${minutesAgo}m ago`;
      const hoursAgo = Math.floor(minutesAgo / 60);
      if (hoursAgo < 24) return `${hoursAgo}h ago`;
      const daysAgo = Math.floor(hoursAgo / 24);
      if (daysAgo < 30) return `${daysAgo}d ago`;
      const monthsAgo = Math.floor(daysAgo / 30);
      if (monthsAgo < 12) return `${monthsAgo}mo ago`;
      const yearsAgo = Math.floor(monthsAgo / 12);
      return `${yearsAgo}y ago`;
    } catch {
      return 'recently';
    }
  }
};

export default notificationHelpers;
