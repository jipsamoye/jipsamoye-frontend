import { describe, it, expect, vi } from 'vitest';

// DM 목록(왼쪽 패널) 검색 회귀 가드.
// 이 검색은 "기존 대화방"을 닉네임으로 클라이언트 필터만 한다 — API 호출이 없다.
// 새 메시지 모달의 전체 유저 검색(useUserSearch → GET /api/users/search)과 혼동/회귀 방지.
//
// 만약 누군가 목록 필터에서 api 를 import 해 호출하도록 바꾸면, 이 import 자체가
// 모듈 로드 시 mock 으로 대체되며, 아래 테스트들이 순수 필터 동작을 고정한다.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { filterRoomsByNickname } from '@/app/dm/page';

interface Room {
  roomId: number;
  otherUserNickname: string;
}

const rooms: Room[] = [
  { roomId: 1, otherUserNickname: '뽀삐' },
  { roomId: 2, otherUserNickname: '나비' },
  { roomId: 3, otherUserNickname: 'Cat집사' },
];

describe('filterRoomsByNickname (DM 목록 검색 — 클라이언트 필터, API 없음)', () => {
  it('빈 검색어면 전체 방을 그대로 반환한다', () => {
    expect(filterRoomsByNickname(rooms, '')).toHaveLength(3);
  });

  it('닉네임 부분 일치로 필터한다', () => {
    const result = filterRoomsByNickname(rooms, '나');
    expect(result.map((r) => r.roomId)).toEqual([2]);
  });

  it('대소문자를 구분하지 않는다', () => {
    const result = filterRoomsByNickname(rooms, 'cat');
    expect(result.map((r) => r.roomId)).toEqual([3]);
  });

  it('일치하는 방이 없으면 빈 배열을 반환한다', () => {
    expect(filterRoomsByNickname(rooms, 'zzz')).toEqual([]);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const copy = [...rooms];
    filterRoomsByNickname(rooms, '뽀');
    expect(rooms).toEqual(copy);
  });
});
