import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/domain/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PostCard from '@/components/domain/PostCard';

const samplePost = {
  id: 1,
  title: '귀여운 냥이',
  thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
  likeCount: 42,
  commentCount: 7,
  nickname: '집사A',
  profileImageUrl: null,
  createdAt: '2026-04-28T00:00:00Z',
};

describe('PostCard — AI 키캡 배지', () => {
  it('aiGenerated=true 게시글이면 썸네일 위에 "AI 키캡" 배지를 렌더한다', () => {
    const { getByText } = render(
      <PostCard post={{ ...samplePost, aiGenerated: true }} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('제목이 "AI 키캡 자랑"이면 (플래그 없이도) 배지를 렌더한다', () => {
    const { getByText } = render(
      <PostCard post={{ ...samplePost, title: 'AI 키캡 자랑' }} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('일반 게시글에는 배지를 렌더하지 않는다', () => {
    const { queryByText } = render(<PostCard post={samplePost} />);
    expect(queryByText('AI 키캡')).toBeNull();
  });

  it('썸네일이 없는(플레이스홀더) AI 게시글에도 배지를 렌더한다', () => {
    const { getByText } = render(
      <PostCard post={{ ...samplePost, thumbnailUrl: null, aiGenerated: true }} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });
});
