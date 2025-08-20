'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import { NotificationData } from '@/lib/types/notification';

type NotificationContextType = {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchNotifications = useCallback(async (showLoading = true) => {
    const user = auth.currentUser;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }
    
    if (showLoading) {
    setIsLoading(true);
    }

    try {
      // Get notifications and unread count in parallel
      const [fetchedNotifications, count] = await Promise.all([
        notificationHelpers.getUserNotifications(user.uid, 20),
        notificationHelpers.getUnreadCount(user.uid)
      ]);
      
      setNotifications(fetchedNotifications);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      if (!isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [isInitialized]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
    
  // Set up polling for new notifications
  useEffect(() => {
    if (!isInitialized) return;

    // Poll without showing loading state
    const intervalId = setInterval(() => {
      fetchNotifications(false);
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchNotifications, isInitialized]);

  // Auth state change handler
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchNotifications();
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const success = await notificationHelpers.markAsRead(user.uid, notificationId);
      if (success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification
          )
        );
        
        // Update unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const success = await notificationHelpers.markAllAsRead(user.uid);
      if (success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const refreshNotifications = async () => {
    await fetchNotifications();
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications
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