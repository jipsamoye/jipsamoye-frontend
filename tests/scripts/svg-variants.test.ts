import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error - .mjs 스크립트 헬퍼에는 타입 선언이 없다
import { toAppleTouchSvg } from '../../scripts/lib/svg-variants.mjs';

const root = path.resolve(__dirname, '../..');
const original = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');

describe('toAppleTouchSvg — iOS 이중 라운딩 방지', () => {
  it('rx 속성을 제거해 꽉 찬 사각형으로 만든다', () => {
    expect(original).toContain('rx=');
    expect(toAppleTouchSvg(original)).not.toContain('rx=');
  });

  it('브랜드 요소(색·글자)는 그대로 보존한다', () => {
    const result = toAppleTouchSvg(original);
    expect(result.toLowerCase()).toContain('#ff734c');
    expect(result).toContain('집사');
    expect(result).toContain('모여');
    expect(result).toContain('<svg');
  });

  it('rx가 없는 입력에는 멱등이다', () => {
    const once = toAppleTouchSvg(original);
    expect(toAppleTouchSvg(once)).toBe(once);
  });

  it('원본 문자열을 변형하지 않는다', () => {
    const before = original;
    toAppleTouchSvg(original);
    expect(original).toBe(before);
  });
});
