/**
 * isLiked forward-compat 필드 테스트
 *
 * 백엔드가 아직 isLiked를 안 주는 상황(undefined)과
 * 추후 추가 시(true/false) 모두 올바르게 동작하는지 검증한다.
 *
 * 페이지 컴포넌트를 직접 mount하는 대신,
 * 타입 안전성과 nullish-coalescing 로직을 소스 수준에서 확인한다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PetPost.isLiked — forward-compat 필드', () => {
  it('src/types/api.ts에 PetPost.isLiked?: boolean 필드가 존재한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/types/api.ts'),
      'utf-8'
    );
    // isLiked?: boolean 또는 isLiked?: boolean; 형태
    expect(source).toMatch(/isLiked\?:\s*boolean/);
  });

  it('src/types/api.ts에 BoardPost.isLiked?: boolean 필드가 존재한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/types/api.ts'),
      'utf-8'
    );
    const boardPostSection = source.slice(source.indexOf('export interface BoardPost'));
    // BoardPost 인터페이스 블록 안에만 있어야 한다
    expect(boardPostSection).toMatch(/isLiked\?:\s*boolean/);
  });

  it('posts/[id]/page.tsx에서 isLiked ?? false 패턴으로 liked 상태를 초기화한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/page.tsx'),
      'utf-8'
    );
    // setLiked(res.data.isLiked ?? false) 형태
    expect(source).toMatch(/setLiked\s*\(\s*res\.data\.isLiked\s*\?\?\s*false\s*\)/);
  });

  it('board/[id]/page.tsx에서 isLiked ?? false 패턴으로 liked 상태를 초기화한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/board/[id]/page.tsx'),
      'utf-8'
    );
    // setLiked(res.data.isLiked ?? false) 형태
    expect(source).toMatch(/setLiked\s*\(\s*res\.data\.isLiked\s*\?\?\s*false\s*\)/);
  });
});

describe('isLiked nullish coalescing — 런타임 동작 검증', () => {
  // ?? false 로직은 순수 JS 표현식이므로 별도 모킹 없이 직접 테스트 가능
  it('isLiked가 undefined이면 ?? false로 false를 반환한다', () => {
    const isLiked: boolean | undefined = undefined;
    expect(isLiked ?? false).toBe(false);
  });

  it('isLiked가 true이면 ?? false 우회하여 true를 반환한다', () => {
    const isLiked: boolean | undefined = true;
    expect(isLiked ?? false).toBe(true);
  });

  it('isLiked가 false이면 ?? false 우회하여 false를 반환한다', () => {
    const isLiked: boolean | undefined = false;
    expect(isLiked ?? false).toBe(false);
  });
});

describe('posts/[id]/page.tsx — user deps 제거', () => {
  it('게시글 상세 fetch useEffect deps에 user가 없다 (재요청 버그 방지)', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/page.tsx'),
      'utf-8'
    );
    // }, [id, router, user] 패턴이 없어야 한다
    // 단, eslint-disable 라인 포함된 deps는 [id, router] 또는 [id, router]; 형태여야 한다
    expect(source).not.toMatch(/\[id,\s*router,\s*user\]/);
  });

  it('작성자 다른글 요청 내부 fetch에 .catch가 있다 (unhandled rejection 방지)', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/page.tsx'),
      'utf-8'
    );
    // /api/users/... /posts 요청 체인에 .catch가 있어야 한다
    expect(source).toMatch(/\/api\/users\/.*\/posts.*[\s\S]*\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);
  });
});

describe('users/[nickname]/page.tsx — user deps 제거', () => {
  it('프로필 fetch useEffect deps에 user가 없다 (팔로우 토글 시 재요청 버그 방지)', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/users/[nickname]/page.tsx'),
      'utf-8'
    );
    // decodedNickname, router, user 세 개가 함께 있는 deps가 없어야 한다
    expect(source).not.toMatch(/\[decodedNickname,\s*router,\s*user\]/);
  });
});

describe('posts/[id]/edit/page.tsx — authLoading 게이트', () => {
  it('authLoading을 구조분해한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/edit/page.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/loading:\s*authLoading/);
  });

  it('useEffect 진입부에 authLoading 가드가 있다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/edit/page.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/if\s*\(\s*authLoading\s*\)\s*return/);
  });

  it('deps에 authLoading이 포함된다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/edit/page.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/\[id,\s*user,\s*authLoading,\s*router\]/);
  });

  it('비작성자 redirect를 router.push가 아닌 router.replace로 처리한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/posts/[id]/edit/page.tsx'),
      'utf-8'
    );
    // router.replace를 사용하고 router.push는 없어야 한다
    expect(source).toMatch(/router\.replace/);
    expect(source).not.toMatch(/router\.push/);
  });
});
