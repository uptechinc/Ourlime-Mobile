import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { notificationHelpers } from '../helpers/notificationHelpers';

export type NotificationItem = {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accept' | 'mention' | 'repost';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sourceUserId?: string;
  sourceUserName?: string;
  sourceProfileImage?: string;
  actionUrl?: string;
};

export class NotificationService {
  private static instance: NotificationService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async fetchNotifications(userId: string, maxLimit = 30): Promise<NotificationItem[]> {
    if (!userId) return [];
    this.logger.info('NotificationService', 'fetchNotifications:start', { userId });
    try {
      const rawNotifs = await notificationHelpers.getUserNotifications(userId, maxLimit);
      const notifications: NotificationItem[] = rawNotifs.map((data) => ({
        id: data.id || `notif_${Date.now()}`,
        userId: data.userId || userId,
        type: (data.type as any) || 'like',
        title: data.title || notificationHelpers.formatNotificationTitle(data.type),
        message: data.message || '',
        isRead: Boolean(data.isRead),
        createdAt: typeof data.createdAt?.toDate === 'function' 
          ? data.createdAt.toDate().toISOString() 
          : new Date().toISOString(),
        sourceUserId: data.metadata?.sourceUserId || data.metadata?.sourceId,
        sourceUserName: data.userDetails?.userName || `${data.userDetails?.firstName || ''} ${data.userDetails?.lastName || ''}`.trim(),
        sourceProfileImage: data.userDetails?.profileImage,
        actionUrl: data.metadata?.actionUrl,
      }));
      this.logger.success('NotificationService', 'fetchNotifications', { count: notifications.length });
      return notifications;
    } catch (error) {
      this.logger.error('NotificationService', 'fetchNotifications', error, { userId });
      return [];
    }
  }

  public async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      this.logger.error('NotificationService', 'markAsRead', error, { notificationId });
    }
  }

  public async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    } catch (error) {
      this.logger.error('NotificationService', 'markAllAsRead', error, { userId });
    }
  }
}
