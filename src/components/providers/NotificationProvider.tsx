'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '@/types/api';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { isNotification } from '@/lib/wsGuards';
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
  const { user, clearSession } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // WS 세션 만료 통지 시 호출할 동작을 ref로 보관 (마운트 1회 등록 effect에서 최신값 참조)
  const onSessionExpiredRef = useRef(clearSession);
  useEffect(() => {
    onSessionExpiredRef.current = clearSession;
  }, [clearSession]);

  // 현재 알림 id 집합 — 실시간 수신 dedup용. notifications와 항상 동기화한다(M-6).
  const notificationIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    notificationIdsRef.current = new Set(notifications.map((n) => n.id));
  }, [notifications]);

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

  // fetch 함수를 ref로 미러링 — 연결 effect 의존성을 user.nickname(원시값)으로 좁혀
  // 함수 정체성 변화로 인한 불필요한 재연결/재구독을 막는다 (M-6).
  const fetchNotificationsRef = useRef(fetchNotifications);
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
    fetchUnreadCountRef.current = fetchUnreadCount;
  }, [fetchNotifications, fetchUnreadCount]);

  // WS 세션 만료/인증 거부 통지 → 세션 정리 + 로그아웃 (마운트 1회 등록)
  useEffect(() => {
    wsService.setAuthExpiredHandler(() => {
      onSessionExpiredRef.current();
    });
    return () => wsService.setAuthExpiredHandler(null);
  }, []);

  // Connect WebSocket and subscribe to notifications when user logs in.
  // 의존성을 user.nickname(원시값)으로 좁혀 user 객체 정체성 변화에 재실행되지 않게 한다.
  const userNickname = user?.nickname ?? null;
  useEffect(() => {
    if (!userNickname) {
      wsService.disconnect();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    wsService.connect(userNickname);
    fetchNotificationsRef.current();
    fetchUnreadCountRef.current();

    const unsubscribe = wsService.on('notification', (data) => {
      // 런타임 검증 — 형태가 어긋난 페이로드는 무시
      if (!isNotification(data)) return;
      const notification = data;
      // id 기반 dedup — 재구독/재전송 시 중복 누적 방지 (M-6).
      // 현재 알림 목록의 id 집합(idsRef)으로 중복 여부를 판정해
      // setNotifications 업데이터 안에서 setUnreadCount를 중첩 호출하지 않는다.
      if (notificationIdsRef.current.has(notification.id)) return;
      notificationIdsRef.current.add(notification.id);
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.isRead) {
        setUnreadCount((c) => c + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userNickname]);

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
