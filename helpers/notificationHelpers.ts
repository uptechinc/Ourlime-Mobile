import { Timestamp, doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export interface NotificationData {
    id?: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: any; // Firestore Timestamp
    metadata?: {
        sourceId?: string;
        sourceUserId?: string;
        actionUrl?: string;
        userDetails?: {
            profileImage?: string;
            firstName?: string;
            lastName?: string;
        };
        [key: string]: any;
    };
    userDetails?: {
        profileImage?: string;
        firstName?: string;
        lastName?: string;
    };
}

export const notificationHelpers = {
    createNotification(data: Partial<NotificationData>): NotificationData {
        return {
            userId: data.userId || '',
            type: data.type || 'mention',
            title: data.title || '',
            message: data.message || '',
            isRead: data.isRead || false,
            createdAt: data.createdAt || Timestamp.now(),
            metadata: data.metadata || {}
        };
    },

    formatNotificationMessage(type: NotificationData['type'], actorName: string): string {
        const messages = {
            friend_request: `${actorName} sent you a friend request`,
            friend_accepted: `${actorName} accepted your friend request`,
            follow: `${actorName} started following you`,
            like: `${actorName} liked your post`,
            comment: `${actorName} commented on your post`,
            mention: `${actorName} mentioned you in a post`,
            community_invite: `${actorName} invited you to join a community`
        };
        return messages[type];
    },

    getNotificationIcon(type: NotificationData['type']): string {
        const icons = {
            friend_request: '👥',
            friend_accepted: '🤝',
            follow: '👋',
            like: '❤️',
            comment: '💬',
            mention: '@️',
            community_invite: '🌟'
        };
        return icons[type];
    },

    getTimeAgo(timestamp: Timestamp): string {
        const now = new Date().getTime();
        const notificationTime = timestamp.toDate().getTime();
        const diffInSeconds = Math.floor((now - notificationTime) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    },

    sortNotifications(notifications: NotificationData[]): NotificationData[] {
        return [...notifications].sort((a, b) => 
            b.createdAt.seconds - a.createdAt.seconds || 
            b.createdAt.nanoseconds - a.createdAt.nanoseconds
        );
    },

    groupNotificationsByDate(notifications: NotificationData[]): Record<string, NotificationData[]> {
        return notifications.reduce((groups, notification) => {
            const date = notification.createdAt.toDate().toLocaleDateString();
            return {
                ...groups,
                [date]: [...(groups[date] || []), notification]
            };
        }, {} as Record<string, NotificationData[]>);
    },

    // New functions for the map-based notification structure
    async addNotification(notification: NotificationData): Promise<boolean> {
        try {
            console.log('🔔 NOTIFICATION DEBUG: Starting addNotification with data:', JSON.stringify(notification));
            
            // Validate essential data
            if (!notification.userId) {
                console.error('🔔 NOTIFICATION ERROR: Missing userId in notification data');
                return false;
            }
            
            const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const userId = notification.userId;
            
            console.log(`🔔 NOTIFICATION DEBUG: Generated ID ${notificationId} for user ${userId}`);
            
            // Get the user's current notification document
            const userNotifRef = doc(db, 'userNotifications', userId);
            console.log(`🔔 NOTIFICATION DEBUG: Getting document at path: userNotifications/${userId}`);
            
            const userNotifDoc = await getDoc(userNotifRef);
            console.log(`🔔 NOTIFICATION DEBUG: Document exists: ${userNotifDoc.exists()}`);
            
            if (!userNotifDoc.exists()) {
                // Create first notification document
                console.log(`🔔 NOTIFICATION DEBUG: Creating new document for user ${userId}`);
                
                const newDocData = {
                    userId,
                    documentIndex: 0,
                    notificationsMap: {
                        [notificationId]: notification
                    },
                    notificationCount: 1,
                    unreadCount: notification.isRead ? 0 : 1,
                    documentSize: JSON.stringify(notification).length + 100, // Approximate size
                    nextDocumentId: null
                };
                
                console.log(`🔔 NOTIFICATION DEBUG: New document data:`, JSON.stringify(newDocData));
                
                try {
                    await setDoc(userNotifRef, newDocData);
                    console.log('🔔 NOTIFICATION DEBUG: Successfully created new notification document');
                    return true;
                } catch (setDocError) {
                    console.error('🔔 NOTIFICATION ERROR: Failed to create document:', setDocError);
                    throw setDocError;
                }
            }
            
            const data = userNotifDoc.data();
            console.log(`🔔 NOTIFICATION DEBUG: Existing document data:`, data);
            
            const estimatedNewSize = data.documentSize + JSON.stringify(notification).length + notificationId.length + 10;
            console.log(`🔔 NOTIFICATION DEBUG: Estimated new size: ${estimatedNewSize}`);
            
            // If adding this notification would approach the 1MB limit (900KB to be safe)
            if (estimatedNewSize > 900000) {
                console.log(`🔔 NOTIFICATION DEBUG: Document size limit exceeded, handling overflow`);
                // Check if we already have an overflow document
                if (data.nextDocumentId) {
                    // Modify notification to use the overflow document's userId
                    const overflowNotification = { ...notification, userId: data.nextDocumentId };
                    // Add to existing overflow document
                    return this.addNotification(overflowNotification);
                } else {
                    // Create a new overflow document
                    const newDocId = `${userId}_notifications_${data.documentIndex + 1}`;
                    
                    console.log(`🔔 NOTIFICATION DEBUG: Creating overflow document with ID ${newDocId}`);
                    
                    // Update current document to point to the new one
                    try {
                        await updateDoc(userNotifRef, {
                            nextDocumentId: newDocId
                        });
                        console.log(`🔔 NOTIFICATION DEBUG: Updated current document with nextDocumentId`);
                    } catch (updateError) {
                        console.error('🔔 NOTIFICATION ERROR: Failed to update document with nextDocumentId:', updateError);
                        throw updateError;
                    }
                    
                    // Create new document with this notification
                    try {
                        const newDocRef = doc(db, 'userNotifications', newDocId);
                        await setDoc(newDocRef, {
                            userId,
                            documentIndex: data.documentIndex + 1,
                            notificationsMap: {
                                [notificationId]: notification
                            },
                            notificationCount: 1,
                            unreadCount: notification.isRead ? 0 : 1,
                            documentSize: JSON.stringify(notification).length + 100,
                            nextDocumentId: null
                        });
                        console.log(`🔔 NOTIFICATION DEBUG: Created overflow document successfully`);
                        return true;
                    } catch (createError) {
                        console.error('🔔 NOTIFICATION ERROR: Failed to create overflow document:', createError);
                        throw createError;
                    }
                }
            } else {
                // Add to current document
                console.log(`🔔 NOTIFICATION DEBUG: Adding notification to existing document`);
                
                const updateData = {
                    [`notificationsMap.${notificationId}`]: notification,
                    notificationCount: increment(1),
                    unreadCount: increment(notification.isRead ? 0 : 1),
                    documentSize: estimatedNewSize
                };
                
                console.log(`🔔 NOTIFICATION DEBUG: Update data:`, JSON.stringify(updateData));
                
                try {
                    await updateDoc(userNotifRef, updateData);
                    console.log(`🔔 NOTIFICATION DEBUG: Successfully added notification to existing document`);
                    return true;
                } catch (updateError) {
                    console.error('🔔 NOTIFICATION ERROR: Failed to update document:', updateError);
                    throw updateError;
                }
            }
        } catch (error) {
            console.error('🔔 NOTIFICATION ERROR: Uncaught error in addNotification:', error);
            if (error.code) {
                console.error(`🔔 NOTIFICATION ERROR: Firebase error code: ${error.code}`);
            }
            if (error.message) {
                console.error(`🔔 NOTIFICATION ERROR: Error message: ${error.message}`);
            }
            return false;
        }
    },

    async getUserNotifications(userId: string, limit = 20): Promise<NotificationData[]> {
        try {
            const allNotifications: NotificationData[] = [];
            let currentDocId = userId;
            let remainingLimit = limit;
            
            // Fetch notifications from main and overflow documents
            while (currentDocId && remainingLimit > 0) {
                const docRef = doc(db, 'userNotifications', currentDocId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) break;
                
                const data = docSnap.data();
                const notificationsMap = data.notificationsMap || {};
                
                // Convert map to array and add IDs
                const notificationsArray = Object.entries(notificationsMap)
                    .map(([id, notif]) => ({ 
                        id, 
                        ...notif as NotificationData 
                    }));
                
                allNotifications.push(...notificationsArray);
                remainingLimit -= notificationsArray.length;
                
                // Move to overflow document if needed
                currentDocId = data.nextDocumentId;
            }
            
            // Sort by timestamp (newest first)
            return this.sortNotifications(allNotifications).slice(0, limit);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },

    async getUnreadCount(userId: string): Promise<number> {
        try {
            let totalUnread = 0;
            let currentDocId = userId;
            
            // Sum unread counts across all documents
            while (currentDocId) {
                const docRef = doc(db, 'userNotifications', currentDocId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) break;
                
                const data = docSnap.data();
                totalUnread += data.unreadCount || 0;
                
                // Move to overflow document if needed
                currentDocId = data.nextDocumentId;
            }
            
            return totalUnread;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    },

    async markAsRead(userId: string, notificationId: string): Promise<boolean> {
        try {
            // We need to find which document contains this notification
            let currentDocId = userId;
            
            while (currentDocId) {
                const docRef = doc(db, 'userNotifications', currentDocId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) break;
                
                const data = docSnap.data();
                const notificationsMap = data.notificationsMap || {};
                
                // Check if this document contains the notification
                if (notificationsMap[notificationId]) {
                    // Only update if it's not already read
                    if (!notificationsMap[notificationId].isRead) {
                        await updateDoc(docRef, {
                            [`notificationsMap.${notificationId}.isRead`]: true,
                            unreadCount: increment(-1)
                        });
                    }
                    return true;
                }
                
                // Move to overflow document if needed
                currentDocId = data.nextDocumentId;
            }
            
            return false; // Notification not found
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    },

    async markAllAsRead(userId: string): Promise<boolean> {
        try {
            let currentDocId = userId;
            
            while (currentDocId) {
                const docRef = doc(db, 'userNotifications', currentDocId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) break;
                
                const data = docSnap.data();
                const notificationsMap = data.notificationsMap || {};
                const updatedMap = {};
                
                // Mark all as read in the map
                Object.entries(notificationsMap).forEach(([id, notif]) => {
                    updatedMap[`notificationsMap.${id}.isRead`] = true;
                });
                
                // Update the document
                await updateDoc(docRef, {
                    ...updatedMap,
                    unreadCount: 0
                });
                
                // Move to overflow document if needed
                currentDocId = data.nextDocumentId;
            }
            
            return true;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    },

    formatNotificationTitle(type: NotificationData['type']): string {
        const titles = {
            friend_request: 'New Friend Request',
            friend_accepted: 'Friend Request Accepted',
            follow: 'New Follower',
            like: 'New Like',
            comment: 'New Comment',
            mention: 'New Mention',
            community_invite: 'Community Invitation'
        };
        return titles[type];
    },

    getActionButtonText(type: NotificationData['type']): { primary: string, secondary?: string } {
        switch (type) {
            case 'friend_request':
                return { primary: 'Accept', secondary: 'Decline' };
            case 'community_invite':
                return { primary: 'Join', secondary: 'Decline' };
            case 'mention':
            case 'comment':
                return { primary: 'View' };
            case 'like':
                return { primary: 'View Post' };
            case 'follow':
                return { primary: 'View Profile' };
            case 'friend_accepted':
                return { primary: 'Send Message' };
            default:
                return { primary: 'View' };
        }
    },

    // Add method for creating like notifications
    async createLikeNotification(targetUserId: string, postId: string, sourceUserId: string): Promise<boolean> {
        try {
            console.log(`🔔 LIKE NOTIFICATION: Starting create for target=${targetUserId}, post=${postId}, source=${sourceUserId}`);
            
            // Validate inputs
            if (!targetUserId || !sourceUserId || !postId) {
                console.error(`🔔 LIKE NOTIFICATION ERROR: Invalid inputs - targetUserId=${targetUserId}, postId=${postId}, sourceUserId=${sourceUserId}`);
                return false;
            }
            
            // Don't create notifications for self-likes
            if (targetUserId === sourceUserId) {
                console.log(`🔔 LIKE NOTIFICATION: Skipping notification for self-like (user ${sourceUserId})`);
                return true; // Return true as this is expected behavior
            }
            
            // Get source user details
            console.log(`🔔 LIKE NOTIFICATION: Fetching source user data for ID ${sourceUserId}`);
            const sourceUserRef = doc(db, 'users', sourceUserId);
            const sourceUserDoc = await getDoc(sourceUserRef);
            
            if (!sourceUserDoc.exists()) {
                console.error(`🔔 LIKE NOTIFICATION ERROR: Source user ${sourceUserId} not found in database`);
                return false;
            }
            
            const sourceUser = sourceUserDoc.data();
            console.log(`🔔 LIKE NOTIFICATION: Source user data:`, JSON.stringify({
                userName: sourceUser.userName,
                firstName: sourceUser.firstName,
                lastName: sourceUser.lastName
            }));
            
            const senderName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.userName || 'Someone';
            
            // Create notification data
            const notificationData: NotificationData = {
                userId: targetUserId,
                type: 'like',
                title: 'New Like',
                message: `${senderName} liked your post`,
                isRead: false,
                createdAt: Timestamp.now(),
                metadata: {
                    sourceUserId: sourceUserId,
                    postId: postId,
                    actionUrl: `/limes?reel=${postId}`,
                },
                userDetails: {
                    profileImage: sourceUser.profileImage || '',
                    firstName: sourceUser.firstName || '',
                    lastName: sourceUser.lastName || ''
                }
            };
            
            console.log(`🔔 LIKE NOTIFICATION: Created notification data for ${senderName}:`, JSON.stringify(notificationData));
            
            // Add the notification
            console.log(`🔔 LIKE NOTIFICATION: Calling addNotification method`);
            const result = await this.addNotification(notificationData);
            console.log(`🔔 LIKE NOTIFICATION: addNotification result: ${result}`);
            
            return result;
        } catch (error) {
            console.error('🔔 LIKE NOTIFICATION ERROR: Failed to create notification:', error);
            if (error.code) {
                console.error(`🔔 LIKE NOTIFICATION ERROR: Firebase error code: ${error.code}`);
            }
            if (error.message) {
                console.error(`🔔 LIKE NOTIFICATION ERROR: Error message: ${error.message}`);
            }
            return false;
        }
    }
};

export default notificationHelpers;
