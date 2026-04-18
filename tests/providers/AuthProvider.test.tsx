import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { apiMock, handlerRef } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  handlerRef: { current: null as (() => void) | null },
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
  setUnauthorizedHandler: (h: () => void) => {
    handlerRef.current = h;
  },
}));

import { AuthProvider, useAuthContext } from '@/components/providers/AuthProvider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const sampleUser = {
  nickname: '츄르맨',
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
  createdAt: '2026-04-18T00:00:00Z',
};

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: 'ok', data });

describe('AuthProvider', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
    handlerRef.current = null;
  });

  it('마운트 시 userId 파라미터 없이 /api/auth/me 를 호출한다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.get).toHaveBeenCalledWith('/api/auth/me', { silent: true });
    expect(result.current.user).toEqual(sampleUser);
  });

  it('/api/auth/me 가 실패하면 user 는 null 이다', async () => {
    apiMock.get.mockRejectedValueOnce({ status: 401, code: 'UNAUTHORIZED' });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('loginAsGuest 는 /api/auth/guest 호출 후 user 를 설정한다', async () => {
    apiMock.get.mockRejectedValueOnce({ status: 401 });
    apiMock.post.mockResolvedValueOnce(successRes(sampleUser));

    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loginAsGuest();
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/auth/guest');
    expect(result.current.user).toEqual(sampleUser);
  });

  it('logout 은 /api/auth/logout 호출 후 user 를 null 로 만든다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));
    apiMock.post.mockResolvedValueOnce(successRes(null));

    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.logout();
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/auth/logout');
    expect(result.current.user).toBeNull();
  });

  it('withdraw 는 userId 파라미터 없이 /api/auth/withdraw 를 호출한다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));
    apiMock.delete.mockResolvedValueOnce(successRes(null));

    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.withdraw();
    });

    expect(apiMock.delete).toHaveBeenCalledWith('/api/auth/withdraw');
    expect(result.current.user).toBeNull();
  });

  it('401 핸들러가 호출되면 user 가 null 이 된다 (세션 만료 시나리오)', async () => {
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));

    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    expect(handlerRef.current).not.toBeNull();

    act(() => {
      handlerRef.current?.();
    });

    expect(result.current.user).toBeNull();
  });
});
