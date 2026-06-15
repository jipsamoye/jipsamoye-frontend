import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { DmRoom, User } from '@/types/api';

// ─── vi.hoisted: 가변 모킹 값들 ───────────────────────────────────────────────
const { apiMock, wsMock, authMock, searchParamsRef, replaceMock, routerRef } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return {
    apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    wsMock: {
      on: vi.fn(() => () => {}),
      onDmRoom: vi.fn(() => () => {}),
      send: vi.fn(() => true),
      isConnected: vi.fn(() => true),
    },
    authMock: { user: null as User | null, loading: false },
    searchParamsRef: { current: new URLSearchParams('') },
    replaceMock,
    // router는 안정적인 동일 참조여야 한다. 매 렌더마다 새 객체를 반환하면
    // 딥링크 effect(deps에 router 포함)가 무한 재실행되어 렌더 루프에 빠진다.
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

// 자식 컴포넌트는 렌더 부수효과를 줄이기 위해 가볍게 모킹
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

type RoomsHandler = (data: unknown) => void;

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

const makeRoomPush = (overrides: Partial<DmRoom> = {}): DmRoom => ({
  roomId: 42,
  otherUserNickname: '상대방',
  otherUserProfileImageUrl: null,
  lastMessage: '안녕',
  lastMessageAt: '2026-06-11T10:00:00',
  unreadCount: 1,
  ...overrides,
});

/** wsService.on('dm-rooms', handler) 로 등록된 핸들러를 캡처해 반환 */
function captureRoomsHandler(): () => RoomsHandler | undefined {
  let captured: RoomsHandler | undefined;
  wsMock.on.mockImplementation((channel: string, handler: RoomsHandler) => {
    if (channel === 'dm-rooms') captured = handler;
    return () => {};
  });
  return () => captured;
}

describe('DM 페이지 — dm-rooms push 핸들러 (draft→실제 roomId 전환)', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    wsMock.on.mockReset();
    wsMock.onDmRoom.mockReset();
    wsMock.send.mockReset();
    wsMock.on.mockReturnValue(() => {});
    wsMock.onDmRoom.mockReturnValue(() => {});
    wsMock.send.mockReturnValue(true);
    replaceMock.mockReset();
    authMock.user = sampleUser;
    authMock.loading = false;
    searchParamsRef.current = new URLSearchParams('');
    // GET /api/dm/rooms → DmRoom[] (배열), GET /api/dm/rooms/{id}/messages → PageResponse
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([])); // 방 목록은 빈 배열로 시작
    });
    // jsdom에는 scrollIntoView가 없어 자동 스크롤 effect가 throw할 수 있어 폴리필
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('(a) draft 상태에서 닉네임이 일치하는 push 수신 → 실제 방으로 전환되고 draft 해제', async () => {
    // ?draft=상대방 으로 draft 대화 진입
    searchParamsRef.current = new URLSearchParams('draft=상대방');
    const getHandler = captureRoomsHandler();

    render(<DmPage />);

    // dm-rooms 핸들러가 등록될 때까지 대기
    await waitFor(() => expect(getHandler()).toBeTypeOf('function'));
    // draft 채팅창 헤더에 상대 닉네임 표시 (draft 상태)
    await waitFor(() => expect(screen.getByText('상대방', { selector: 'p' })).toBeInTheDocument());
    // draft 상태에서는 방 목록 비어있음 ("아직 주고 받은 메세지가 없어요")
    expect(screen.getByText('아직 주고 받은 메세지가 없어요')).toBeInTheDocument();

    // 닉네임이 일치하는 새 방 생성 push 수신
    act(() => {
      getHandler()!(makeRoomPush({ roomId: 42, otherUserNickname: '상대방' }));
    });

    // 실제 방으로 전환 → 방 목록에 반영(목록에 상대방 표시 + lastMessage)
    await waitFor(() => expect(screen.getByText('안녕')).toBeInTheDocument());
    // 전환된 방은 열려 있으므로 unread 0 → "1" 안읽음 배지 없음
    expect(screen.queryByText('아직 주고 받은 메세지가 없어요')).not.toBeInTheDocument();
  });

  it('(b) 다른 닉네임 push 수신 → draft 유지(전환 안 됨)', async () => {
    searchParamsRef.current = new URLSearchParams('draft=상대방');
    const getHandler = captureRoomsHandler();

    render(<DmPage />);
    await waitFor(() => expect(getHandler()).toBeTypeOf('function'));
    await waitFor(() => expect(screen.getByText('상대방', { selector: 'p' })).toBeInTheDocument());

    // draft 대상과 다른 닉네임의 방 push
    act(() => {
      getHandler()!(makeRoomPush({ roomId: 99, otherUserNickname: '딴사람', lastMessage: '딴메시지' }));
    });

    // 그 방은 목록에 추가되지만(applyRoomUpdate), draft 헤더는 그대로 유지됨
    await waitFor(() => expect(screen.getByText('딴메시지')).toBeInTheDocument());
    // 헤더는 여전히 draft 상대(@상대방) — 전환되지 않음
    expect(screen.getByText('상대방', { selector: 'p' })).toBeInTheDocument();
  });

  it('(c) 이미 열린 방에 대한 push → 목록 unread 0 강제', async () => {
    // ?room=42 로 기존 방 열기
    searchParamsRef.current = new URLSearchParams('room=42');
    const getHandler = captureRoomsHandler();

    render(<DmPage />);
    await waitFor(() => expect(getHandler()).toBeTypeOf('function'));

    // 열려 있는 방(42)에 대해 unreadCount>0 push 수신
    act(() => {
      getHandler()!(makeRoomPush({ roomId: 42, otherUserNickname: '상대방', lastMessage: '읽음테스트', unreadCount: 5 }));
    });

    // 목록에 방이 반영되되 열린 방이므로 unread 0 → 안읽음 배지(숫자 "5") 없음
    await waitFor(() => expect(screen.getByText('읽음테스트')).toBeInTheDocument());
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });
});
