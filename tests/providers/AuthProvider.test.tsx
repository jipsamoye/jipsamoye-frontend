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

function wipeCookies() {
  document.cookie.split('; ').forEach((c) => {
    const [name] = c.split('=');
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
}

function setHint() {
  document.cookie = 'has_session=1; Path=/';
}

describe('AuthProvider', () => {
  beforeEach(() => {
    wipeCookies();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
    handlerRef.current = null;
  });

  it('힌트 쿠키가 없으면 /api/auth/me 를 호출하지 않고 바로 비로그인 상태가 된다', async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.get).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('힌트 쿠키가 있으면 userId 파라미터 없이 /api/auth/me 를 호출한다', async () => {
    setHint();
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.get).toHaveBeenCalledWith('/api/auth/me', { silent: true });
    expect(result.current.user).toEqual(sampleUser);
  });

  it('힌트는 있지만 /api/auth/me 가 실패하면 힌트 쿠키를 자가 정리하고 user 는 null 이다', async () => {
    setHint();
    apiMock.get.mockRejectedValueOnce({ status: 401, code: 'UNAUTHORIZED' });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    // 세션 만료 드리프트 방어: 힌트 쿠키가 남아있지 않아야 한다
    expect(document.cookie).not.toContain('has_session=1');
  });

  it('loginAsGuest 는 /api/auth/guest 호출 후 user 를 설정한다', async () => {
    // 비로그인 상태(쿠키 없음)이므로 /me 는 호출되지 않는다
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
    setHint();
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
    setHint();
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

  it('401 핸들러가 호출되면 힌트 쿠키도 정리되고 user 가 null 이 된다', async () => {
    setHint();
    apiMock.get.mockResolvedValueOnce(successRes(sampleUser));

    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    expect(handlerRef.current).not.toBeNull();

    act(() => {
      handlerRef.current?.();
    });

    expect(result.current.user).toBeNull();
    expect(document.cookie).not.toContain('has_session=1');
  });
});
