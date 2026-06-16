import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  // ── sizes / srcset 버그 재현 테스트 ──────────────────────────────────────────

  it('CDN URL 썸네일의 sizes 속성이 그리드 실제 폭 기준 계산식을 포함한다 (253px 고정 아님)', () => {
    const cdnPost = {
      ...samplePost,
      thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
    };
    render(<PostCard post={cdnPost} />);

    const img = screen.getByAltText('귀여운 냥이') as HTMLImageElement;
    const sizes = img.getAttribute('sizes') ?? '';

    expect(sizes).toBe(
      '(max-width: 767px) calc(50vw - 24px), (max-width: 1023px) calc(33.3vw - 21px), calc(25vw - 92px)'
    );
  });

  it('sizes prop을 전달하면 img의 sizes 속성에 해당 값이 반영된다', () => {
    const cdnPost = {
      ...samplePost,
      thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
    };
    const customSizes =
      '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 24px), calc(25vw - 92px)';
    render(<PostCard post={cdnPost} sizes={customSizes} />);

    const img = screen.getByAltText('귀여운 냥이') as HTMLImageElement;
    expect(img.getAttribute('sizes')).toBe(customSizes);
  });

  it('sizes prop을 전달하지 않으면 기본값(2/3/4열 그리드 기준)이 사용된다', () => {
    const cdnPost = {
      ...samplePost,
      thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
    };
    render(<PostCard post={cdnPost} />);

    const img = screen.getByAltText('귀여운 냥이') as HTMLImageElement;
    expect(img.getAttribute('sizes')).toBe(
      '(max-width: 767px) calc(50vw - 24px), (max-width: 1023px) calc(33.3vw - 21px), calc(25vw - 92px)'
    );
  });

  it('CDN URL 썸네일의 srcSet에 150w(200 썸네일)와 600w(800 썸네일)가 모두 포함된다', () => {
    const cdnPost = {
      ...samplePost,
      thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
    };
    render(<PostCard post={cdnPost} />);

    const img = screen.getByAltText('귀여운 냥이') as HTMLImageElement;
    const srcset = img.getAttribute('srcset') ?? '';

    expect(srcset).toContain('thumbnails/abc_200.webp 150w');
    expect(srcset).toContain('thumbnails/abc_800.webp 600w');
  });

  it('thumbnailUrl이 CDN 외부 URL이면 srcset 없이 원본 img 렌더한다', () => {
    const externalPost = {
      ...samplePost,
      thumbnailUrl: 'https://example.com/x.jpg',
    };
    render(<PostCard post={externalPost} />);

    const img = screen.getByAltText('귀여운 냥이') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/x.jpg');
    expect(img.getAttribute('srcset')).toBeNull();
  });

  it('thumbnailUrl이 null이면 플레이스홀더(🐾)를 렌더한다', () => {
    const { container } = render(<PostCard post={samplePost} />);
    expect(container.textContent).toContain('🐾');
    expect(screen.queryByAltText('귀여운 냥이')).toBeNull();
  });

  it('highlightKeyword 없으면 제목을 강조 없이 렌더한다', () => {
    const { container } = render(<PostCard post={samplePost} />);
    expect(container.textContent).toContain('귀여운 냥이');
    expect(container.querySelectorAll('span.text-primary')).toHaveLength(0);
  });

  it('highlightKeyword가 있으면 제목의 일치 구간을 메인 컬러로 강조한다', () => {
    const { container } = render(<PostCard post={samplePost} highlightKeyword="냥이" />);
    // 제목 전체는 보존, "냥이"만 강조
    expect(container.textContent).toContain('귀여운 냥이');
    const highlighted = Array.from(
      container.querySelectorAll('span.text-primary')
    ).map((el) => el.textContent);
    expect(highlighted).toEqual(['냥이']);
  });
});
