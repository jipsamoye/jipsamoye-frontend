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
});
