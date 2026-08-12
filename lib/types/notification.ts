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
  createdAt?: { seconds: number; nanoseconds?: number; toDate?: () => Date } | string | number | Date;
  metadata?: Record<string, unknown> & {
    sourceId?: string;
    sourceUserId?: string;
    actionUrl?: string;
    postId?: string;
    sourceUserName?: string;
    senderId?: string;
    communityId?: string;
    limeId?: string;
    reelId?: string;
    sourceProfileImage?: string;
  };
  userDetails?: {
    uid?: string;
    userId?: string;
    profileImage?: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
};
