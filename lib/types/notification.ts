export type NotificationType = 
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_declined'
  | 'follow'
  | 'like'
  | 'comment'
  | 'repost'
  | 'mention'
  | 'community_invite'
  | 'project_invite'
  | 'role_change'
  | 'community_report'
  | 'report_action'
  | 'community_accepted'
  | 'community_rejected'
  | 'community_removed'
  | 'beta_management';

export type PushOnlyNotificationType = 'message' | 'voice_call' | 'video_call';

export type NotificationMetadata = {
  sourceId?: string;
  sourceUserId?: string;
  actionUrl?: string;
  postId?: string;
  sourceUserName?: string;
  senderId?: string;
  communityId?: string;
  projectId?: string;
  limeId?: string;
  reelId?: string;
  reportId?: string;
  chatId?: string;
  path?: string;
  sourceProfileImage?: string;
};

export type NotificationData = {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: { seconds: number; nanoseconds?: number; toDate?: () => Date } | string | number | Date;
  metadata?: NotificationMetadata;
  userDetails?: {
    uid?: string;
    userId?: string;
    profileImage?: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
};

export type NotificationPage = {
  notifications: NotificationData[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};
