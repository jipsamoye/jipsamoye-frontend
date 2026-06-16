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

import { useUserSearch } from '@/hooks/useUserSearch';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePage = (items: object[], hasNext = false) =>
  successRes({
    content: items,
    totalPages: 1,
    totalElements: items.length,
    currentPage: 0,
    size: 20,
    hasNext,
  });

const makeUser = (nickname: string, isFollowing = false) => ({
  nickname,
  profileImageUrl: null,
  isFollowing,
});

describe('useUserSearch', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('빈 검색어면 API를 호출하지 않고 결과를 비운다', async () => {
    const { result } = renderHook(() => useUserSearch());

    await act(async () => { await result.current.search(''); });
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);

    await act(async () => { await result.current.search('   '); });
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('검색어가 있으면 GET /api/users/search 를 q/page/size 와 함께 호출한다', async () => {
    apiMock.get.mockResolvedValueOnce(makePage([makeUser('cat')]));

    const { result } = renderHook(() => useUserSearch());

    await act(async () => { await result.current.search('cat'); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith(
      '/api/users/search?q=cat&page=0&size=20',
      { silent: true }
    );
  });

  it('PageResponse.content 를 results 로 매핑하고 isFollowing 을 보존한다', async () => {
    apiMock.get.mockResolvedValueOnce(
      makePage([makeUser('cat', true), makeUser('dog', false)])
    );

    const { result } = renderHook(() => useUserSearch());

    await act(async () => { await result.current.search('a'); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.results.map((u) => u.nickname)).toEqual(['cat', 'dog']);
    expect(result.current.results[0].isFollowing).toBe(true);
    expect(result.current.results[1].isFollowing).toBe(false);
  });

  it('API 실패 시 results 를 비우고 loading 을 해제한다', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useUserSearch());

    await act(async () => { await result.current.search('cat'); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.results).toEqual([]);
  });

  it('reset() 호출 시 results/loading 을 초기화한다', async () => {
    apiMock.get.mockResolvedValueOnce(makePage([makeUser('cat')]));

    const { result } = renderHook(() => useUserSearch());

    await act(async () => { await result.current.search('cat'); });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => { result.current.reset(); });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('reset 이후 뒤늦게 도착한 응답은 무시된다 (out-of-order 방지)', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
    apiMock.get.mockReturnValueOnce(firstPromise);

    const { result } = renderHook(() => useUserSearch());

    // 첫 검색 시작 (아직 미완료)
    act(() => { result.current.search('ca'); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    // reset 으로 더 최신 상태 진입 (검색어 비워짐 시나리오) → requestId 증가
    act(() => { result.current.reset(); });

    // 뒤늦게 첫 응답 도착 → 무시되어야 함
    resolveFirst(makePage([makeUser('cat')]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });

  it('latest-wins: 두 검색이 겹쳐 도착해도 최신(B) 결과로 수렴하고 늦게 온 A 응답은 무시된다', async () => {
    // A: 느린 첫 요청, B: 빠른 두 번째 요청 (B가 먼저 도착, A가 뒤늦게 도착)
    let resolveA!: (v: unknown) => void;
    let resolveB!: (v: unknown) => void;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });
    apiMock.get
      .mockReturnValueOnce(promiseA) // search('a') → A
      .mockReturnValueOnce(promiseB); // search('ab') → B

    const { result } = renderHook(() => useUserSearch());

    // A 검색 시작 (아직 미완료)
    act(() => { result.current.search('a'); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    // A 가 in-flight 인 상태에서 B 검색 시작 → drop 되지 않고 발사되어야 한다 (latest-wins)
    act(() => { result.current.search('ab'); });
    expect(apiMock.get).toHaveBeenCalledTimes(2);
    expect(apiMock.get).toHaveBeenNthCalledWith(
      2,
      '/api/users/search?q=ab&page=0&size=20',
      { silent: true }
    );

    // B(최신)가 먼저 도착 → results 가 B 결과로 채워진다
    resolveB(makePage([makeUser('beta')]));
    await waitFor(() => expect(result.current.results.map((u) => u.nickname)).toEqual(['beta']));
    expect(result.current.loading).toBe(false);

    // A(옛 요청)가 뒤늦게 도착 → 무시되어 B 결과가 유지된다
    resolveA(makePage([makeUser('alpha')]));
    await waitFor(() => {
      expect(result.current.results.map((u) => u.nickname)).toEqual(['beta']);
    });
    expect(result.current.loading).toBe(false);
  });
});
