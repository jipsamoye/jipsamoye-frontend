import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

const { wsMock } = vi.hoisted(() => ({
  wsMock: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(() => () => {}),
    onReconnect: vi.fn(() => () => {}),
  },
}));
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));

const { authContextRef } = vi.hoisted(() => ({
  authContextRef: { current: { user: { nickname: '테스터' }, loading: false } },
}));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authContextRef.current,
}));

import NotificationProvider, { useNotification } from '@/components/providers/NotificationProvider';
import type { Notification } from '@/types/api';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  type: 'LIKE',
  targetId: 10,
  relatedPostId: 10,
  message: '회원님의 게시글을 좋아합니다',
  senderNickname: '상대방',
  senderProfileImageUrl: null,
  isRead: false,
  createdAt: '2026-08-02T10:00:00',
  ...overrides,
});

/** api.get을 엔드포인트별로 라우팅 */
const routeApiGet = (notifications: Notification[], unreadCount: number) => {
  apiMock.get.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith('/api/notifications/unread-count')) {
      return Promise.resolve(successRes(unreadCount));
    }
    if (endpoint.startsWith('/api/notifications')) {
      return Promise.resolve(successRes({ content: notifications }));
    }
    return Promise.reject(new Error(`unexpected endpoint: ${endpoint}`));
  });
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationProvider — 재연결 재동기화', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.patch.mockReset();
    wsMock.on.mockReset();
    wsMock.on.mockReturnValue(() => {});
    wsMock.onReconnect.mockReset();
    wsMock.onReconnect.mockReturnValue(() => {});
  });

  it('마운트 시 onReconnect 핸들러를 등록하고 언마운트 시 해제한다', async () => {
    routeApiGet([], 0);
    const off = vi.fn();
    wsMock.onReconnect.mockReturnValue(off);

    const { unmount } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(wsMock.onReconnect).toHaveBeenCalledTimes(1));

    unmount();
    expect(off).toHaveBeenCalled();
  });

  it('재연결 시 알림 목록과 unread 카운트를 재조회한다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // 끊김 사이 서버에 알림 2건 추가 + unread 3으로 변경된 상황
    routeApiGet(
      [makeNotification({ id: 3 }), makeNotification({ id: 2 }), makeNotification({ id: 1 })],
      3
    );
    act(() => reconnectHandler?.());

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([3, 2, 1]);
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('재조회 결과와 기존 목록을 id 기준으로 중복 제거 병합한다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });
    let wsHandler: ((data: unknown) => void) | null = null;
    wsMock.on.mockImplementation((_channel: string, handler: (data: unknown) => void) => {
      wsHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // WS로 id 5 수신 (재조회 응답에도 포함될 알림 — 중복 케이스)
    act(() => wsHandler?.(makeNotification({ id: 5 })));
    expect(result.current.notifications.map((n) => n.id)).toEqual([5, 1]);

    // 재조회 스냅샷에도 id 5가 있음 → 병합 후 한 번만 존재해야 함
    routeApiGet([makeNotification({ id: 5 }), makeNotification({ id: 1 })], 2);
    act(() => reconnectHandler?.());

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([5, 1]);
    });
  });

  it('REST 스냅샷에 없는 기존 항목(더 새로운 WS 알림)도 병합 후 유지된다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });
    let wsHandler: ((data: unknown) => void) | null = null;
    wsMock.on.mockImplementation((_channel: string, handler: (data: unknown) => void) => {
      wsHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // 재조회 응답이 만들어진 뒤 WS로 id 9가 도착한 레이스 상황:
    // 스냅샷 [2,1] 에는 id 9가 없다
    let resolveFetch: ((v: unknown) => void) | null = null;
    apiMock.get.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/api/notifications/unread-count')) {
        return Promise.resolve(successRes(2));
      }
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    });
    act(() => reconnectHandler?.());
    act(() => wsHandler?.(makeNotification({ id: 9 })));
    act(() => {
      resolveFetch?.(
        successRes({ content: [makeNotification({ id: 2 }), makeNotification({ id: 1 })] })
      );
    });

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([9, 2, 1]);
    });
  });

  it('로그인 → 로그아웃 → 로그인 전환 시 재연결 핸들러와 상태를 올바르게 정리하고 재등록한다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);

    let wsOnUnsubscribe: (() => void) | null = null;
    wsMock.on.mockImplementation((_channel: string, _handler: (data: unknown) => void) => {
      const unsub = vi.fn();
      wsOnUnsubscribe = unsub;
      return unsub;
    });

    let reconnectUnsubscribe: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((_handler: () => void) => {
      const unsub = vi.fn();
      reconnectUnsubscribe = unsub;
      return unsub;
    });

    // ─── 로그인 상태에서 시작 ───
    const { rerender } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(wsMock.connect).toHaveBeenCalledWith('테스터'));
    expect(wsMock.on).toHaveBeenCalledTimes(1);
    expect(wsMock.onReconnect).toHaveBeenCalledTimes(1);

    // ─── 로그아웃: user → null ───
    authContextRef.current = { user: null, loading: false };
    rerender();

    await waitFor(() => {
      expect(wsOnUnsubscribe).toHaveBeenCalled();
      expect(reconnectUnsubscribe).toHaveBeenCalled();
      expect(wsMock.disconnect).toHaveBeenCalled();
    });

    // ─── 다시 로그인: null → user ───
    const previousConnectCalls = wsMock.connect.mock.calls.length;
    const previousOnCalls = wsMock.on.mock.calls.length;
    const previousOnReconnectCalls = wsMock.onReconnect.mock.calls.length;

    authContextRef.current = { user: { nickname: '테스터2' }, loading: false };
    rerender();

    await waitFor(() => {
      expect(wsMock.connect.mock.calls).toHaveLength(previousConnectCalls + 1);
      expect(wsMock.on.mock.calls).toHaveLength(previousOnCalls + 1);
      expect(wsMock.onReconnect.mock.calls).toHaveLength(previousOnReconnectCalls + 1);
      expect(wsMock.connect).toHaveBeenCalledWith('테스터2');
    });
  });
});
