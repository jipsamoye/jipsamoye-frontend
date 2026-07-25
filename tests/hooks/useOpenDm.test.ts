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

  it('resolve를 create=true로 호출하고 /dm?room={id}&nick= 으로 이동', async () => {
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
      `/api/dm/rooms?targetNickname=${encodeURIComponent('소금이맘')}&create=true`
    );
    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=5&nick=${encodeURIComponent('소금이맘')}`
    );
  });

  it('resolve 응답 이미지가 있으면 img 파라미터 동봉', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: 7, otherUserProfileImageUrl: 'https://cdn/a.jpg' })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=7&nick=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/a.jpg')}`
    );
  });

  it('resolve 응답에 이미지가 없으면 인자 profileImageUrl로 fallback', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: 7, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', 'https://cdn/fallback.jpg');
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=7&nick=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/fallback.jpg')}`
    );
  });

  it('roomId가 null이면(구 백엔드 방어) /dm 으로 fallback', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: null, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith('/dm');
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
