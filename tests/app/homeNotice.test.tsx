import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { get: apiGetMock } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/components/domain/PopularSlider', () => ({
  default: () => <div data-testid="popular-slider" />,
}));

vi.mock('@/components/domain/PostCard', () => ({
  default: ({ post }: { post: { title: string } }) => (
    <div data-testid="post-card">{post.title}</div>
  ),
}));

vi.mock('@/components/common/Skeleton', () => ({
  PostCardSkeleton: () => <div data-testid="post-skeleton" />,
  PopularSliderSkeleton: () => <div data-testid="slider-skeleton" />,
}));

// 복원 없이 일반 fetch 경로를 타도록 false 반환
vi.mock('@/hooks/useScrollRestore', () => ({
  useScrollRestore: () => false,
}));

import Home from '@/app/page';

beforeEach(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  apiGetMock.mockReset();
  // top10 / boards / posts 호출 모두 빈 응답으로 처리
  apiGetMock.mockResolvedValue({
    data: { content: [], nextCursor: null, hasNext: false },
  });
  // top10은 배열을 직접 반환
  apiGetMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/posts/top10')) {
      return Promise.resolve({ data: [] });
    }
    if (url.startsWith('/api/boards')) {
      return Promise.resolve({ data: { content: [] } });
    }
    return Promise.resolve({ data: { content: [], nextCursor: null, hasNext: false } });
  });
});

describe('Home 공지사항 섹션', () => {
  it('"공지" 배지가 2개 렌더링된다', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getAllByText('공지')).toHaveLength(2);
    });
  });

  it('공지 제목 2개가 표시된다', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('집사모여 서비스 오픈 안내')).toBeInTheDocument();
    });
    expect(screen.getByText('커뮤니티 이용 규칙 안내')).toBeInTheDocument();
  });

  it('이주의 자랑/자유게시판 더보기 링크가 렌더링된다', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getAllByText('더보기')).toHaveLength(2);
    });
  });

  it('자유게시판 최신 글을 size=3으로 조회한다', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/boards?page=0&size=3'),
        expect.anything(),
      );
    });
  });
});
