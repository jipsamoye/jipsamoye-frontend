import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.resolve(__dirname, '../../src/app/globals.css'), 'utf-8');

const block = (selector: string) => {
  const start = css.indexOf(selector);
  expect(start, `${selector} 를 globals.css 에서 찾을 수 없음`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  // 중첩 블록(@keyframes)까지 포함해 닫는 괄호를 찾는다
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`${selector} 블록이 닫히지 않음`);
};

/**
 * 스캔 빔은 위→아래로 내려간다. 컬러 레이어(after)도 반드시 위에서부터 드러나야
 * "빔이 훑고 지나간 자리가 현상된다"는 연출이 성립한다.
 *
 * clip-path: inset(top right bottom left) 이므로
 *   - inset(0 0 100% 0) → inset(0 0 0 0) : 위 → 아래 (정상)
 *   - inset(100% 0 0 0) → inset(0 0 0 0) : 아래 → 위 (빔과 반대 방향, 버그)
 */
describe('globals.css — 스캔 현상 애니메이션 방향', () => {
  it('reveal keyframe은 bottom inset을 줄여 위에서 아래로 드러낸다', () => {
    const keyframes = block('@keyframes figurineScanReveal');
    expect(keyframes).toContain('inset(0 0 100% 0)');
    expect(
      keyframes,
      'top inset을 줄이면 아래에서 위로 차올라 빔 진행 방향과 어긋난다',
    ).not.toContain('inset(100% 0 0 0)');
  });

  it('.figurine-scan-after의 초기 clip-path도 같은 방향이다', () => {
    const rule = block('.figurine-scan-after {');
    expect(rule).toContain('inset(0 0 100% 0)');
  });

  it('빔은 컨테이너 높이의 1/5이므로 translateY(500%)로 정확히 한 바퀴 지난다', () => {
    const keyframes = block('@keyframes figurineScanBeam');
    expect(keyframes).toContain('translateY(-100%)');
    expect(keyframes).toContain('translateY(500%)');
  });

  it('reduced-motion에서는 애니메이션을 멈추고 부분 노출 정지 프레임을 남긴다', () => {
    const idx = css.indexOf('prefers-reduced-motion');
    expect(idx).toBeGreaterThanOrEqual(0);
    const scoped = css.slice(idx);
    expect(scoped).toContain('inset(0 0 38% 0)');
    expect(scoped).toMatch(/\.figurine-scan-beam\s*\{\s*display:\s*none/);
  });
});
