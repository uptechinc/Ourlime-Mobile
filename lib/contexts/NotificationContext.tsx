import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NotificationData } from '@/lib/types/notification';
import { AuthService } from '@/lib/services/AuthService';
import { NotificationService } from '@/lib/services/NotificationService';

type NotificationContextValue = {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  deleteNotifications: (notificationIds: string[]) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAsUnread: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

type NotificationProviderProps = { children: ReactNode };

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const authService = AuthService.getInstance();
const notificationService = NotificationService.getInstance();

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(authService.getVerifiedCurrentUser()?.uid ?? null);
  const hasDataRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const didReceiveInitialInvalidationRef = useRef(false);

  const refreshNotifications = useCallback((): Promise<void> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const operation = (async () => {
      const user = authService.getVerifiedCurrentUser();
      if (!user) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }
      if (!hasDataRef.current) setIsLoading(true);
      try {
        const page = await notificationService.fetchPage(user.uid);
        setNotifications(page.notifications);
        hasDataRef.current = true;
        setUnreadCount(page.unreadCount);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } finally {
        setIsLoading(false);
      }
    })().catch(() => undefined).finally(() => {
      refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = operation;
    return operation;
  }, []);

  useEffect(() => authService.subscribeToVerifiedAuthState((user) => {
    setUserId(user?.uid ?? null);
    didReceiveInitialInvalidationRef.current = false;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
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
      () => {
        if (!didReceiveInitialInvalidationRef.current) {
          didReceiveInitialInvalidationRef.current = true;
          return;
        }
        void refreshNotifications();
      },
      (error) => console.warn('[NotificationContext.subscribe]', error.message)
    );
  }, [refreshNotifications, userId]);

  const markAsRead = async (notificationId: string) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAsRead(notificationId);
    await refreshNotifications();
  };

  const markAsUnread = async (notificationId: string) => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAsUnread(notificationId);
    await refreshNotifications();
  };

  const markAllAsRead = async () => {
    const user = authService.getVerifiedCurrentUser();
    if (!user) return;
    await notificationService.markAllAsRead();
    await refreshNotifications();
  };

  const loadMore = async () => {
    const user = authService.getVerifiedCurrentUser();
    if (!user || !nextCursor || !hasMore) return;
    const page = await notificationService.fetchPage(user.uid, nextCursor);
    setNotifications((current) => notificationService.mergePages(current, page.notifications));
    setUnreadCount(page.unreadCount);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    await notificationService.delete(notificationIds);
    await refreshNotifications();
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      hasMore,
      loadMore,
      deleteNotifications,
      markAsRead,
      markAsUnread,
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
