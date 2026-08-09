import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Tailwind 임의값 애니메이션(animate-[keycapNudge_...])은 키프레임이 지워져도
// 빌드가 통과한다 — 파일 수준 가드로 회귀를 막는다 (figurine-scan-css.test.ts 패턴)
const css = readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf-8');

// 블록 경계까지만 잘라낸다 — 파일 끝까지 슬라이스하면 뒤따르는 다른 키프레임의
// 같은 값(예: keycapRelease의 scaleY(0.9))이 대신 매치돼 가드가 조용히 무력해진다
const keyframeBody = (name: string) => {
  const m = css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return (m?.[1] ?? '').trim();
};

describe('키캡 누르기 키프레임', () => {
  it('keycapNudge — 32% 지점에서 스쿼시와 동일한 변형(scaleY .9, scaleX 1.04)', () => {
    expect(css).toContain('@keyframes keycapNudge');
    const block = keyframeBody('keycapNudge');
    expect(block).toContain('scaleY(0.9)');
    expect(block).toContain('scaleX(1.04)');
  });

  it('keycapRipple — scale 0.45→1.9, 정점 불투명도 0.95', () => {
    expect(css).toContain('@keyframes keycapRipple');
    const block = keyframeBody('keycapRipple');
    expect(block).toContain('scale(0.45)');
    expect(block).toContain('scale(1.9)');
    expect(block).toContain('0.95');
  });

  // 이름 교대 재시작용 쌍둥이 키프레임 — 내용이 갈라지면 연타 시 두 번째 릴리즈만 모양이 달라진다
  it('keycapRelease — 0%가 스쿼시 값(scaleY .9, scaleX 1.04), 100%가 원위치', () => {
    const body = keyframeBody('keycapRelease');
    expect(body).toContain('scaleY(0.9)');
    expect(body).toContain('scaleX(1.04)');
    expect(body).toContain('scaleY(1)');
  });

  it('keycapReleaseAlt — keycapRelease와 내용이 동일하다 (연타 교대 재시작용)', () => {
    const alt = keyframeBody('keycapReleaseAlt');
    expect(alt).not.toBe('');
    expect(alt).toBe(keyframeBody('keycapRelease'));
  });
});
