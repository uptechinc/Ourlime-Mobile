import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { NotificationData } from '@/lib/types/notification';
import { AuthService } from '@/lib/services/AuthService';
import { NotificationService } from '@/lib/services/NotificationService';

type NotificationContextValue = {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
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
  const [userId, setUserId] = useState<string | null>(authService.getCurrentUser()?.uid ?? null);

  const refreshNotifications = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setNotifications(await notificationService.fetchNotificationData(user.uid));
    } catch (error: unknown) {
      console.error('[NotificationContext.refresh]', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => authService.subscribeToAuthState((user) => {
    setUserId(user?.uid ?? null);
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    void refreshNotifications();
  }), [refreshNotifications]);

  useEffect(() => {
    if (!userId) return;
    return notificationService.subscribe(
      userId,
      () => void refreshNotifications(),
      (error) => console.warn('[NotificationContext.subscribe]', error.message)
    );
  }, [refreshNotifications, userId]);

  const markAsRead = async (notificationId: string) => {
    const user = authService.getCurrentUser();
    if (!user) return;
    await notificationService.markLegacyAsRead(user.uid, notificationId);
    await notificationService.markAsRead(notificationId);
    await refreshNotifications();
  };

  const markAsUnread = async (notificationId: string) => {
    const user = authService.getCurrentUser();
    if (!user) return;
    await notificationService.markAsUnread(user.uid, notificationId);
    await refreshNotifications();
  };

  const markAllAsRead = async () => {
    const user = authService.getCurrentUser();
    if (!user) return;
    await notificationService.markAllLegacyAsRead(user.uid);
    await refreshNotifications();
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.filter((item) => !item.isRead).length,
      isLoading,
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
