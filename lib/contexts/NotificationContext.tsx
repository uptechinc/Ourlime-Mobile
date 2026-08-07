'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import { NotificationData } from '@/lib/types/notification';

type NotificationContextType = {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAsUnread: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const userNotifRef = doc(db, 'userNotifications', user.uid);

      // Real-time Firestore snapshot listener for user notifications across the entire app
      unsubscribeSnapshot = onSnapshot(
        userNotifRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setNotifications([]);
            setUnreadCount(0);
            setIsLoading(false);
            return;
          }

          const data = snapshot.data();
          const notificationsMap = data.notificationsMap || {};

          const parsedList: NotificationData[] = Object.entries(notificationsMap)
            .map(([id, item]: [string, any]) => ({
              ...item,
              id: item.id || id,
              isRead: item.isRead === true || item.isRead === 'true' || item.isRead === 1,
            }))
            .sort((a, b) => {
              const aTime = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });

          const unreadFromDoc = typeof data.unreadCount === 'number' ? data.unreadCount : null;
          const calculatedUnread = parsedList.filter((n) => !n.isRead).length;
          const finalUnread = unreadFromDoc !== null ? Math.max(unreadFromDoc, calculatedUnread) : calculatedUnread;

          setNotifications(parsedList);
          setUnreadCount(finalUnread);
          setIsLoading(false);
        },
        (error) => {
          console.error('[NotificationContext] Snapshot listener error:', error);
          setIsLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await notificationHelpers.markAsRead(user.uid, notificationId);
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await notificationHelpers.markAsUnread(user.uid, notificationId);
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as unread:', error);
    }
  };

  const markAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await notificationHelpers.markAllAsRead(user.uid);
    } catch (error) {
      console.error('[NotificationContext] Error marking all notifications as read:', error);
    }
  };

  const refreshNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const fetched = await notificationHelpers.getUserNotifications(user.uid, 20);
      const count = await notificationHelpers.getUnreadCount(user.uid);
      setNotifications(fetched);
      setUnreadCount(count);
    } catch (e) {
      console.error('[NotificationContext] Error refreshing notifications:', e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};