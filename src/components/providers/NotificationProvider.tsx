'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '@/types/api';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { useAuthContext } from '@/components/providers/AuthProvider';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ content: Notification[] }>(
        `/api/notifications?page=0&size=20`
      );
      setNotifications(res.data.content);
    } catch {
      // Backend may not be available
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<number>(
        `/api/notifications/unread-count`
      );
      setUnreadCount(res.data);
    } catch {
      // Backend may not be available
    }
  }, [user]);

  const markAsRead = useCallback(async (id: number) => {
    if (!user) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch {
      // Backend may not be available
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch(`/api/notifications/read-all`);
    } catch {
      // Backend may not be available
    }
  }, [user]);

  // Connect WebSocket and subscribe to notifications when user logs in
  useEffect(() => {
    if (!user) {
      wsService.disconnect();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    wsService.connect(user.id);
    fetchNotifications();
    fetchUnreadCount();

    const unsubscribe = wsService.on('notification', (data) => {
      const notification = data as Notification;
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, fetchNotifications, fetchUnreadCount]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
