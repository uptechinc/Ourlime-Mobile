export const NOTIFICATION_TYPES = [
  'friend_request', 'friend_accepted', 'friend_declined', 'follow', 'like', 'comment', 'repost', 'mention',
  'community_invite', 'community_join_request', 'project_invite', 'role_change', 'community_report', 'report_action',
  'community_accepted', 'community_rejected', 'community_removed', 'event_cancelled', 'beta_management',
  'child_safety_case', 'support_ticket',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export type PushOnlyNotificationType = 'message' | 'voice_call' | 'video_call' | 'incoming_call' | 'call_state';

export type NativePushDestinationKind =
  | 'notifications'
  | 'profile'
  | 'post'
  | 'chat'
  | 'call'
  | 'community'
  | 'community_requests'
  | 'community_reports'
  | 'project'
  | 'admin_testers'
  | 'admin_report'
  | 'content'
  | 'lime'
  | 'event'
  | 'marketplace_listing'
  | 'blog'
  | 'course'
  | 'child_safety_case'
  | 'support_ticket';

export type NativePushDataV1 = {
  schemaVersion: '1';
  destinationKind: NativePushDestinationKind;
  type?: string;
  notificationId?: string;
  path?: string;
  senderId?: string;
  sourceUserId?: string;
  sourceUserName?: string;
  postId?: string;
  communityId?: string;
  projectId?: string;
  limeId?: string;
  reelId?: string;
  reportId?: string;
  eventId?: string;
  requestId?: string;
  contentId?: string;
  contentType?: string;
  chatId?: string;
  callId?: string;
  callType?: string;
  profileUserId?: string;
  rootCommentId?: string;
  commentId?: string;
  replyId?: string;
  parentReplyId?: string;
  taskId?: string;
  marketplaceListingId?: string;
  blogId?: string;
  courseId?: string;
  childSafetyReportId?: string;
  childSafetyReviewerView?: string;
  supportTicketId?: string;
  supportStaffView?: string;
};

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
  eventId?: string;
  requestId?: string;
  contentId?: string;
  contentType?: string;
  chatId?: string;
  callId?: string;
  callType?: string;
  destinationKind?: NativePushDestinationKind;
  schemaVersion?: string;
  path?: string;
  sourceProfileImage?: string;
  profileUserId?: string;
  rootCommentId?: string;
  commentId?: string;
  replyId?: string;
  parentReplyId?: string;
  taskId?: string;
  marketplaceListingId?: string;
  blogId?: string;
  courseId?: string;
  childSafetyReportId?: string;
  childSafetyReviewerView?: string;
  supportTicketId?: string;
  supportStaffView?: string;
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
  readCount?: number;
  totalCount?: number;
  nextCursor: string | null;
  hasMore: boolean;
};
