'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import { doc, collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
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

  const fetchMergedNotifications = async (userId: string) => {
    try {
      // 1. Fetch from 'notifications' collection (top level)
      const notifColRef = collection(db, 'notifications');
      const q = query(notifColRef, where('userId', '==', userId), limit(50));
      const colSnap = await getDocs(q);

      const colList: NotificationData[] = colSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || userId,
          type: data.type || 'mention',
          title: data.title || '',
          message: data.message || '',
          isRead: Boolean(data.isRead),
          createdAt: data.createdAt || new Date(),
          metadata: data.metadata || {},
          userDetails: data.userDetails || {},
        } as NotificationData;
      });

      // 2. Fetch from legacy 'userNotifications' document
      const userNotifRef = doc(db, 'userNotifications', userId);
      const docSnap = await getDocs(query(collection(db, 'userNotifications'), where('__name__', '==', userId)));

      let docList: NotificationData[] = [];
      if (!docSnap.empty) {
        const data = docSnap.docs[0].data();
        const map = data.notificationsMap || {};
        docList = Object.entries(map).map(([id, item]: [string, any]) => ({
          ...item,
          id: item.id || id,
          isRead: item.isRead === true || item.isRead === 'true' || item.isRead === 1,
        }));
      }

      // Merge and deduplicate by ID
      const notifMap = new Map<string, NotificationData>();
      [...colList, ...docList].forEach((item) => {
        if (item.id) notifMap.set(item.id, item);
      });

      const merged = Array.from(notifMap.values()).sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      const unread = merged.filter((n) => !n.isRead).length;
      setNotifications(merged);
      setUnreadCount(unread);
    } catch (err) {
      console.error('[NotificationContext] Error fetching merged notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubs.forEach((u) => u());
      unsubs = [];

      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      void fetchMergedNotifications(user.uid);

      // Realtime listener on top-level notifications collection
      const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), limit(50));
      const unsubCol = onSnapshot(
        q,
        () => void fetchMergedNotifications(user.uid),
        (err) => console.log('[NotificationContext] Col listener notice:', err)
      );
      unsubs.push(unsubCol);
    });

    return () => {
      unsubs.forEach((u) => u());
      unsubscribeAuth();
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await notificationHelpers.markAsRead(user.uid, notificationId);
      await fetchMergedNotifications(user.uid);
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await notificationHelpers.markAsUnread(user.uid, notificationId);
      await fetchMergedNotifications(user.uid);
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as unread:', error);
    }
  };

  const markAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await notificationHelpers.markAllAsRead(user.uid);
      await fetchMergedNotifications(user.uid);
    } catch (error) {
      console.error('[NotificationContext] Error marking all as read:', error);
    }
  };

  const refreshNotifications = async () => {
    const user = auth.currentUser;
    if (user) {
      await fetchMergedNotifications(user.uid);
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
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};