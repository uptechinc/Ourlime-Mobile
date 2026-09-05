import { addDoc, collection, doc, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { LocalCacheService } from './LocalCacheService';
import type { NotificationData, NotificationPage } from '@/lib/types/notification';

type NotificationAction = 'read' | 'unread' | 'read-all' | 'delete';

const CACHE_NAMESPACE = 'notifications';
const CACHE_KEY = 'latest';
const CACHE_RETENTION_MS = 48 * 60 * 60 * 1000;

export class NotificationService {
  private static instance: NotificationService;
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly inFlight = new Map<string, Promise<NotificationPage>>();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) NotificationService.instance = new NotificationService();
    return NotificationService.instance;
  }

  public async hydrate(userId: string): Promise<NotificationPage | null> {
    if (!userId) return null;
    const cached = await this.cacheService.read<NotificationPage>(userId, CACHE_NAMESPACE, CACHE_KEY);
    return cached?.data ?? null;
  }

  public async fetchPage(userId: string, cursor: string | null = null, pageLimit = 30): Promise<NotificationPage> {
    const key = `${userId}:${cursor ?? 'head'}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const operation = (async () => {
      try {
        const parentRef = collection(doc(db, 'userNotifications', userId), 'items');

        const parseDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): NotificationData => {
          const data = docSnap.data();
          const rawCreatedAt = data.createdAt as { toDate?: () => Date } | string | undefined;
          const createdAt = rawCreatedAt && typeof rawCreatedAt === 'object' && typeof rawCreatedAt.toDate === 'function'
            ? rawCreatedAt.toDate().toISOString()
            : (typeof rawCreatedAt === 'string' ? rawCreatedAt : new Date().toISOString());
          return {
            id: docSnap.id,
            userId: typeof data.userId === 'string' ? data.userId : userId,
            type: (data.type as NotificationData['type']) || 'general',
            title: typeof data.title === 'string' ? data.title : '',
            message: typeof data.message === 'string' ? data.message : '',
            isRead: Boolean(data.isRead ?? data.read ?? false),
            createdAt,
            metadata: (data.metadata as NotificationData['metadata']) || {},
            userDetails: (data.userDetails as NotificationData['userDetails']) || undefined,
          };
        };

        if (!cursor) {
          // 1. Query all unread items first to ensure unreadCount and unread notifications are accurate
          const unreadSnap = await getDocs(query(parentRef, where('isRead', '==', false)));
          const unreadItems = unreadSnap.docs.map(parseDoc).sort((a, b) => {
            const timeA = new Date(a.createdAt as string).getTime();
            const timeB = new Date(b.createdAt as string).getTime();
            return timeB - timeA;
          });
          const totalUnreadCount = unreadItems.length;

          // 2. Query total count from server to get accurate totalReadCount
          let totalReadCount = 0;
          try {
            const totalCountSnap = await getCountFromServer(parentRef);
            const total = totalCountSnap.data().count;
            totalReadCount = Math.max(0, total - totalUnreadCount);
          } catch {
            totalReadCount = 0;
          }

          // 3. Hydrate recent read items as well so read section is immediately populated
          let readItems: NotificationData[] = [];
          if (totalReadCount > 0) {
            try {
              const recentSnap = await getDocs(query(parentRef, orderBy('createdAt', 'desc'), limit(pageLimit + 10)));
              const unreadIdSet = new Set(unreadItems.map((n) => n.id));
              readItems = recentSnap.docs
                .map(parseDoc)
                .filter((n) => n.isRead && !unreadIdSet.has(n.id))
                .sort((a, b) => {
                  const timeA = new Date(a.createdAt as string).getTime();
                  const timeB = new Date(b.createdAt as string).getTime();
                  return timeB - timeA;
                });
            } catch {
              readItems = [];
            }
          }

          const notifications = [...unreadItems, ...readItems];
          const hasMore = (totalUnreadCount + totalReadCount) > notifications.length;
          const nextCursor = hasMore && notifications.length > 0 ? notifications[notifications.length - 1]?.id ?? null : null;

          const page: NotificationPage = {
            notifications,
            unreadCount: totalUnreadCount,
            readCount: totalReadCount,
            totalCount: totalUnreadCount + totalReadCount,
            nextCursor,
            hasMore,
          };

          await this.cacheService.write(userId, CACHE_NAMESPACE, CACHE_KEY, page, { expiresAt: Date.now() + CACHE_RETENTION_MS });
          this.logger.success('NotificationService', 'fetch-page:firestore', { count: page.notifications.length, unreadCount: page.unreadCount, readCount: page.readCount, hasMore: page.hasMore });
          return page;
        }

        // Paginated page with cursor
        const q = query(parentRef, orderBy('createdAt', 'desc'), limit(pageLimit + 1));
        const snapshot = await getDocs(q);
        const notifications = snapshot.docs.slice(0, pageLimit).map(parseDoc);
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        const hasMore = snapshot.docs.length > pageLimit;
        const nextCursor = hasMore && notifications.length > 0 ? notifications[notifications.length - 1]?.id ?? null : null;

        const page: NotificationPage = {
          notifications,
          unreadCount,
          totalCount: notifications.length,
          nextCursor,
          hasMore,
        };

        this.logger.success('NotificationService', 'fetch-page:firestore:cursor', { count: page.notifications.length, hasMore: page.hasMore });
        return page;
      } catch (error: unknown) {
        this.logger.error('NotificationService', 'fetch-page:error', error, { userId, hasCursor: Boolean(cursor) });
        throw error;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, operation);
    return operation;
  }

  public subscribeToInvalidation(userId: string, onChange: () => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(doc(db, 'userNotifications', userId), 'items'), orderBy('createdAt', 'desc'), limit(1)),
      () => onChange(),
      onError,
    );
  }

  public async mutate(action: NotificationAction, notificationIds: string[] = []): Promise<void> {
    const uniqueIds = [...new Set(notificationIds.filter(Boolean))];
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const parentRef = collection(doc(db, 'userNotifications', currentUid), 'items');

    if (action === 'read-all') {
      const unreadSnap = await getDocs(query(parentRef, where('isRead', '==', false)));
      const batch = writeBatch(db);
      unreadSnap.docs.forEach((d) => batch.update(d.ref, { isRead: true, read: true }));
      await batch.commit();
      return;
    }

    const batch = writeBatch(db);
    for (const id of uniqueIds) {
      const itemDoc = doc(parentRef, id);
      if (action === 'delete') {
        batch.delete(itemDoc);
      } else if (action === 'read') {
        batch.update(itemDoc, { isRead: true, read: true });
      } else if (action === 'unread') {
        batch.update(itemDoc, { isRead: false, read: false });
      }
    }
    await batch.commit();
  }

  public markAsRead(notificationId: string): Promise<void> { return this.mutate('read', [notificationId]); }
  public markAsUnread(notificationId: string): Promise<void> { return this.mutate('unread', [notificationId]); }
  public markManyAsRead(notificationIds: string[]): Promise<void> { return this.mutate('read', notificationIds); }
  public markManyAsUnread(notificationIds: string[]): Promise<void> { return this.mutate('unread', notificationIds); }
  public markAllAsRead(): Promise<void> { return this.mutate('read-all'); }
  public delete(notificationIds: string[]): Promise<void> { return this.mutate('delete', notificationIds); }

  public async dispatchMentionNotifications(params: {
    actorUserId: string;
    actorName: string;
    actorProfileImage?: string;
    content: string;
    contentType: 'post' | 'comment' | 'lime';
    postId: string;
    commentId?: string;
  }): Promise<void> {
    const { actorUserId, actorName, actorProfileImage, content, contentType, postId, commentId } = params;
    if (!content || !actorUserId) return;
    const mentions = Array.from(content.matchAll(/@([a-zA-Z0-9._]+)/g), (match) => match[1].toLowerCase());
    const uniqueMentions = [...new Set(mentions)].filter(Boolean);
    if (uniqueMentions.length === 0) return;

    try {
      for (const userName of uniqueMentions) {
        const userQuery = query(collection(db, 'users'), where('userName', '==', userName));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const targetUserId = userSnap.docs[0].id;
          if (targetUserId !== actorUserId) {
            await addDoc(collection(db, `users/${targetUserId}/notifications`), {
              type: 'mention',
              title: 'Mentioned You',
              message: `${actorName} mentioned you in a ${contentType}`,
              isRead: false,
              read: false,
              sourceUserId: actorUserId,
              senderId: actorUserId,
              postId,
              commentId: commentId ?? null,
              contentType,
              createdAt: serverTimestamp(),
              userDetails: {
                userName: actorName,
                profileImage: actorProfileImage || null,
              },
            });
          }
        }
      }
    } catch (error: unknown) {
      this.logger.error('NotificationService', 'dispatchMentionNotifications', error);
    }
  }

  public mergePages(current: NotificationData[], next: NotificationData[]): NotificationData[] {
    const merged = new Map(current.map((notification) => [notification.id ?? '', notification]));
    next.forEach((notification) => merged.set(notification.id ?? '', notification));
    merged.delete('');
    return Array.from(merged.values());
  }
}

export const notificationService = NotificationService.getInstance();
