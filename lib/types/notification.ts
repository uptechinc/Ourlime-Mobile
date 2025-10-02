export type NotificationType = 
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_declined'
  | 'follow'
  | 'like'
  | 'comment'
  | 'mention'
  | 'community_invite';

export type NotificationData = {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any; // Firestore Timestamp
  metadata?: {
    sourceId?: string;
    sourceUserId?: string;
    actionUrl?: string;
    postId?: string;
    [key: string]: any;
  };
  userDetails?: {
    profileImage?: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
}; 