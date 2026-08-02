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
      // 서버 스냅샷을 기준으로, 스냅샷에 없는 기존 항목(fetch 중 WS로 받은
      // 더 새로운 알림 등)을 id 기준 중복 제거 후 병합 — 재연결 재동기화 대응
      setNotifications((prev) => {
        const merged = [...res.data.content];
        const ids = new Set(merged.map((n) => n.id));
        for (const n of prev) {
          if (!ids.has(n.id)) merged.push(n);
        }
        return merged.sort((a, b) => b.id - a.id);
      });
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
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
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
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.patch(`/api/notifications/read-all`);
    } catch {
      // Backend may not be available
    }
  }, [user]);

  // Connect WebSocket and subscribe to notifications when user logs in
  useEffect(() => {
    if (!user) return;

    wsService.connect(user.nickname);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnreadCount();

    const unsubscribe = wsService.on('notification', (data) => {
      const notification = data as Notification;
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // 재연결 시 끊김 동안 놓친 알림 재동기화 (REST 재조회 + id 병합)
    const unsubscribeReconnect = wsService.onReconnect(() => {
      fetchNotifications();
      fetchUnreadCount();
    });

    return () => {
      unsubscribe();
      unsubscribeReconnect();
    };
  }, [user, fetchNotifications, fetchUnreadCount]);

  // Handle logout: disconnect and clear state
  useEffect(() => {
    if (user) return;

    wsService.disconnect();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifications([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnreadCount(0);
  }, [user]);

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
