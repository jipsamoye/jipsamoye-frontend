import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { PetPost, User } from '@/types/api';

const { routerMock, apiMock, authMock, shareMock, toastMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  shareMock: { shareOrCopyLink: vi.fn() },
  toastMock: { showToast: vi.fn(), showLoginRequiredToast: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useOpenDm', () => ({ useOpenDm: () => vi.fn() }));
vi.mock('@/lib/share', () => shareMock);
vi.mock('@/components/common/Toast', () => toastMock);
vi.mock('@/components/common/Avatar', () => ({ default: () => <div /> }));
vi.mock('@/components/common/DetailImage', () => ({
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));
vi.mock('@/components/domain/PostCard', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/CommentSection', () => ({ default: () => <div /> }));

import PostDetailPage from '@/app/posts/[id]/page';

const post: PetPost = {
  id: 7,
  title: '우리집 고양이',
  content: '자랑합니다',
  imageUrls: ['https://images.jipsamoye.com/posts/7/1.png'],
  likeCount: 3,
  commentCount: 0,
  nickname: '집사',
  profileImageUrl: null,
  createdAt: '2026-07-23T10:00:00',
  updatedAt: '2026-07-23T10:00:00',
  isLiked: false,
  aiGenerated: false,
};

describe('게시글 상세 — 공유하기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/api/posts/7') return Promise.resolve({ data: post });
      return Promise.resolve({ data: { content: [] } });
    });
  });

  async function renderPage() {
    // 페이지는 use(params)로 Promise 를 언랩하므로 Suspense 경계가 필요하고,
    // 초기 렌더(서스펜드)와 데이터 fetch 가 act 안에서 flush 되어야 한다.
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PostDetailPage params={Promise.resolve({ id: '7' })} />
        </Suspense>,
      );
    });
    return screen.findByText('공유하기');
  }

  it('공유하기 클릭 시 모달 없이 바로 shareOrCopyLink를 게시글 제목·현재 URL로 호출한다', async () => {
    const shareButton = await renderPage();
    fireEvent.click(shareButton);

    await waitFor(() =>
      expect(shareMock.shareOrCopyLink).toHaveBeenCalledWith({
        title: '우리집 고양이 — 집사모여',
        url: window.location.href,
      }),
    );
    expect(screen.queryByText('집사모여의 게시글을 공유해보세요!')).toBeNull();
  });
});
