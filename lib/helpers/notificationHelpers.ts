import { db } from '@/lib/firebaseConfig';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc,
  serverTimestamp,
  writeBatch,
  increment,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { NotificationData, NotificationType } from '@/lib/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { Bell, UserPlus, Heart, MessageCircle, AtSign, Users } from 'lucide-react';

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

  // Add a notification to the database
  async addNotification(notification: NotificationData): Promise<boolean> {
    try {
      // Ensure user has notification fields first
      await this.ensureUserHasNotificationFields(notification.userId);
      
      console.log('Adding notification to database:', notification);
      
      // Get a reference to the user's notification document
      const userNotifRef = doc(db, 'userNotifications', notification.userId);
      
      // Generate a unique ID for this notification
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get current document to check size
      const userNotifDoc = await getDoc(userNotifRef);
      
      if (!userNotifDoc.exists()) {
        // Create new document if it doesn't exist
        await setDoc(userNotifRef, {
          notificationsMap: {
            [notificationId]: {
              ...notification,
              id: notificationId, // Add the ID to the notification object
              createdAt: serverTimestamp()
            }
          },
          notificationCount: 1,
          unreadCount: notification.isRead ? 0 : 1,
          documentSize: JSON.stringify(notification).length + 50 // Rough estimate
        });
        console.log('Created new notification document for user:', notification.userId);
        return true;
      } else {
        // Add to current document
        await updateDoc(userNotifRef, {
          [`notificationsMap.${notificationId}`]: {
            ...notification,
            id: notificationId,
            createdAt: serverTimestamp()
          },
          notificationCount: increment(1),
          unreadCount: increment(notification.isRead ? 0 : 1)
        });
        console.log('Added notification to existing document for user:', notification.userId);
        return true;
      }
    } catch (error) {
      console.error('Error adding notification:', error);
      console.error('Notification data that failed:', notification);
      return false;
    }
  },

  // Get notifications for a user
  async getUserNotifications(userId: string, limitCount: number = 20): Promise<NotificationData[]> {
    try {
      // Get the user's notification document
      const userNotifRef = doc(db, 'userNotifications', userId);
      const userNotifDoc = await getDoc(userNotifRef);
      
      if (!userNotifDoc.exists()) {
        return [];
      }
      
      const data = userNotifDoc.data();
      const notificationsMap = data.notificationsMap || {};
      
      // Convert the map to an array, sort by createdAt, and limit to the requested count
      const notifications = Object.entries(notificationsMap)
        .map(([id, notif]: [string, any]) => ({
          ...notif,
          id
        }))
        .sort((a, b) => {
          // Sort in descending order (newest first)
          const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : a.createdAt) : 0;
          const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : b.createdAt) : 0;
          return timeB - timeA;
        })
        .slice(0, limitCount);
      
      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  // Get unread notification count for a user
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
      const notif = data.notificationsMap?.[notificationId];
      
      if (!notif) return false;
      
      // Only update if it's unread
      if (!notif.isRead) {
        // Update notification
        await updateDoc(userNotifRef, {
          [`notificationsMap.${notificationId}.isRead`]: true,
          unreadCount: increment(-1)
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return true;
      
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });
      
      // Update user's unread count
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, {
        unreadNotificationCount: 0
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  },

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  // Fix the notification creation for likes
  async createLikeNotification(targetUserId: string, postId: string, sourceUserId: string): Promise<boolean> {
    try {
      // Get source user details
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;
      
      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
      
      // Create notification data
      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'like',
        title: 'New Like',
        message: `${senderName} liked your post`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
          postId: postId,
          actionUrl: `/limes?reel=${postId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };
      
      // Create and add the notification
      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating like notification:', error);
      return false;
    }
  },

  // Fix the notification creation for friend requests
  async createFriendRequestNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    // Check for existing notification
    const existing = await this.getUserNotifications(targetUserId, 20);
    const alreadyExists = existing.some(n => n.type === 'friend_request' && n.metadata?.sourceUserId === sourceUserId && !n.isRead);
    if (alreadyExists) {
      return false;
    }
    try {
      // Get source user details
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;
      
      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
      
      // Create notification data
      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${senderName} sent you a friend request`,
        isRead: false,
        metadata: {
          sourceId: sourceUserId,
          sourceUserId: sourceUserId,
          actionUrl: `/profile/viewOtherProfile/${sourceUser.userName || sourceUserId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };
      
      // Create and add the notification
      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request notification:', error);
      return false;
    }
  },

  // Format notification title
  formatNotificationTitle(type: NotificationType): string {
    const titles = {
      friend_request: 'New Friend Request',
      friend_accepted: 'Friend Request Accepted',
      follow: 'New Follower',
      like: 'New Like',
      comment: 'New Comment',
      mention: 'New Mention',
      community_invite: 'Community Invitation'
    };
    return titles[type] || 'New Notification';
  },

  // Format notification message
  formatNotificationMessage(type: NotificationType, actorName: string): string {
    const messages = {
      friend_request: `${actorName} sent you a friend request`,
      friend_accepted: `${actorName} accepted your friend request`,
      follow: `${actorName} started following you`,
      like: `${actorName} liked your post`,
      comment: `${actorName} commented on your post`,
      mention: `${actorName} mentioned you in a post`,
      community_invite: `${actorName} invited you to join a community`
    };
    return messages[type] || `${actorName} interacted with you`;
  },

  // Get notification icon as a string
  getNotificationIcon(type: NotificationType): string {
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
        return 'user-plus';
      case 'like':
        return 'heart';
      case 'comment':
        return 'message-circle';
      case 'mention':
        return 'at-sign';
      case 'follow':
        return 'user-plus';
      case 'community_invite':
        return 'users';
      default:
        return 'bell';
    }
  },

  // Format time ago
  getTimeAgo(timestamp: any): string {
    if (!timestamp) return 'recently';
    
    try {
      // Handle Firestore Timestamp
      if (typeof timestamp.toDate === 'function') {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
      }
      
      // Handle Date object
      if (timestamp instanceof Date) {
        return formatDistanceToNow(timestamp, { addSuffix: true });
      }
      
      // Handle numeric timestamp
      if (typeof timestamp === 'number') {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
      }
      
      return 'recently';
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'recently';
    }
  },

  // Create notification for comments
  async createCommentNotification(targetUserId: string, postId: string, sourceUserId: string, commentText: string): Promise<boolean> {
    try {
      // Get source user details
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;
      
      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
      
      // Create a shorter comment preview if needed
      const commentPreview = commentText.length > 30 
        ? `${commentText.substring(0, 30)}...` 
        : commentText;
      
      // Create notification data
      const notificationData: Partial<NotificationData> = {
        userId: targetUserId,
        type: 'comment',
        title: 'New Comment',
        message: `${senderName} commented: "${commentPreview}"`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
          postId: postId,
          commentText: commentText,
          actionUrl: `/post/${postId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };
      
      // Create and add the notification
      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating comment notification:', error);
      return false;
    }
  },

  // Create notification for when a friend request is accepted
  async createFriendAcceptedNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    // Check for existing notification
    const existing = await this.getUserNotifications(targetUserId, 20);
    const alreadyExists = existing.some(n => n.type === 'friend_accepted' && n.metadata?.sourceUserId === sourceUserId && !n.isRead);
    if (alreadyExists) {
      return false;
    }
    try {
      // Get source user details (the user who accepted the request)
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;
      
      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
      
      // Create notification data
      const notificationData: Partial<NotificationData> = {
        userId: targetUserId, // The original requester gets notified
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${senderName} accepted your friend request`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
          actionUrl: `/profile/viewOtherProfile/${sourceUser.userName || sourceUserId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };
      
      // Create and add the notification
      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request accepted notification:', error);
      return false;
    }
  },

  // Create notification for when a friend request is declined
  async createFriendRequestDeclinedNotification(targetUserId: string, sourceUserId: string): Promise<boolean> {
    try {
      // Get source user details (the user who declined the request)
      const sourceUserDoc = await getDoc(doc(db, 'users', sourceUserId));
      if (!sourceUserDoc.exists()) return false;
      
      const sourceUser = sourceUserDoc.data();
      const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
      
      // Create notification data
      const notificationData: Partial<NotificationData> = {
        userId: targetUserId, // The original requester gets notified
        type: 'friend_declined',
        title: 'Friend Request Declined',
        message: `${senderName} declined your friend request`,
        isRead: false,
        metadata: {
          sourceUserId: sourceUserId,
          actionUrl: `/profile/viewOtherProfile/${sourceUser.userName || sourceUserId}`,
        },
        userDetails: {
          profileImage: sourceUser.profileImage || '',
          firstName: sourceUser.firstName || '',
          lastName: sourceUser.lastName || '',
          userName: sourceUser.userName || ''
        }
      };
      
      // Create and add the notification
      const notification = this.createNotification(notificationData);
      return await this.addNotification(notification);
    } catch (error) {
      console.error('Error creating friend request declined notification:', error);
      return false;
    }
  },

  async ensureUserHasNotificationFields(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      
      // Check if unreadNotificationCount field is undefined
      if (userData.unreadNotificationCount === undefined) {
        await updateDoc(userRef, {
          unreadNotificationCount: 0
        });
        console.log(`Added unreadNotificationCount field to user ${userId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring user has notification fields:', error);
      return false;
    }
  }
}; 