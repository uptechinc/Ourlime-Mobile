import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NotificationData } from '@/lib/types/notification';
import { AuthService } from '@/lib/services/AuthService';
import { NotificationService } from '@/lib/services/NotificationService';
import { inAppNotificationService } from '@/lib/services/InAppNotificationService';
import { notificationDestinationRegistry } from '@/lib/navigation/NotificationDestinationRegistry';

type NotificationContextValue = {
  notifications: NotificationData[];
  unreadCount: number;
  readCount: number;
  totalCount: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  deleteNotifications: (notificationIds: string[]) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAsUnread: (notificationId: string) => Promise<void>;
  markManyAsRead: (notificationIds: string[]) => Promise<void>;
  markManyAsUnread: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

type NotificationProviderProps = { children: ReactNode };

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const authService = AuthService.getInstance();
const notificationService = NotificationService.getInstance();

/**
 * Runs refreshes one at a time. A refresh that started before a change (e.g. the live listener firing the moment a
 * delete is queued) reads the old list, so a request made while one is running gets a fresh run afterwards instead
 * of that stale result.
 */
function createRefreshQueue(run: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | null = null;
  let followUp: Promise<void> | null = null;
  const request = (): Promise<void> => {
    if (current) {
      followUp ??= current.then(() => {
        followUp = null;
        return request();
      });
      return followUp;
    }
    current = run().then(() => { current = null; }, () => { current = null; });
    return current;
  };
  return request;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(authService.getVerifiedCurrentUser()?.uid ?? null);
  const hasDataRef = useRef(false);
  const didReceiveInitialInvalidationRef = useRef(false);

  const [refreshNotifications] = useState(() => createRefreshQueue(async () => {
      const user = authService.getVerifiedCurrentUser();
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setReadCount(0);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }
      if (!hasDataRef.current) setIsLoading(true);
      try {
        const page = await notificationService.fetchPage(user.uid);
        setNotifications(page.notifications);
        hasDataRef.current = true;
        setUnreadCount(page.unreadCount);
        setReadCount(page.readCount ?? 0);
        setTotalCount(page.totalCount ?? (page.unreadCount + (page.readCount ?? 0)));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (error: unknown) {
        console.warn('[NotificationContext.refreshNotifications] Error:', error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
  }));

  useEffect(() => authService.subscribeToVerifiedAuthState((user) => {
    setUserId(user?.uid ?? null);
    didReceiveInitialInvalidationRef.current = false;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setReadCount(0);
      setTotalCount(0);
      setNextCursor(null);
      setHasMore(false);
      hasDataRef.current = false;
      setIsLoading(false);
      return;
    }
    void notificationService.hydrate(user.uid).then((cached) => {
      if (cached) {
        setNotifications(cached.notifications);
        hasDataRef.current = true;
        setUnreadCount(cached.unreadCount);
        setReadCount(cached.readCount ?? 0);
        setTotalCount(cached.totalCount ?? (cached.unreadCount + (cached.readCount ?? 0)));
        setNextCursor(cached.nextCursor);
        setHasMore(cached.hasMore);
        setIsLoading(false);
      }
      return refreshNotifications();
    });
  }), [refreshNotifications]);

  useEffect(() => {
    if (!userId) return;
    return notificationService.subscribeToInvalidation(
      userId,
      (arrived) => {
        if (!didReceiveInitialInvalidationRef.current) {
          didReceiveInitialInvalidationRef.current = true;
          return;
        }
        // Drop-down banner for each new notification (likes, comments, friend requests, ...).
        arrived.filter((notification) => !notification.isRead).forEach((notification) => {
          const metadata = notification.metadata ?? {};
          const avatarUrl = typeof metadata.sourceProfileImage === 'string' ? metadata.sourceProfileImage
            : typeof notification.userDetails?.profileImage === 'string' ? notification.userDetails.profileImage : null;
          inAppNotificationService.showNotification({
            id: `notification:${notification.id}`,
            kind: 'notification',
            title: notification.title || 'Ourlime',
            body: notification.message,
            avatarUrl,
            destination: notificationDestinationRegistry.normalize({ ...metadata, type: notification.type, notificationId: notification.id }),
          });
        });
        void refreshNotifications();
      },
      (error) => console.warn('[NotificationContext.subscribe]', error.message)
    );
  }, [refreshNotifications, userId]);

  /** Applies a confirmed change to the list straight away (the follow-up refresh then syncs with the server). */
  const applyLocalChange = (change: { removeIds?: string[]; readIds?: string[]; unreadIds?: string[]; allRead?: boolean }): void => {
    const removeIds = new Set(change.removeIds ?? []);
    const readIds = new Set(change.readIds ?? []);
    const unreadIds = new Set(change.unreadIds ?? []);
    setNotifications((current) => {
      const next = current
        .filter((notification) => !notification.id || !removeIds.has(notification.id))
        .map((notification) => {
          if (change.allRead || (notification.id && readIds.has(notification.id))) return { ...notification, isRead: true };
          if (notification.id && unreadIds.has(notification.id)) return { ...notification, isRead: false };
          return notification;
        });
      const removedUnread = current.filter((notification) => notification.id && removeIds.has(notification.id) && !notification.isRead).length;
      const removedRead = current.filter((notification) => notification.id && removeIds.has(notification.id) && notification.isRead).length;
      const nowRead = change.allRead ? current.filter((notification) => !notification.isRead).length : current.filter((notification) => notification.id && readIds.has(notification.id) && !notification.isRead).length;
      const nowUnread = current.filter((notification) => notification.id && unreadIds.has(notification.id) && notification.isRead).length;
      setUnreadCount((count) => change.allRead ? 0 : Math.max(0, count - removedUnread - nowRead + nowUnread));
      setReadCount((count) => Math.max(0, count - removedRead + nowRead - nowUnread));
      setTotalCount((count) => Math.max(0, count - removedUnread - removedRead));
      return next;
    });
  };

  const markAsRead = async (notificationId: string) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAsRead(notificationId);
    applyLocalChange({ readIds: [notificationId] });
    await refreshNotifications();
  };

  const markAsUnread = async (notificationId: string) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAsUnread(notificationId);
    applyLocalChange({ unreadIds: [notificationId] });
    await refreshNotifications();
  };

  const markAllAsRead = async () => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAllAsRead();
    applyLocalChange({ allRead: true });
    await refreshNotifications();
  };

  const markManyAsRead = async (notificationIds: string[]) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user || notificationIds.length === 0) return;
    await notificationService.markManyAsRead(notificationIds);
    applyLocalChange({ readIds: notificationIds });
    await refreshNotifications();
  };

  const markManyAsUnread = async (notificationIds: string[]) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user || notificationIds.length === 0) return;
    await notificationService.markManyAsUnread(notificationIds);
    applyLocalChange({ unreadIds: notificationIds });
    await refreshNotifications();
  };

  const loadMore = async () => {
    const user = authService.getVerifiedCurrentUser();
    if (!user || !nextCursor || !hasMore) return;
    const page = await notificationService.fetchPage(user.uid, nextCursor);
    setNotifications((current) => notificationService.mergePages(current, page.notifications));
    setUnreadCount(page.unreadCount);
    setReadCount(page.readCount ?? 0);
    setTotalCount(page.totalCount ?? (page.unreadCount + (page.readCount ?? 0)));
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    await notificationService.delete(notificationIds);
    applyLocalChange({ removeIds: notificationIds });
    await refreshNotifications();
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      readCount,
      totalCount,
      isLoading,
      hasMore,
      loadMore,
      deleteNotifications,
      markAsRead,
      markAsUnread,
      markManyAsRead,
      markManyAsUnread,
      markAllAsRead,
      refreshNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
