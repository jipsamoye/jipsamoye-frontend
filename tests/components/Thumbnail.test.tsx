import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Thumbnail from '@/components/common/Thumbnail';

describe('Thumbnail', () => {
  it('CDN URL이면 200 썸네일을 src로, 200w/800w를 srcset으로 렌더한다', () => {
    render(
      <Thumbnail
        src="https://images.jipsamoye.com/posts/42/abc.jpg"
        alt="테스트"
        sizes="(max-width: 768px) 50vw, 253px"
      />
    );

    const img = screen.getByAltText('테스트') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://images.jipsamoye.com/posts/42/thumbnails/abc_200.webp');
    expect(img.getAttribute('srcset')).toContain('_200.webp 200w');
    expect(img.getAttribute('srcset')).toContain('_800.webp 800w');
    expect(img.getAttribute('sizes')).toBe('(max-width: 768px) 50vw, 253px');
  });

  it('외부 도메인 URL은 srcset 없이 원본 그대로 렌더한다 (안전 가드)', () => {
    render(<Thumbnail src="https://example.com/img.jpg" alt="외부" />);

    const img = screen.getByAltText('외부') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/img.jpg');
    expect(img.getAttribute('srcset')).toBeNull();
  });

  it('썸네일 404 시 onError로 원본 URL fallback 한다', () => {
    const originalUrl = 'https://images.jipsamoye.com/posts/42/abc.jpg';
    render(<Thumbnail src={originalUrl} alt="폴백테스트" />);

    const img = screen.getByAltText('폴백테스트') as HTMLImageElement;
    // 처음엔 200 썸네일
    expect(img.getAttribute('src')).toContain('_200.webp');

    // 썸네일 로드 실패
    fireEvent.error(img);

    // 원본 URL로 교체됐는지 확인
    const imgAfter = screen.getByAltText('폴백테스트') as HTMLImageElement;
    expect(imgAfter.getAttribute('src')).toBe(originalUrl);
    expect(imgAfter.getAttribute('srcset')).toBeNull();
  });

  it('priority=high, loading=eager를 그대로 전달한다', () => {
    render(
      <Thumbnail
        src="https://images.jipsamoye.com/posts/42/abc.jpg"
        alt="우선순위"
        loading="eager"
        fetchPriority="high"
      />
    );

    const img = screen.getByAltText('우선순위') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });
});
