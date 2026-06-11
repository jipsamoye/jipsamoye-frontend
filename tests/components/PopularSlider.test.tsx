import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/domain/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/Avatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

import PopularSlider from '@/components/domain/PopularSlider';

const CDN_ITEM = {
  id: 1,
  label: '귀여운 멍이',
  thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
  likeCount: 10,
  commentCount: 3,
  nickname: '집사A',
  profileImageUrl: null,
};

describe('PopularSlider', () => {
  it('CDN URL 카드의 sizes 속성이 max/25vw 계산식을 포함한다 (199px 고정 아님)', () => {
    render(<PopularSlider items={[CDN_ITEM]} />);

    const img = screen.getByAltText('귀여운 멍이') as HTMLImageElement;
    const sizes = img.getAttribute('sizes') ?? '';

    expect(sizes).toBe(
      '(max-width: 1023px) max(200px, calc(25vw - 20px)), max(200px, calc(25vw - 92px))'
    );
  });

  it('CDN URL 카드의 srcSet에 150w(200 썸네일)와 600w(800 썸네일)가 모두 포함된다', () => {
    render(<PopularSlider items={[CDN_ITEM]} />);

    const img = screen.getByAltText('귀여운 멍이') as HTMLImageElement;
    const srcset = img.getAttribute('srcset') ?? '';

    expect(srcset).toContain('thumbnails/abc_200.webp 150w');
    expect(srcset).toContain('thumbnails/abc_800.webp 600w');
  });

  it('thumbnailUrl이 CDN 외부 URL이면 srcset 없이 원본 img 렌더한다', () => {
    const externalItem = { ...CDN_ITEM, thumbnailUrl: 'https://example.com/x.jpg' };
    render(<PopularSlider items={[externalItem]} />);

    const img = screen.getByAltText('귀여운 멍이') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/x.jpg');
    expect(img.getAttribute('srcset')).toBeNull();
  });

  it('thumbnailUrl이 null이면 플레이스홀더(🐾)를 렌더한다', () => {
    const noThumbItem = { ...CDN_ITEM, thumbnailUrl: null };
    const { container } = render(<PopularSlider items={[noThumbItem]} />);

    expect(container.textContent).toContain('🐾');
    expect(screen.queryByAltText('귀여운 멍이')).toBeNull();
  });

  it('items가 빈 배열이면 이미지를 렌더하지 않는다', () => {
    const { container } = render(<PopularSlider items={[]} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
