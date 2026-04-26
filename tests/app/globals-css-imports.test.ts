import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Tailwind v4 의 `@import "tailwindcss"` 는 컴파일 시 거대한 CSS로 펼쳐진다.
 * Pretendard CDN `@import url(...)` 가 그 뒤에 있으면 컴파일 결과의 중간으로 밀려
 * "@import 는 다른 규칙 앞에 와야 한다"는 CSS 규약을 위반하고,
 *   - Turbopack(dev): 빌드 에러
 *   - webpack(production): 조용히 import 드랍 → 폰트 미적용
 * 이 발생한다. Pretendard import 를 항상 먼저 두도록 강제.
 */
describe('globals.css — @import 순서', () => {
  it('Pretendard @import 가 @import "tailwindcss" 보다 앞에 있어야 한다', () => {
    const css = readFileSync(
      path.resolve(__dirname, '../../src/app/globals.css'),
      'utf-8',
    );
    const lines = css.split('\n');

    let pretendardLine = -1;
    let tailwindLine = -1;

    lines.forEach((line, idx) => {
      if (line.includes('@import') && line.includes('pretendard')) {
        pretendardLine = idx;
      }
      if (line.includes('@import') && line.includes('tailwindcss')) {
        tailwindLine = idx;
      }
    });

    expect(pretendardLine, 'Pretendard @import 줄을 찾을 수 없음').toBeGreaterThanOrEqual(0);
    expect(tailwindLine, '@import "tailwindcss" 줄을 찾을 수 없음').toBeGreaterThanOrEqual(0);
    expect(
      pretendardLine,
      'Pretendard import 가 tailwindcss import 보다 뒤에 있으면 운영 빌드에서 드랍됨',
    ).toBeLessThan(tailwindLine);
  });
});
