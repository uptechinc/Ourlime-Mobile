import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { notificationHelpers } from './notificationHelpers';

export async function testNotificationSystem() {
  try {
    console.log('Testing notification system...');
    
    // 1. Test querying userNotifications collection
    const userNotificationsRef = collection(db, 'userNotifications');
    const q = query(userNotificationsRef, limit(5));
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} userNotification documents in the database`);
    
    const userNotifications = [];
    querySnapshot.forEach((doc) => {
      userNotifications.push({
        userId: doc.id,
        ...doc.data()
      });
    });
    
    console.log('Recent userNotifications:', userNotifications);
    
    // 2. Test creating a test notification
    const testUserId = prompt('Enter user ID to send a test notification to:');
    if (testUserId) {
      const result = await notificationHelpers.createNotification({
        userId: testUserId,
        type: 'like',
        title: 'Test Like Notification',
        message: 'This is a test like notification',
        isRead: false,
        metadata: {
          postId: 'test-post-id',
          sourceUserId: 'test-source-user'
        }
      });
      
      const success = await notificationHelpers.addNotification(result);
      console.log('Test notification creation result:', success);
    }
    
    return true;
  } catch (error) {
    console.error('Error testing notification system:', error);
    return false;
  }
}

// Add this function to test the notification system via browser console
export async function testLikeNotification(targetUserId: string, postId: string, currentUserId: string) {
  try {
    console.log('Testing like notification:');
    console.log('- Target user ID:', targetUserId);
    console.log('- Post ID:', postId);
    console.log('- Current user ID:', currentUserId);
    
    // Get current user details
    const userDoc = await getDoc(doc(db, 'users', currentUserId));
    if (!userDoc.exists()) {
      console.error('User not found in database');
      return false;
    }
    
    const userData = userDoc.data();
    const senderName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.userName || 'Someone';
    
    // Create notification data
    const notificationData = notificationHelpers.createNotification({
      userId: targetUserId,
      type: 'like',
      title: 'New Like',
      message: `${senderName} liked your post`,
      isRead: false,
      metadata: {
        postId: postId,
        sourceUserId: currentUserId,
        actionUrl: `/limes?reel=${postId}`
      },
      userDetails: {
        profileImage: userData.profileImage || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        userName: userData.userName || ''
      }
    });
    
    // Add notification to the database
    const result = await notificationHelpers.addNotification(notificationData);
    
    console.log('Test like notification result:', result);
    return result;
    
  } catch (error) {
    console.error('Error testing like notification:', error);
    return false;
  }
} 