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
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { notificationHelpers } from '../helpers/notificationHelpers';
import type { NotificationData, NotificationType } from '@/lib/types/notification';

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
        type: this.normalizeType(data.type),
        title: data.title || notificationHelpers.formatNotificationTitle(data.type),
        message: data.message || '',
        isRead: Boolean(data.isRead),
        createdAt: this.toDate(data.createdAt).toISOString(),
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

  public async fetchNotificationData(userId: string, maxLimit = 50): Promise<NotificationData[]> {
    const [topLevel, legacy] = await Promise.all([
      getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), limit(maxLimit))),
      notificationHelpers.getUserNotifications(userId, maxLimit),
    ]);
    const merged = new Map<string, NotificationData>();
    topLevel.docs.forEach((item) => merged.set(item.id, this.normalizeNotification(item.id, item.data(), userId)));
    legacy.forEach((item) => {
      const id = item.id || `legacy-${this.toDate(item.createdAt).getTime()}`;
      if (!merged.has(id)) merged.set(id, this.normalizeNotification(id, item, userId));
    });
    return Array.from(merged.values()).sort((left, right) => this.toDate(right.createdAt).getTime() - this.toDate(left.createdAt).getTime());
  }

  public subscribe(userId: string, onChange: () => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', userId), limit(50)),
      () => onChange(),
      (error) => onError(error)
    );
  }

  public async markLegacyAsRead(userId: string, notificationId: string): Promise<void> {
    await notificationHelpers.markAsRead(userId, notificationId);
  }

  public async markAsUnread(userId: string, notificationId: string): Promise<void> {
    await notificationHelpers.markAsUnread(userId, notificationId);
  }

  public async markAllLegacyAsRead(userId: string): Promise<void> {
    await notificationHelpers.markAllAsRead(userId);
    await this.markAllAsRead(userId);
  }

  private normalizeType(value: unknown): NotificationItem['type'] {
    const validTypes: NotificationItem['type'][] = ['like', 'comment', 'follow', 'friend_request', 'friend_accept', 'mention', 'repost'];
    return typeof value === 'string' && validTypes.includes(value as NotificationItem['type'])
      ? value as NotificationItem['type']
      : 'like';
  }

  private normalizeNotification(id: string, value: unknown, fallbackUserId: string): NotificationData {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata as NotificationData['metadata'] : {};
    const userDetails = record.userDetails && typeof record.userDetails === 'object' ? record.userDetails as NotificationData['userDetails'] : {};
    return {
      id,
      userId: typeof record.userId === 'string' ? record.userId : fallbackUserId,
      type: this.normalizeNotificationType(record.type),
      title: typeof record.title === 'string' ? record.title : '',
      message: typeof record.message === 'string' ? record.message : '',
      isRead: record.isRead === true || record.isRead === 'true' || record.isRead === 1,
      createdAt: record.createdAt instanceof Date || typeof record.createdAt === 'string' || typeof record.createdAt === 'number' || (record.createdAt !== null && typeof record.createdAt === 'object') ? record.createdAt as NotificationData['createdAt'] : new Date(),
      metadata,
      userDetails,
    };
  }

  private normalizeNotificationType(value: unknown): NotificationType {
    const types: NotificationType[] = ['friend_request', 'friend_accepted', 'friend_declined', 'follow', 'like', 'comment', 'mention', 'community_invite'];
    return typeof value === 'string' && types.includes(value as NotificationType) ? value as NotificationType : 'mention';
  }

  private toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    if (value && typeof value === 'object') {
      const record = value as { seconds?: unknown; toDate?: unknown };
      if (typeof record.toDate === 'function') return (record.toDate as () => Date)();
      if (typeof record.seconds === 'number') return new Date(record.seconds * 1000);
    }
    return new Date();
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
