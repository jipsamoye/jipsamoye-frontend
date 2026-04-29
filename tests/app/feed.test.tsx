import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { apiGetMock, authMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  authMock: { user: null as unknown, loading: false },
}));

vi.mock('@/lib/api', () => ({ api: { get: apiGetMock } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/domain/PostCard', () => ({
  default: ({ post }: { post: { title: string } }) => <div data-testid="post-card">{post.title}</div>,
}));

vi.mock('@/components/common/Skeleton', () => ({
  PostCardSkeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/layout/icons', () => ({
  UsersIcon: () => <svg />,
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));

import FeedPage from '@/app/feed/page';

// jsdom에는 IntersectionObserver가 없으므로 stub 처리
beforeEach(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

const pageResponse = (items: object[], hasNext = false) => ({
  data: {
    content: items,
    totalPages: 1, totalElements: items.length,
    currentPage: 0, size: 20, hasNext,
  },
});

const samplePost = {
  id: 1, title: '귀여운 냥이', thumbnailUrl: null,
  likeCount: 5, commentCount: 3, nickname: '집사A', profileImageUrl: null,
  createdAt: '2026-04-28T00:00:00Z',
};

describe('FeedPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    authMock.user = null;
    authMock.loading = false;
  });

  it('authLoading 중에는 스켈레톤을 표시한다', () => {
    authMock.loading = true;
    render(<FeedPage />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('비로그인 상태에서는 로그인 안내 메시지를 표시하고 API를 호출하지 않는다', () => {
    authMock.user = null;
    render(<FeedPage />);
    expect(screen.getByText('로그인 후 이용할 수 있어요')).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('로그인 상태에서 게시글이 있으면 PostCard를 렌더링한다', async () => {
    authMock.user = { nickname: '집사A' };
    apiGetMock.mockResolvedValueOnce(pageResponse([samplePost]));

    render(<FeedPage />);

    await waitFor(() => expect(screen.getByTestId('post-card')).toBeInTheDocument());
    expect(screen.getByText('귀여운 냥이')).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith('/api/posts/feed?page=0&size=20');
  });

  it('로그인 상태에서 게시글이 없으면 빈 상태 메시지를 표시한다', async () => {
    authMock.user = { nickname: '집사A' };
    apiGetMock.mockResolvedValueOnce(pageResponse([]));

    render(<FeedPage />);

    await waitFor(() =>
      expect(screen.getByText('아직 구독한 집사의 게시글이 없어요')).toBeInTheDocument()
    );
  });

  it('API 실패 시 빈 상태로 처리된다', async () => {
    authMock.user = { nickname: '집사A' };
    apiGetMock.mockRejectedValueOnce(new Error('network error'));

    render(<FeedPage />);

    await waitFor(() =>
      expect(screen.getByText('아직 구독한 집사의 게시글이 없어요')).toBeInTheDocument()
    );
  });
});
