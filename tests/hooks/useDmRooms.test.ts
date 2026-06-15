import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
}));

import { useDmRooms } from '@/hooks/useDmRooms';
import type { DmRoom } from '@/types/api';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makeRoom = (overrides: Partial<DmRoom> = {}): DmRoom => ({
  roomId: 1,
  otherUserNickname: '테스터',
  otherUserProfileImageUrl: null,
  lastMessage: '안녕',
  lastMessageAt: '2026-06-11T10:00:00',
  unreadCount: 2,
  ...overrides,
});

describe('useDmRooms', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('마운트 시 GET /api/dm/rooms 호출하고 rooms 세팅', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([makeRoom()]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));
    expect(apiMock.get).toHaveBeenCalledWith('/api/dm/rooms');
  });

  it('userNickname이 null이면 API 호출하지 않음', () => {
    const { result } = renderHook(() => useDmRooms(null));
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(result.current.rooms).toHaveLength(0);
  });

  it('resetUnread: 해당 방의 unreadCount를 0으로 리셋', async () => {
    apiMock.get.mockResolvedValueOnce(
      successRes([makeRoom({ roomId: 1, unreadCount: 3 }), makeRoom({ roomId: 2, unreadCount: 1 })])
    );
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));

    act(() => result.current.resetUnread(1));

    expect(result.current.rooms.find((r) => r.roomId === 1)?.unreadCount).toBe(0);
    // 다른 방은 그대로
    expect(result.current.rooms.find((r) => r.roomId === 2)?.unreadCount).toBe(1);
  });

  it('updateLastMessage: lastMessage만 낙관적으로 갱신, lastMessageAt은 변경 안 함', async () => {
    const originalAt = '2026-06-11T10:00:00';
    apiMock.get.mockResolvedValueOnce(
      successRes([makeRoom({ roomId: 1, lastMessage: '이전', lastMessageAt: originalAt })])
    );
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    act(() => result.current.updateLastMessage(1, '새 메시지'));

    const room = result.current.rooms[0];
    expect(room.lastMessage).toBe('새 메시지');
    expect(room.lastMessageAt).toBe(originalAt); // 시간 변경 없음
  });

  it('applyServerLastMessage: lastMessage + lastMessageAt 모두 서버 값으로 갱신', async () => {
    apiMock.get.mockResolvedValueOnce(
      successRes([makeRoom({ roomId: 1, lastMessage: '이전', lastMessageAt: '2026-06-11T10:00:00' })])
    );
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    const serverAt = '2026-06-11T11:00:00';
    act(() => result.current.applyServerLastMessage(1, '서버메시지', serverAt));

    const room = result.current.rooms[0];
    expect(room.lastMessage).toBe('서버메시지');
    expect(room.lastMessageAt).toBe(serverAt);
  });

  it('API 실패 시 빈 배열로 세팅', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(0));
  });

  // ─── [버그②] applyRoomUpdate ─────────────────────────────────────────────

  it('applyRoomUpdate: 기존 방의 lastMessage/at/unread 갱신 + 최상단 정렬', async () => {
    apiMock.get.mockResolvedValueOnce(
      successRes([
        makeRoom({ roomId: 1, lastMessage: 'a', unreadCount: 0 }),
        makeRoom({ roomId: 2, lastMessage: 'b', unreadCount: 0 }),
      ])
    );
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));

    act(() =>
      result.current.applyRoomUpdate(
        makeRoom({ roomId: 2, lastMessage: '새 메시지', lastMessageAt: '2026-06-11T12:00:00', unreadCount: 4 }),
        null // 열린 방 없음
      )
    );

    // roomId 2가 최상단으로
    expect(result.current.rooms[0].roomId).toBe(2);
    expect(result.current.rooms[0].lastMessage).toBe('새 메시지');
    expect(result.current.rooms[0].lastMessageAt).toBe('2026-06-11T12:00:00');
    expect(result.current.rooms[0].unreadCount).toBe(4);
    expect(result.current.rooms).toHaveLength(2);
  });

  it('applyRoomUpdate: 목록에 없는 방이면 최상단에 새로 삽입', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([makeRoom({ roomId: 1 })]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    act(() =>
      result.current.applyRoomUpdate(
        makeRoom({ roomId: 99, otherUserNickname: '신규', lastMessage: '첫 메시지', unreadCount: 1 }),
        null
      )
    );

    expect(result.current.rooms).toHaveLength(2);
    expect(result.current.rooms[0].roomId).toBe(99);
    expect(result.current.rooms[0].otherUserNickname).toBe('신규');
  });

  it('applyRoomUpdate: 현재 열려 있는 방이면 unreadCount를 0으로 강제', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([makeRoom({ roomId: 1, unreadCount: 0 })]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    // 서버 payload는 unread 5지만, 열린 방이므로 0으로 강제
    act(() =>
      result.current.applyRoomUpdate(makeRoom({ roomId: 1, unreadCount: 5 }), 1)
    );

    expect(result.current.rooms[0].unreadCount).toBe(0);
  });
});
