import { db } from '@/lib/firebaseConfig';
import { 
  collection, 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc,
  serverTimestamp,
  increment,
  setDoc,
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import { NotificationData, NotificationType } from '@/lib/types/notification';
import { pushNotificationService } from '@/lib/services/PushNotificationService';

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

  // Ensure user has notification fields
  async ensureUserHasNotificationFields(userId: string): Promise<void> {
    try {
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      if (!userNotifDoc.exists()) {
        await setDoc(userNotifRef, {
          notificationsMap: {},
          notificationCount: 0,
          unreadCount: 0,
          documentSize: 0,
        });
      }
    } catch (e) {
      console.error('[notificationHelpers.ensureUserHasNotificationFields]', e);
    }
  },

  // Add a notification to the database
  async addNotification(notification: NotificationData): Promise<boolean> {
    try {
      await this.ensureUserHasNotificationFields(notification.userId);
      
      const userNotifRef = doc(db, 'userNotifications', notification.userId);
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const userNotifDoc = await getDoc(userNotifRef);
      
      const notifObj = {
        ...notification,
        id: notificationId,
        createdAt: Timestamp.now(),
      };

      if (!userNotifDoc.exists()) {
        await setDoc(userNotifRef, {
          notificationsMap: {
            [notificationId]: notifObj
          },
          notificationCount: 1,
          unreadCount: notification.isRead ? 0 : 1,
          documentSize: JSON.stringify(notification).length + 50
        });
      } else {
        await updateDoc(userNotifRef, {
          [`notificationsMap.${notificationId}`]: notifObj,
          notificationCount: increment(1),
          unreadCount: increment(notification.isRead ? 0 : 1)
        });
      }

      // Also write to items subcollection for query parity with web
      try {
        await setDoc(doc(db, 'userNotifications', notification.userId, 'items', notificationId), notifObj);
      } catch (subErr) {
        console.warn('[addNotification] items subcollection write notice:', subErr);
      }

      // Dispatch high priority device push notification to receiver's device
      void pushNotificationService.sendPushNotification(notification.userId, {
        title: notification.title || 'Ourlime Notification',
        body: notification.message || 'You have a new notification',
        type: 'message',
        senderId: notification.userDetails?.uid || notification.userDetails?.userId || '',
      });

      return true;
    } catch (error) {
      console.error('Error adding notification:', error);
      return false;
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

  // Create friend request notification
  async createFriendRequestNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    const existing = await this.getUserNotifications(targetUserId, 20);
    const alreadyExists = existing.some(n => n.type === 'friend_request' && n.metadata?.sourceUserId === sourceUserId && !n.isRead);
    if (alreadyExists) return false;

    try {
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;

      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';

      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${senderName} sent you a friend request`,
        isRead: false,
        metadata: {
          sourceId: sourceUserId,
          sourceUserId: sourceUserId,
          actionUrl: `/profile/${sourceUser.userName || sourceUserId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };

      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request notification:', error);
      return false;
    }
  },

  // Create friend request accepted notification
  async createFriendAcceptedNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    try {
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;

      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';

      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${senderName} accepted your friend request`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
          actionUrl: `/profile/${sourceUser.userName || sourceUserId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };

      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request accepted notification:', error);
      return false;
    }
  },

  // Create friend request declined notification
  async createFriendRequestDeclinedNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    try {
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;

      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';

      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'friend_declined',
        title: 'Friend Request Declined',
        message: `${senderName} declined your friend request`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };

      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request declined notification:', error);
      return false;
    }
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
