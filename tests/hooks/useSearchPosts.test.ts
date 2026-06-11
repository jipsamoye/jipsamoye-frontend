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

import { useSearchPosts } from '@/hooks/usePosts';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePage = (items: object[], hasNext = false) =>
  successRes({
    content: items,
    totalPages: hasNext ? 2 : 1,
    totalElements: items.length,
    currentPage: 0,
    size: 20,
    hasNext,
  });

const makePost = (id: number) => ({
  id,
  title: `게시글 ${id}`,
  thumbnailUrl: null,
  likeCount: 0,
  commentCount: 0,
  nickname: '작성자',
  createdAt: '2024-01-01T00:00:00',
});

describe('useSearchPosts', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  describe('loading 가드 — 중복 요청 방지', () => {
    it('search 실행 중 재호출 시 API 호출이 추가로 발생하지 않는다', async () => {
      // 첫 번째 호출은 느리게 응답 (resolve를 나중에 호출)
      let resolveFirst!: (v: unknown) => void;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
      apiMock.get.mockReturnValueOnce(firstPromise);

      const { result } = renderHook(() => useSearchPosts('강아지'));

      // 첫 번째 search 호출 (비동기 시작, 아직 완료 안 됨)
      act(() => { result.current.search(true); });

      // loading이 true가 될 때까지 대기
      await waitFor(() => expect(result.current.loading).toBe(true));

      // 두 번째 search 호출 — loading 중이므로 무시되어야 함
      await act(async () => { await result.current.search(true); });

      // 첫 번째 요청이 완료되기 전까지 API는 1번만 호출됐어야 함
      expect(apiMock.get).toHaveBeenCalledTimes(1);

      // 첫 번째 resolve 후 loading 해제
      resolveFirst(makePage([makePost(1)]));
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('첫 번째 search 완료 후 두 번째 호출은 정상 실행된다', async () => {
      apiMock.get
        .mockResolvedValueOnce(makePage([makePost(1)]))
        .mockResolvedValueOnce(makePage([makePost(2)]));

      const { result } = renderHook(() => useSearchPosts('강아지'));

      await act(async () => { await result.current.search(true); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.posts).toHaveLength(1);

      await act(async () => { await result.current.search(true); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.posts).toHaveLength(1);
      expect(apiMock.get).toHaveBeenCalledTimes(2);
    });

    it('빈 키워드면 loading 가드 이전에 조기 반환한다', async () => {
      const { result } = renderHook(() => useSearchPosts(''));

      await act(async () => { await result.current.search(true); });

      expect(apiMock.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('정상 동작', () => {
    it('search(resetPage=true) 호출 시 결과를 새로 교체하고 page를 1로 초기화한다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makePost(10), makePost(11)], true));

      const { result } = renderHook(() => useSearchPosts('고양이'));

      await act(async () => { await result.current.search(true); });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.posts.map((p) => p.id)).toEqual([10, 11]);
      expect(result.current.hasNext).toBe(true);
    });

    it('search(resetPage=false) 호출 시 기존 결과에 append한다', async () => {
      apiMock.get
        .mockResolvedValueOnce(makePage([makePost(1)], true))
        .mockResolvedValueOnce(makePage([makePost(2)], false));

      const { result } = renderHook(() => useSearchPosts('멍멍'));

      await act(async () => { await result.current.search(true); });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.search(false); });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.posts.map((p) => p.id)).toEqual([1, 2]);
      expect(result.current.hasNext).toBe(false);
    });

    it('API 실패 시 hasNext를 false로 설정하고 loading을 해제한다', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('network error'));

      const { result } = renderHook(() => useSearchPosts('오류'));

      await act(async () => { await result.current.search(true); });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasNext).toBe(false);
      expect(result.current.posts).toHaveLength(0);
    });
  });
});
