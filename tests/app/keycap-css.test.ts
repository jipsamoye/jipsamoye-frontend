import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Tailwind 임의값 애니메이션(animate-[keycapNudge_...])은 키프레임이 지워져도
// 빌드가 통과한다 — 파일 수준 가드로 회귀를 막는다 (figurine-scan-css.test.ts 패턴)
const css = readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf-8');

describe('키캡 누르기 키프레임', () => {
  it('keycapNudge — 32% 지점에서 스쿼시와 동일한 변형(scaleY .9, scaleX 1.04)', () => {
    expect(css).toContain('@keyframes keycapNudge');
    const block = css.slice(css.indexOf('@keyframes keycapNudge'));
    expect(block).toContain('scaleY(0.87)');
    expect(block).toContain('scaleX(1.05)');
  });

  it('keycapRipple — scale 0.45→1.9, 정점 불투명도 0.95', () => {
    expect(css).toContain('@keyframes keycapRipple');
    const block = css.slice(css.indexOf('@keyframes keycapRipple'));
    expect(block).toContain('scale(0.45)');
    expect(block).toContain('scale(1.9)');
    expect(block).toContain('0.95');
  });
});
