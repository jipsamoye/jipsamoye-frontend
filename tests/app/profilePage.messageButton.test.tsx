import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Suspense } from 'react';
import type { User } from '@/types/api';

// ─── 가변 모킹 값 ─────────────────────────────────────────────────────────────
const { apiMock, authMock, openDmMock, pushMock, loginToastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null, updateUser: vi.fn() },
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

// 자식 컴포넌트는 가볍게 모킹
vi.mock('@/components/common/Avatar', () => ({
  default: () => <div data-testid="avatar" />,
}));
vi.mock('@/components/domain/PostCard', () => ({
  default: ({ post }: { post: { title: string } }) => <div>{post.title}</div>,
}));
vi.mock('@/components/domain/ProfileEditModal', () => ({
  default: () => null,
}));

import ProfilePage from '@/app/users/[nickname]/page';

const makeProfile = (overrides: Partial<User> = {}): User => ({
  nickname: '뽀삐',
  bio: '안녕하세요',
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 3,
  followerCount: 10,
  followingCount: 5,
  totalLikeCount: 42,
  ranking: 7,
  createdAt: '2026-01-01T00:00:00Z',
  isFollowing: false,
  ...overrides,
});

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });
const emptyPage = successRes({
  content: [],
  totalPages: 0,
  totalElements: 0,
  currentPage: 0,
  size: 20,
  hasNext: false,
});

async function renderProfile() {
  // ProfilePage 는 use(params)로 Promise 를 언랩하므로 Suspense 경계가 필요하고,
  // 초기 렌더(서스펜드)와 데이터 fetch 가 act 안에서 flush 되어야 한다.
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ProfilePage params={Promise.resolve({ nickname: '뽀삐' })} />
      </Suspense>
    );
  });
}

describe('ProfilePage — 메시지 버튼 (DM 개방 후속)', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    openDmMock.mockReset();
    pushMock.mockReset();
    loginToastMock.mockReset();
    authMock.user = null;
  });

  // 프로필 페이지는 /api/users/{nickname} 와 /{nickname}/posts 두 번 fetch 한다.
  // URL 로 분기해 어느 순서로 호출돼도 안전하게 응답한다.
  function mockProfile(profile: User) {
    apiMock.get.mockImplementation((url: string) => {
      if (url.includes('/posts')) return Promise.resolve(emptyPage);
      return Promise.resolve(successRes(profile));
    });
  }

  it('타인 프로필 + 미구독: 구독하기와 메시지 버튼을 모두 노출한다', async () => {
    authMock.user = { ...makeProfile({ nickname: '내계정' }) };
    mockProfile(makeProfile({ isFollowing: false }));

    await renderProfile();

    await waitFor(() => expect(screen.getByText('📣 구독하기')).toBeInTheDocument());
    expect(screen.getByText('💬 메시지')).toBeInTheDocument();
  });

  it('타인 프로필 + 구독 중: 구독 중 + 메시지 버튼을 모두 노출한다', async () => {
    authMock.user = { ...makeProfile({ nickname: '내계정' }) };
    mockProfile(makeProfile({ isFollowing: true }));

    await renderProfile();

    await waitFor(() => expect(screen.getByText('구독 중')).toBeInTheDocument());
    expect(screen.getByText('💬 메시지')).toBeInTheDocument();
  });

  it('본인 프로필: 메시지 버튼 대신 프로필 편집만 노출한다', async () => {
    authMock.user = { ...makeProfile({ nickname: '뽀삐' }) };
    mockProfile(makeProfile({ nickname: '뽀삐' }));

    await renderProfile();

    await waitFor(() => expect(screen.getByText('프로필 편집')).toBeInTheDocument());
    expect(screen.queryByText('💬 메시지')).not.toBeInTheDocument();
    expect(screen.queryByText('📣 구독하기')).not.toBeInTheDocument();
  });

  it('메시지 버튼 클릭 시 openDm(닉네임, 프로필이미지)을 호출한다', async () => {
    authMock.user = { ...makeProfile({ nickname: '내계정' }) };
    mockProfile(makeProfile({ isFollowing: false, profileImageUrl: 'https://img/x.webp' }));

    await renderProfile();

    const btn = await screen.findByText('💬 메시지');
    btn.click();
    expect(openDmMock).toHaveBeenCalledWith('뽀삐', 'https://img/x.webp');
    expect(loginToastMock).not.toHaveBeenCalled();
  });

  it('비로그인 상태에서 메시지 버튼 클릭 시 로그인 유도 토스트만 띄우고 openDm은 호출하지 않는다', async () => {
    authMock.user = null;
    mockProfile(makeProfile({ isFollowing: false }));

    await renderProfile();

    const btn = await screen.findByText('💬 메시지');
    btn.click();
    expect(loginToastMock).toHaveBeenCalledWith('message');
    expect(openDmMock).not.toHaveBeenCalled();
  });
});
