import { describe, it, expect } from 'vitest';
import { POST_CONFIG, BOARD_CONFIG, COMMENT_MAX } from '@/lib/constants';

describe('constants', () => {
  describe('POST_CONFIG', () => {
    it('TITLE_MAX은 30이다', () => {
      expect(POST_CONFIG.TITLE_MAX).toBe(30);
    });

    it('CONTENT_MAX는 500이다', () => {
      expect(POST_CONFIG.CONTENT_MAX).toBe(500);
    });

    it('MAX_IMAGES는 5이다', () => {
      expect(POST_CONFIG.MAX_IMAGES).toBe(5);
    });

    it('MAX_IMAGE_SIZE는 10MB(10485760)이다', () => {
      expect(POST_CONFIG.MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe('BOARD_CONFIG', () => {
    it('TITLE_MAX은 100이다 (펫 게시글 30과 의도적으로 다름)', () => {
      expect(BOARD_CONFIG.TITLE_MAX).toBe(100);
    });

    it('펫 게시글 제목 한도보다 크다', () => {
      expect(BOARD_CONFIG.TITLE_MAX).toBeGreaterThan(POST_CONFIG.TITLE_MAX);
    });
  });

  describe('COMMENT_MAX', () => {
    it('500이다', () => {
      expect(COMMENT_MAX).toBe(500);
    });
  });
});
