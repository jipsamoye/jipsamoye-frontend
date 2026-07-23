import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

describe('Home 배너 문구', () => {
  it('배지·제목·서브카피가 키캡 피규어 후킹 문구로 노출된다', () => {
    render(<Home />);

    expect(screen.getByText('반려동물 자랑 커뮤니티')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('반려동물 자랑하러 오세요!');

    const highlight = screen.getByText('키캡 피규어');
    expect(highlight.closest('p')).toHaveTextContent(
      '사진 한 장이면 세상에 하나뿐인 키캡 피규어로 만들어 드려요.',
    );
  });

  it('서브카피의 키캡 피규어는 메인색(amber)으로 강조된다', () => {
    render(<Home />);

    const highlight = screen.getByText('키캡 피규어');
    expect(highlight).toHaveClass('text-amber-600', 'font-semibold');
  });
});
