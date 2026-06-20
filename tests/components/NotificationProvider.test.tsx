import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { useNotification } from '@/components/providers/NotificationProvider';
import NotificationProvider from '@/components/providers/NotificationProvider';
import type { Notification } from '@/types/api';

// ─── api mock ─────────────────────────────────────────────────────────────────
const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

// ─── wsService mock — on/connect/disconnect/setAuthExpiredHandler 캡처 ──────────
const { wsMock, capture } = vi.hoisted(() => {
  const capture: {
    notificationHandler?: (data: unknown) => void;
    authExpiredHandler?: (() => void) | null;
  } = {};
  const wsMock = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((channel: string, handler: (data: unknown) => void) => {
      if (channel === 'notification') capture.notificationHandler = handler;
      return () => {};
    }),
    setAuthExpiredHandler: vi.fn((h: (() => void) | null) => {
      capture.authExpiredHandler = h;
    }),
  };
  return { wsMock, capture };
});
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));

// ─── AuthProvider mock — user/clearSession 제어 ────────────────────────────────
const { authState } = vi.hoisted(() => ({
  authState: {
    user: null as { nickname: string } | null,
    clearSession: vi.fn(),
  },
}));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authState,
}));

// 컨텍스트 값을 외부로 노출하는 소비자.
// 렌더 중 외부 값 변경(react-hooks/globals·immutability)을 피하기 위해
// holder 객체 프로퍼티를 effect에서 갱신한다. 매 렌더마다 최신 컨텍스트가 반영된다.
const holder: { ctx: ReturnType<typeof useNotification> | null } = { ctx: null };
function Consumer() {
  const value = useNotification();
  useEffect(() => {
    holder.ctx = value;
  });
  return null;
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <Consumer />
    </NotificationProvider>
  );
}

const makeNotif = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  type: 'LIKE',
  targetId: null,
  relatedPostId: null,
  message: '좋아요',
  senderNickname: '집사A',
  senderProfileImageUrl: null,
  isRead: false,
  createdAt: '2026-06-11T10:00:00',
  ...overrides,
});

describe('NotificationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    holder.ctx = null;
    capture.notificationHandler = undefined;
    capture.authExpiredHandler = undefined;
    authState.user = null;
    // URL별 기본 응답: 목록은 { content: [] }, unread-count는 숫자
    apiMock.get.mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ data: 0 });
      return Promise.resolve({ data: { content: [] } });
    });
  });

  it('로그인 시 WS connect + 알림/카운트 fetch + notification 구독', async () => {
    authState.user = { nickname: '나' };
    apiMock.get.mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ data: 3 });
      return Promise.resolve({ data: { content: [makeNotif({ id: 1 })] } });
    });

    renderProvider();

    expect(wsMock.connect).toHaveBeenCalledWith('나');
    await waitFor(() => expect(holder.ctx?.notifications).toHaveLength(1));
    expect(holder.ctx?.unreadCount).toBe(3);
    expect(wsMock.on).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('실시간 알림 수신 시 prepend + unreadCount 증가 (M-6)', async () => {
    authState.user = { nickname: '나' };
    renderProvider();
    await waitFor(() => expect(capture.notificationHandler).toBeDefined());

    act(() => {
      capture.notificationHandler!(makeNotif({ id: 10, isRead: false }));
    });

    expect(holder.ctx?.notifications).toHaveLength(1);
    expect(holder.ctx?.notifications[0].id).toBe(10);
    expect(holder.ctx?.unreadCount).toBe(1);
  });

  it('같은 id 알림 재수신 시 dedup — 중복 추가 안 함, 카운트 미증가 (M-6)', async () => {
    authState.user = { nickname: '나' };
    renderProvider();
    await waitFor(() => expect(capture.notificationHandler).toBeDefined());

    act(() => {
      capture.notificationHandler!(makeNotif({ id: 10, isRead: false }));
    });
    expect(holder.ctx?.unreadCount).toBe(1);

    // 동일 id 재수신
    act(() => {
      capture.notificationHandler!(makeNotif({ id: 10, isRead: false, message: '중복' }));
    });

    expect(holder.ctx?.notifications).toHaveLength(1);
    expect(holder.ctx?.unreadCount).toBe(1); // 증가하지 않음
  });

  it('이미 읽은(isRead=true) 알림은 unreadCount를 증가시키지 않는다', async () => {
    authState.user = { nickname: '나' };
    renderProvider();
    await waitFor(() => expect(capture.notificationHandler).toBeDefined());

    act(() => {
      capture.notificationHandler!(makeNotif({ id: 20, isRead: true }));
    });

    expect(holder.ctx?.notifications).toHaveLength(1);
    expect(holder.ctx?.unreadCount).toBe(0);
  });

  it('형태가 어긋난 페이로드는 무시한다 (런타임 가드)', async () => {
    authState.user = { nickname: '나' };
    renderProvider();
    await waitFor(() => expect(capture.notificationHandler).toBeDefined());

    act(() => {
      capture.notificationHandler!({ foo: 'bar' }); // id/type 없음
      capture.notificationHandler!(null);
    });

    expect(holder.ctx?.notifications).toHaveLength(0);
    expect(holder.ctx?.unreadCount).toBe(0);
  });

  it('마운트 시 setAuthExpiredHandler를 등록하고, 호출 시 clearSession을 부른다', async () => {
    authState.user = { nickname: '나' };
    renderProvider();
    // 초기 fetch(비동기) 정리 — act 경고 방지
    await waitFor(() => expect(capture.notificationHandler).toBeDefined());

    expect(wsMock.setAuthExpiredHandler).toHaveBeenCalled();
    expect(capture.authExpiredHandler).toBeTypeOf('function');

    act(() => {
      capture.authExpiredHandler!();
    });
    expect(authState.clearSession).toHaveBeenCalledTimes(1);
  });

  it('비로그인(user=null) 시 disconnect하고 상태를 비운다', async () => {
    authState.user = null;
    renderProvider();
    expect(wsMock.disconnect).toHaveBeenCalled();
    expect(holder.ctx?.notifications).toHaveLength(0);
    expect(holder.ctx?.unreadCount).toBe(0);
  });
});
