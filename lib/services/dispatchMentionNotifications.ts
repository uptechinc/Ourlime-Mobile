import { NotificationService } from './NotificationService';

const notificationService = NotificationService.getInstance();

export async function dispatchMentionNotifications(params: {
  actorUserId: string;
  actorName: string;
  actorProfileImage?: string;
  content: string;
  contentType: 'post' | 'comment' | 'lime';
  postId: string;
  commentId?: string;
}): Promise<void> {
  return notificationService.dispatchMentionNotifications(params);
}
