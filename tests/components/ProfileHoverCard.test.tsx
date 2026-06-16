import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { User } from '@/types/api';

// jsdom은 matchMedia를 구현하지 않음 → hover-capable 감지 useEffect용 스텁.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

// ─── 가변 모킹 값 ─────────────────────────────────────────────────────────────
const { apiMock, authMock, openDmMock, pushMock, loginToastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null },
  openDmMock: vi.fn(),
  pushMock: vi.fn(),
  loginToastMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));
vi.mock('@/hooks/useOpenDm', () => ({
  useOpenDm: () => openDmMock,
}));
vi.mock('@/components/common/Toast', () => ({
  showLoginRequiredToast: loginToastMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// floating-ui: popover를 항상 마운트 상태로 만들어 hover 시뮬레이션 없이
// 메시지 버튼 핸들러(handleMessage)를 직접 검증한다.
vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setReference: vi.fn(), setFloating: vi.fn() },
    floatingStyles: {},
    context: {},
  }),
  useHover: () => ({}),
  useDismiss: () => ({}),
  useRole: () => ({}),
  useInteractions: () => ({
    getReferenceProps: () => ({}),
    getFloatingProps: () => ({}),
  }),
  useTransitionStyles: () => ({ isMounted: true, styles: {} }),
  FloatingPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
  safePolygon: () => ({}),
}));

// 프로필 데이터 로드(useEffect)는 popover open 시에만 동작하지만,
// 모킹된 floating-ui에선 open state 변화가 없어 fetch가 일어나지 않을 수 있다.
// 안전하게 get은 항상 빈 프로필을 반환하도록 둔다.
import ProfileHoverCard from '@/components/domain/ProfileHoverCard';

const baseUser = (overrides: Partial<User> = {}): User => ({
  nickname: '뽀삐',
  bio: '안녕하세요',
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 5,
  followerCount: 128,
  followingCount: 12,
  totalLikeCount: 324,
  ranking: 52,
  createdAt: '2026-04-01T00:00:00Z',
  isFollowing: false,
  ...overrides,
});

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

describe('ProfileHoverCard — 메시지 버튼 로그인 가드', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    openDmMock.mockReset();
    pushMock.mockReset();
    loginToastMock.mockReset();
    authMock.user = null;
    apiMock.get.mockResolvedValue(successRes(baseUser()));
  });

  it('비로그인 상태에서 메시지 클릭 시 로그인 유도 토스트만 띄우고 openDm은 호출하지 않는다', () => {
    authMock.user = null;
    render(
      <ProfileHoverCard nickname="뽀삐">
        <span>트리거</span>
      </ProfileHoverCard>
    );

    fireEvent.click(screen.getByRole('button', { name: /메시지/ }));
    expect(loginToastMock).toHaveBeenCalledWith('message');
    expect(openDmMock).not.toHaveBeenCalled();
  });

  it('로그인 상태에서 메시지 클릭 시 openDm을 호출하고 토스트는 띄우지 않는다', () => {
    authMock.user = baseUser({ nickname: '내계정' });
    render(
      <ProfileHoverCard nickname="뽀삐">
        <span>트리거</span>
      </ProfileHoverCard>
    );

    fireEvent.click(screen.getByRole('button', { name: /메시지/ }));
    expect(openDmMock).toHaveBeenCalledWith('뽀삐', null);
    expect(loginToastMock).not.toHaveBeenCalled();
  });
});
