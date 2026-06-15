import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiMock, pushMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  pushMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

import { useOpenDm } from '@/hooks/useOpenDm';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

describe('useOpenDm', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    pushMock.mockReset();
  });

  it('기존 방이 있으면 /dm?room={id} 로 이동', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({
        roomId: 5,
        otherUserNickname: '소금이맘',
        otherUserProfileImageUrl: null,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/dm/rooms?targetNickname=${encodeURIComponent('소금이맘')}`
    );
    expect(pushMock).toHaveBeenCalledWith('/dm?room=5');
  });

  it('방이 없으면(roomId=null) resolve 응답 이미지로 draft 이동 + img 동봉', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: null, otherUserProfileImageUrl: 'https://cdn/a.jpg' })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?draft=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/a.jpg')}`
    );
  });

  it('resolve 응답에 이미지가 없으면 인자 profileImageUrl로 fallback', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: null, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', 'https://cdn/fallback.jpg');
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?draft=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/fallback.jpg')}`
    );
  });

  it('이미지가 전혀 없으면 img 파라미터 없이 draft 이동', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: null, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith(`/dm?draft=${encodeURIComponent('소금이맘')}`);
  });

  it('API 실패 시 /dm 으로 fallback', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith('/dm');
  });
});
