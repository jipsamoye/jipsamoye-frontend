/**
 * 상수 일원화 검증:
 * - BoardForm이 BOARD_CONFIG.TITLE_MAX(100)을 사용하는지
 * - PostEditor 토스트가 POST_CONFIG 값과 동일한 숫자를 참조하는지
 * 소스 파일을 읽어 하드코딩된 매직넘버가 없는지 구조적으로 확인한다.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../src');

function readSrc(rel: string) {
  return fs.readFileSync(path.join(SRC_ROOT, rel), 'utf-8');
}

describe('constants 일원화 — 소스 구조 검증', () => {
  describe('BoardForm', () => {
    it('로컬 const TITLE_MAX 선언이 없다', () => {
      const src = readSrc('components/domain/BoardForm.tsx');
      // 이전 패턴: "const TITLE_MAX = 100" 형태의 로컬 선언이 제거되었는지
      expect(src).not.toMatch(/^const TITLE_MAX\s*=/m);
    });

    it('BOARD_CONFIG를 import한다', () => {
      const src = readSrc('components/domain/BoardForm.tsx');
      expect(src).toContain('BOARD_CONFIG');
      expect(src).toContain("from '@/lib/constants'");
    });
  });

  describe('PostEditor', () => {
    it("제목 토스트에 숫자 '30'이 하드코딩되어 있지 않다", () => {
      const src = readSrc('components/domain/PostEditor.tsx');
      // showToast 호출 내에 '30자까지' 리터럴이 없어야 함
      expect(src).not.toMatch(/showToast\([^)]*30자까지/);
    });

    it("내용 토스트에 숫자 '500'이 하드코딩되어 있지 않다", () => {
      const src = readSrc('components/domain/PostEditor.tsx');
      expect(src).not.toMatch(/showToast\([^)]*500자까지/);
    });

    it('TITLE_MAX 템플릿 리터럴을 사용한다', () => {
      const src = readSrc('components/domain/PostEditor.tsx');
      expect(src).toContain('`제목은 ${TITLE_MAX}자까지');
    });

    it('CONTENT_MAX 템플릿 리터럴을 사용한다', () => {
      const src = readSrc('components/domain/PostEditor.tsx');
      expect(src).toContain('`내용은 ${CONTENT_MAX}자까지');
    });

    it('POST_CONFIG를 import한다', () => {
      const src = readSrc('components/domain/PostEditor.tsx');
      expect(src).toContain('POST_CONFIG');
      expect(src).toContain("from '@/lib/constants'");
    });
  });

  describe('constants.ts', () => {
    it('BOARD_CONFIG가 export되어 있다', () => {
      const src = readSrc('lib/constants.ts');
      expect(src).toContain('export const BOARD_CONFIG');
    });

    it('BOARD_CONFIG.TITLE_MAX는 100이다', () => {
      const src = readSrc('lib/constants.ts');
      // "TITLE_MAX: 100" 패턴
      expect(src).toMatch(/TITLE_MAX:\s*100/);
    });
  });
});
