import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, where, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { LocalCacheService } from './LocalCacheService';
import type { NotificationData, NotificationPage } from '@/lib/types/notification';
import { usernameService } from './UsernameService';

type NotificationAction = 'read' | 'unread' | 'read-all' | 'delete';

// Firestore allows 500 writes per batch.
const WRITE_BATCH_SIZE = 450;
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
        const parseDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): NotificationData => this.toNotification(docSnap, userId);

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

        // Paginated page with cursor (the cursor is the last notification already shown).
        const cursorSnap = await getDoc(doc(parentRef, cursor));
        const q = cursorSnap.exists()
          ? query(parentRef, orderBy('createdAt', 'desc'), startAfter(cursorSnap), limit(pageLimit + 1))
          : query(parentRef, orderBy('createdAt', 'desc'), limit(pageLimit + 1));
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

  /**
   * Live watch on the newest inbox item. onChange receives the notifications that just arrived from the server
   * (same "added and not a local pending write" filter as the website), for the in-app drop-down banner.
   */
  public subscribeToInvalidation(userId: string, onChange: (arrived: NotificationData[]) => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(doc(db, 'userNotifications', userId), 'items'), orderBy('createdAt', 'desc'), limit(1)),
      (snapshot) => onChange(snapshot.docChanges()
        .filter((change) => change.type === 'added' && !change.doc.metadata.hasPendingWrites)
        .map((change) => this.toNotification(change.doc, userId))),
      onError,
    );
  }

  private toNotification(docSnap: { id: string; data: () => Record<string, unknown> }, userId: string): NotificationData {
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
  }

  public async mutate(action: NotificationAction, notificationIds: string[] = []): Promise<void> {
    const uniqueIds = [...new Set(notificationIds.filter(Boolean))];
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Please sign in again.');
    const parentRef = collection(doc(db, 'userNotifications', currentUid), 'items');

    if (action === 'read-all') {
      const unreadSnap = await getDocs(query(parentRef, where('isRead', '==', false)));
      await this.commitInChunks(unreadSnap.docs.map((d) => d.ref), (batch, ref) => batch.update(ref, { isRead: true, read: true }));
      return;
    }

    const refs = uniqueIds.map((id) => doc(parentRef, id));
    if (action === 'delete') {
      await this.commitInChunks(refs, (batch, ref) => batch.delete(ref));
    } else {
      const isRead = action === 'read';
      await this.commitInChunks(refs, (batch, ref) => batch.update(ref, { isRead, read: isRead }));
    }
  }

  private async commitInChunks(refs: DocumentReference[], apply: (batch: ReturnType<typeof writeBatch>, ref: DocumentReference) => void): Promise<void> {
    for (let index = 0; index < refs.length; index += WRITE_BATCH_SIZE) {
      const batch = writeBatch(db);
      refs.slice(index, index + WRITE_BATCH_SIZE).forEach((ref) => apply(batch, ref));
      await batch.commit();
    }
  }

  /**
   * Every notification (newest first, up to 500) so filters and "Newest first" cover the whole history rather than
   * only the pages loaded so far.
   */
  public async fetchAll(userId: string, maxItems = 500): Promise<NotificationData[]> {
    const parentRef = collection(doc(db, 'userNotifications', userId), 'items');
    const snapshot = await getDocs(query(parentRef, orderBy('createdAt', 'desc'), limit(maxItems)));
    return snapshot.docs.map((docSnap) => this.toNotification(docSnap, userId));
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
        const targetUserId = await usernameService.findUserId(userName);
        if (targetUserId) {
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
