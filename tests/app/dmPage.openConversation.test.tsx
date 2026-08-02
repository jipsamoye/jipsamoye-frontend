import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { DmRoom, User } from '@/types/api';

// ─── vi.hoisted: 가변 모킹 값들 ───────────────────────────────────────────────
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

describe('DM 페이지 — 방 선생성 대화 열기', () => {
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

  it('새 메시지 모달에서 상대 선택 → create=true resolve 후 실제 방으로 대화창 열림', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      if (/\/following/.test(url)) {
        return Promise.resolve(makePageRes([{ nickname: '상대방', profileImageUrl: null }]));
      }
      return Promise.resolve(successRes([])); // 방 목록
    });
    apiMock.post.mockResolvedValueOnce(
      successRes({
        roomId: 77,
        otherUserNickname: '상대방',
        otherUserProfileImageUrl: null,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      })
    );
    render(<DmPage />);

    // "새 메세지 보내기" 버튼 → 모달 오픈 → 팔로잉 목록(1건) 로드
    fireEvent.click(screen.getByText('새 메세지 보내기'));
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '상대방에게 메시지 보내기' })).toBeInTheDocument()
    );

    // 모달 내 상대 클릭 → handleCreateRoom → create=true resolve
    fireEvent.click(screen.getByRole('button', { name: '상대방에게 메시지 보내기' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith(
        expect.stringMatching(/targetNickname=.*&create=true/)
      );
    });

    // 실제 방(77)으로 대화창이 열리고 헤더에 상대 닉네임이 표시된다
    await waitFor(() => {
      expect(screen.getAllByText('상대방').length).toBeGreaterThan(0);
    });
    // 모달은 닫힌다
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    // 실제 roomId(77)로 메시지 로드 + WS 구독이 성립한다
    expect(apiMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/dm/rooms/77/messages')
    );
    expect(wsMock.onDmRoom).toHaveBeenCalledWith(77, expect.any(Function));
  });

  it('딥링크 ?room=77&nick=상대방 → 대화 패널이 열리고 헤더에 닉네임 표시', async () => {
    searchParamsRef.current = new URLSearchParams('room=77&nick=상대방');
    render(<DmPage />);

    await waitFor(() => {
      // 헤더에 상대 닉네임 렌더 (목록에 방이 없어도 pendingPartner로 표시)
      expect(screen.getAllByText('상대방').length).toBeGreaterThan(0);
    });
    // 메시지 로드가 실제 roomId로 나감
    expect(apiMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/dm/rooms/77/messages')
    );
    // WS 구독이 실제 roomId로 성립
    expect(wsMock.onDmRoom).toHaveBeenCalledWith(77, expect.any(Function));
    // URL 정리
    expect(replaceMock).toHaveBeenCalledWith('/dm', { scroll: false });
  });

  it('딥링크 ?room=5 (nick 없음, 기존 방) → 방 선택되고 pendingPartner 없이 동작', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(
        successRes([
          {
            roomId: 5,
            otherUserNickname: '기존상대',
            otherUserProfileImageUrl: null,
            lastMessage: '이전 대화',
            lastMessageAt: '2026-07-25T10:00:00',
            unreadCount: 0,
          },
        ])
      );
    });
    searchParamsRef.current = new URLSearchParams('room=5');
    render(<DmPage />);

    await waitFor(() => {
      expect(screen.getAllByText('기존상대').length).toBeGreaterThan(0);
    });
  });

  it('dm-rooms push 수신 → 목록 갱신 (열린 방이면 unread 0)', async () => {
    searchParamsRef.current = new URLSearchParams('room=42&nick=상대방');
    const getHandler = captureRoomsHandler();
    render(<DmPage />);

    await waitFor(() => expect(getHandler()).toBeDefined());

    act(() => {
      getHandler()!(makeRoomPush({ roomId: 42, unreadCount: 3, lastMessage: '첫 메시지' }));
    });

    await waitFor(() => {
      // 목록에 방이 나타나고, 열린 방이므로 unread 뱃지(3)는 표시되지 않음
      expect(screen.getByText('첫 메시지')).toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  it('?draft= 파라미터는 더 이상 처리하지 않는다 (빈 목록 화면 유지)', async () => {
    searchParamsRef.current = new URLSearchParams('draft=상대방&img=x');
    render(<DmPage />);

    await waitFor(() => {
      expect(screen.getByText('다른 집사에게 사진과 메시지를 보낼 수 있어요')).toBeInTheDocument();
    });
    // draft 파라미터로는 대화 패널이 열리지 않음
    expect(wsMock.onDmRoom).not.toHaveBeenCalled();
  });
});
