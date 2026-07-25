import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
const layout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf-8');

/**
 * 파비콘은 브라우저 탭에 뜨는 브랜드 아이콘이다. 발바닥 이모지(🐾)는
 * 뭉개져 보인다는 피드백으로 '집사모여' 글씨 파비콘으로 교체됐다.
 * 발바닥이 다시 살아나지 않도록 회귀 방지.
 */
describe('favicon — 발바닥 대신 집사모여 글씨', () => {
  it('favicon.svg에 발바닥 이모지(🐾)가 없다', () => {
    expect(svg).not.toContain('🐾');
  });

  it('favicon.svg에 브랜드명 네 글자(집사/모여)가 모두 들어간다', () => {
    expect(svg).toContain('집사');
    expect(svg).toContain('모여');
  });

  it('레거시 발바닥 favicon.ico가 제거되어 SVG 하나로 통일됐다', () => {
    expect(existsSync(path.join(root, 'src/app/favicon.ico'))).toBe(false);
  });

  it('layout 메타데이터가 favicon.svg를 아이콘으로 지정한다', () => {
    expect(layout).toContain("icon: '/favicon.svg'");
  });
});
