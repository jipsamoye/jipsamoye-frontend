import { describe, it, expect } from 'vitest';
import { shouldScrollToBottom } from '@/app/dm/page';

describe('shouldScrollToBottom', () => {
  // ─── 최초 실행 (prevLastId === undefined) ───────────────────────────────

  it('최초 실행: 메시지가 있으면(nextLastId != null) true', () => {
    expect(shouldScrollToBottom(undefined, 1)).toBe(true);
    expect(shouldScrollToBottom(undefined, 100)).toBe(true);
  });

  it('최초 실행: 메시지가 없으면(nextLastId == null) false', () => {
    expect(shouldScrollToBottom(undefined, null)).toBe(false);
    expect(shouldScrollToBottom(undefined, undefined)).toBe(false);
  });

  // ─── append — 마지막 id 변화 ────────────────────────────────────────────

  it('새 메시지 append: 마지막 id가 달라지면 true', () => {
    expect(shouldScrollToBottom(1, 2)).toBe(true);
    expect(shouldScrollToBottom(5, 6)).toBe(true);
  });

  it('방 전환(빈 상태 → 새 메시지): null에서 id로 바뀌면 true', () => {
    expect(shouldScrollToBottom(null, 1)).toBe(true);
  });

  it('방 전환(이전 방 마지막 id → 새 방 첫 메시지 id): true', () => {
    expect(shouldScrollToBottom(99, 1)).toBe(true);
  });

  // ─── prepend — 마지막 id 동일 ────────────────────────────────────────────

  it('prepend: 마지막 id가 동일하면 false', () => {
    expect(shouldScrollToBottom(10, 10)).toBe(false);
    expect(shouldScrollToBottom(1, 1)).toBe(false);
  });

  // ─── 메시지 전체 제거(방 전환 초기화) ──────────────────────────────────

  it('메시지 전체 제거(방 전환 직후 초기화): nextLastId == null이면 false', () => {
    expect(shouldScrollToBottom(5, null)).toBe(false);
    expect(shouldScrollToBottom(5, undefined)).toBe(false);
  });

  // ─── 낙관적 id(음수) → 에코 id(양수) 치환 ────────────────────────────

  it('낙관적 음수 id → 서버 양수 id 치환: 마지막 id 변화 → true (무해, 이미 바닥)', () => {
    expect(shouldScrollToBottom(-1000, 101)).toBe(true);
  });
});
