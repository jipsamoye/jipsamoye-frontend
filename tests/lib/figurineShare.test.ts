import { describe, it, expect } from 'vitest';
import { getSharedFigurineImageUrl, buildFigurineShareUrl } from '@/lib/figurineShare';

describe('getSharedFigurineImageUrl', () => {
  it('images.jipsamoye.com CDN URL은 그대로 반환한다', () => {
    const url = 'https://images.jipsamoye.com/posts/8/result.png';
    expect(getSharedFigurineImageUrl(url)).toBe(url);
  });

  it('타 도메인은 null (외부 이미지 악용 차단)', () => {
    expect(getSharedFigurineImageUrl('https://evil.com/img.png')).toBeNull();
    expect(getSharedFigurineImageUrl('https://api.jipsamoye.com/img.png')).toBeNull();
  });

  it('호스트 뒤에 @·백슬래시로 도메인을 위장한 URL은 null', () => {
    expect(getSharedFigurineImageUrl('https://images.jipsamoye.com@evil.com/x.png')).toBeNull();
    expect(getSharedFigurineImageUrl('https://images.jipsamoye.com.evil.com/x.png')).toBeNull();
  });

  it('https가 아닌 스킴은 null', () => {
    expect(getSharedFigurineImageUrl('http://images.jipsamoye.com/posts/8/a.png')).toBeNull();
    expect(getSharedFigurineImageUrl('javascript:alert(1)')).toBeNull();
  });

  it('undefined·배열(중복 파라미터)·빈 문자열은 null', () => {
    expect(getSharedFigurineImageUrl(undefined)).toBeNull();
    expect(getSharedFigurineImageUrl(['https://images.jipsamoye.com/a.png'])).toBeNull();
    expect(getSharedFigurineImageUrl('')).toBeNull();
  });
});

describe('buildFigurineShareUrl', () => {
  it('origin + /figurines/share?img={인코딩된 URL} 형태를 만든다', () => {
    const result = buildFigurineShareUrl(
      'https://images.jipsamoye.com/posts/8/result.png',
      'https://www.jipsamoye.com',
    );
    expect(result).toBe(
      'https://www.jipsamoye.com/figurines/share?img=' +
        encodeURIComponent('https://images.jipsamoye.com/posts/8/result.png'),
    );
  });

  it('인코딩된 img 파라미터를 다시 디코드하면 원본 URL이 나온다 (왕복 보존)', () => {
    const original = 'https://images.jipsamoye.com/posts/8/f34e806d-a960.png';
    const shareUrl = buildFigurineShareUrl(original, 'http://localhost:3000');
    const img = new URL(shareUrl).searchParams.get('img');
    expect(img).toBe(original);
    expect(getSharedFigurineImageUrl(img ?? undefined)).toBe(original);
  });
});
