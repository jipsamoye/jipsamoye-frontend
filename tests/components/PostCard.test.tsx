import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/domain/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PostCard from '@/components/domain/PostCard';

describe('PostCard', () => {
  const samplePost = {
    id: 1,
    title: '귀여운 냥이',
    thumbnailUrl: null,
    likeCount: 42,
    commentCount: 7,
    nickname: '집사A',
    profileImageUrl: null,
    createdAt: '2026-04-28T00:00:00Z',
  };

  it('좋아요 수와 댓글 수를 모두 렌더한다', () => {
    const { getByText } = render(<PostCard post={samplePost} />);
    expect(getByText(/42/)).toBeInTheDocument();
    expect(getByText(/7/)).toBeInTheDocument();
  });

  it('commentCount=0 인 경우에도 0을 렌더한다 (표시는 항상 노출)', () => {
    const { container } = render(<PostCard post={{ ...samplePost, commentCount: 0 }} />);
    expect(container.textContent).toContain('💬 0');
  });
});
