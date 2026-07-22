/**
 * aiGenerated forward-compat 필드 + 상세 페이지 배지 테스트
 *
 * 백엔드가 아직 aiGenerated를 안 주는 상황(undefined → 제목 휴리스틱)과
 * 추후 추가 시(true/false → 플래그 우선) 모두 동작하도록,
 * isLiked와 동일한 forward-compat 패턴을 따른다.
 *
 * 상세 페이지는 mount 대신 소스 수준에서 배지 렌더 조건을 확인한다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) =>
  readFileSync(resolve(__dirname, '../../', rel), 'utf-8');

describe('aiGenerated — forward-compat 필드', () => {
  it('src/types/api.ts의 PetPost에 aiGenerated?: boolean 필드가 존재한다', () => {
    const source = read('src/types/api.ts');
    const petPostSection = source.slice(
      source.indexOf('export interface PetPost {'),
      source.indexOf('export interface PetPostListItem')
    );
    expect(petPostSection).toMatch(/aiGenerated\?:\s*boolean/);
  });

  it('src/types/api.ts의 PetPostListItem에 aiGenerated?: boolean 필드가 존재한다', () => {
    const source = read('src/types/api.ts');
    const listItemSection = source.slice(
      source.indexOf('export interface PetPostListItem')
    );
    expect(listItemSection.slice(0, listItemSection.indexOf('}'))).toMatch(
      /aiGenerated\?:\s*boolean/
    );
  });
});

describe('상세 페이지 — AI 키캡 배지', () => {
  it('posts/[id]/page.tsx가 isAiKeycapPost 조건으로 AiKeycapBadge를 렌더한다', () => {
    const source = read('src/app/posts/[id]/page.tsx');
    expect(source).toContain('isAiKeycapPost');
    expect(source).toContain('AiKeycapBadge');
  });
});
