import { describe, it, expect } from 'vitest';
import { isResizableUrl, toThumbnailUrl, buildSrcSet } from '@/lib/imageUrl';

describe('isResizableUrl', () => {
  it('images.jipsamoye.com 도메인 URL은 true', () => {
    expect(isResizableUrl('https://images.jipsamoye.com/posts/42/abc.webp')).toBe(true);
  });

  it('다른 도메인은 false', () => {
    expect(isResizableUrl('https://example.com/img.jpg')).toBe(false);
    expect(isResizableUrl('https://api.jipsamoye.com/img.jpg')).toBe(false);
  });

  it('null/undefined/빈 문자열은 false', () => {
    expect(isResizableUrl(null)).toBe(false);
    expect(isResizableUrl(undefined)).toBe(false);
    expect(isResizableUrl('')).toBe(false);
  });

  it('http(s) 없는 상대 경로는 false', () => {
    expect(isResizableUrl('/posts/42/abc.webp')).toBe(false);
  });
});

describe('toThumbnailUrl', () => {
  it('원본 URL을 200 썸네일 URL로 변환한다', () => {
    const original = 'https://images.jipsamoye.com/posts/42/abc.jpg';
    expect(toThumbnailUrl(original, 200)).toBe(
      'https://images.jipsamoye.com/posts/42/thumbnails/abc_200.webp'
    );
  });

  it('원본 URL을 800 썸네일 URL로 변환한다', () => {
    const original = 'https://images.jipsamoye.com/posts/42/abc.jpg';
    expect(toThumbnailUrl(original, 800)).toBe(
      'https://images.jipsamoye.com/posts/42/thumbnails/abc_800.webp'
    );
  });

  it('webp 원본도 변환한다 (확장자 교체)', () => {
    const original = 'https://images.jipsamoye.com/posts/42/abc.webp';
    expect(toThumbnailUrl(original, 200)).toBe(
      'https://images.jipsamoye.com/posts/42/thumbnails/abc_200.webp'
    );
  });

  it('UUID 형태 파일명도 정상 변환한다', () => {
    const original = 'https://images.jipsamoye.com/posts/8/f34e806d-a960-4133-9391-c1e34fce4a30.webp';
    expect(toThumbnailUrl(original, 800)).toBe(
      'https://images.jipsamoye.com/posts/8/thumbnails/f34e806d-a960-4133-9391-c1e34fce4a30_800.webp'
    );
  });

  it('profiles/covers/dm 디렉터리도 동일 규칙으로 변환한다', () => {
    expect(toThumbnailUrl('https://images.jipsamoye.com/profiles/12/avatar.jpg', 200))
      .toBe('https://images.jipsamoye.com/profiles/12/thumbnails/avatar_200.webp');
    expect(toThumbnailUrl('https://images.jipsamoye.com/covers/12/cover.jpg', 800))
      .toBe('https://images.jipsamoye.com/covers/12/thumbnails/cover_800.webp');
    expect(toThumbnailUrl('https://images.jipsamoye.com/dm/12/chat.jpg', 200))
      .toBe('https://images.jipsamoye.com/dm/12/thumbnails/chat_200.webp');
  });

  it('외부 도메인 URL은 변환하지 않고 원본 그대로 반환 (안전 가드)', () => {
    const external = 'https://example.com/img.jpg';
    expect(toThumbnailUrl(external, 200)).toBe(external);
  });

  it('uppercase 확장자도 안전하게 변환한다', () => {
    const original = 'https://images.jipsamoye.com/posts/42/photo.JPG';
    expect(toThumbnailUrl(original, 200)).toBe(
      'https://images.jipsamoye.com/posts/42/thumbnails/photo_200.webp'
    );
  });
});

describe('buildSrcSet', () => {
  it('200w와 800w 엔트리를 콤마 구분해 반환한다', () => {
    const original = 'https://images.jipsamoye.com/posts/42/abc.jpg';
    const srcset = buildSrcSet(original);
    expect(srcset).toBe(
      'https://images.jipsamoye.com/posts/42/thumbnails/abc_200.webp 200w, ' +
      'https://images.jipsamoye.com/posts/42/thumbnails/abc_800.webp 800w'
    );
  });
});
