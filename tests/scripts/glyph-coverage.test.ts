import { describe, it, expect } from 'vitest';
// @ts-expect-error - .mjs 스크립트 헬퍼에는 타입 선언이 없다
import { assertGlyphCoverage, MIN_GLYPH_RATIO, MAX_GLYPH_RATIO } from '../../scripts/lib/glyph-coverage.mjs';

describe('assertGlyphCoverage — 한글 글자 누락 감지', () => {
  // 이 워크트리에서 실제로 측정한 값
  it.each([
    [16, 252, 65],
    [32, 992, 203],
    [48, 2236, 492],
    [180, 32400, 7249],
  ])('정상 렌더(%ipx)는 통과한다', (size, opaque, white) => {
    const ratio = assertGlyphCoverage({ size, opaque, white });
    expect(ratio).toBeGreaterThan(MIN_GLYPH_RATIO);
    expect(ratio).toBeLessThan(MAX_GLYPH_RATIO);
  });

  it('글자가 하나도 안 그려지면 던진다', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 2236, white: 0 })).toThrow(/한글 폰트/);
  });

  it('전부 흰색이면 던진다 (배경이 안 그려진 경우)', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 2236, white: 2236 })).toThrow(/한글 폰트/);
  });

  it('전부 투명하면 별도 메시지로 던진다', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 0, white: 0 })).toThrow(/전부 투명/);
  });

  it('에러 메시지에 크기와 실제 비율을 담는다', () => {
    expect(() => assertGlyphCoverage({ size: 32, opaque: 1000, white: 10 })).toThrow(/32px.*1\.0%/);
  });
});
