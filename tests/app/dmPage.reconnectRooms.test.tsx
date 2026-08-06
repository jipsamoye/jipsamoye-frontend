import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { DmRoom, User } from '@/types/api';

// ─── vi.hoisted: 가변 모킹 값들 (dmPage.openConversation.test.tsx와 동일 골격) ──
const { apiMock, wsMock, authMock, searchParamsRef, replaceMock, routerRef } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return {
    apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    wsMock: {
      on: vi.fn(() => () => {}),
      onDmRoom: vi.fn(() => () => {}),
      onReconnect: vi.fn(() => () => {}),
      send: vi.fn(() => true),
      isConnected: vi.fn(() => true),
    },
    authMock: { user: null as User | null, loading: false },
    searchParamsRef: { current: new URLSearchParams('') },
    replaceMock,
    // router는 안정적인 동일 참조여야 한다(딥링크 effect 무한 재실행 방지)
    routerRef: { current: { replace: replaceMock } },
  };
});

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => routerRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock('@/components/common/Avatar', () => ({
  default: ({ alt }: { alt?: string }) => <div data-testid="avatar">{alt}</div>,
}));
vi.mock('@/components/common/Thumbnail', () => ({
  default: () => <div data-testid="thumbnail" />,
}));
vi.mock('@/components/common/Modal', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

import DmPage from '@/app/dm/page';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });
const makePageRes = (items: unknown[], hasNext = false) =>
  successRes({
    content: items,
    totalPages: 1,
    totalElements: items.length,
    currentPage: 0,
    size: 50,
    hasNext,
  });

const sampleUser: User = {
  nickname: '나',
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
  isFollowing: false,
} as unknown as User;

const makeRoom = (overrides: Partial<DmRoom> = {}): DmRoom => ({
  roomId: 42,
  otherUserNickname: '상대방',
  otherUserProfileImageUrl: null,
  lastMessage: '안녕',
  lastMessageAt: '2026-08-03T10:00:00',
  unreadCount: 0,
  ...overrides,
});

/**
 * wsService.onReconnect로 등록된 핸들러를 전부 캡처.
 * 방이 열려 있으면 useDmRoom의 재연결 effect도 등록하므로 여러 개일 수 있다 —
 * 재연결 시뮬레이션은 전부 발화시킨다.
 */
function captureReconnectHandlers(): { fire: () => void; off: ReturnType<typeof vi.fn> } {
  const handlers: Array<() => void> = [];
  const off = vi.fn();
  wsMock.onReconnect.mockImplementation((handler: () => void) => {
    handlers.push(handler);
    return off;
  });
  return { fire: () => handlers.forEach((h) => h()), off };
}

describe('DM 페이지 — 재연결 시 방 목록 재동기화', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    wsMock.on.mockReset();
    wsMock.onDmRoom.mockReset();
    wsMock.onReconnect.mockReset();
    wsMock.send.mockReset();
    wsMock.on.mockReturnValue(() => {});
    wsMock.onDmRoom.mockReturnValue(() => {});
    wsMock.onReconnect.mockReturnValue(() => {});
    wsMock.send.mockReturnValue(true);
    replaceMock.mockReset();
    authMock.user = sampleUser;
    authMock.loading = false;
    searchParamsRef.current = new URLSearchParams('');
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([])); // 방 목록은 빈 배열로 시작
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('재연결 시 GET /api/dm/rooms를 재조회해 목록을 갱신한다', async () => {
    const { fire } = captureReconnectHandlers();
    render(<DmPage />);
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/api/dm/rooms'));
    expect(screen.queryByText('상대방')).not.toBeInTheDocument();

    // 끊김 사이 새 방이 생긴 상황 — 재조회 스냅샷에 방 1개
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom()]));
    });
    act(() => fire());

    await waitFor(() => expect(screen.getAllByText('상대방').length).toBeGreaterThan(0));
  });

  it('열려 있는 방은 재조회 스냅샷에 unreadCount가 있어도 배지를 표시하지 않는다', async () => {
    const { fire } = captureReconnectHandlers();
    // 딥링크로 방 42를 연 상태로 시작
    searchParamsRef.current = new URLSearchParams('room=42&nick=상대방');
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom({ roomId: 42, unreadCount: 0 })]));
    });
    render(<DmPage />);
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/api/dm/rooms'));

    // 재조회 스냅샷은 열린 방의 unread를 3으로 보고하지만, 열려 있으므로 0 강제 → 배지 없음
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom({ roomId: 42, unreadCount: 3 })]));
    });
    act(() => fire());

    await waitFor(() =>
      expect(apiMock.get.mock.calls.filter((c) => c[0] === '/api/dm/rooms').length).toBeGreaterThan(1)
    );
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('언마운트 시 onReconnect 등록을 해제한다', async () => {
    const { off } = captureReconnectHandlers();
    const { unmount } = render(<DmPage />);
    await waitFor(() => expect(wsMock.onReconnect).toHaveBeenCalled());

    unmount();

    expect(off).toHaveBeenCalled();
  });

  it('미로그인 상태에서는 onReconnect를 등록하지 않는다', () => {
    authMock.user = null;
    render(<DmPage />);

    expect(wsMock.onReconnect).not.toHaveBeenCalled();
  });
});
