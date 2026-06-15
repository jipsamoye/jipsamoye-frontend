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

import { useLatestPosts } from '@/hooks/usePosts';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

// 커서 페이징 응답 헬퍼
const makeCursorPage = (
  items: object[],
  { hasNext = false, nextCursor = null as number | null } = {}
) =>
  successRes({
    content: items,
    size: 20,
    hasNext,
    nextCursor,
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

describe('useLatestPosts (커서 페이징)', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('마운트 시 첫 요청은 cursor 없이 /api/posts?size=20 으로 나간다', async () => {
    apiMock.get.mockResolvedValueOnce(
      makeCursorPage([makePost(100), makePost(99)], { hasNext: true, nextCursor: 99 })
    );

    const { result } = renderHook(() => useLatestPosts());

    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/api/posts?size=20');
    expect(result.current.posts.map((p) => p.id)).toEqual([100, 99]);
    expect(result.current.hasNext).toBe(true);
  });

  it('nextCursor 수신 후 다음 loadMore는 cursor 쿼리를 붙여 요청한다', async () => {
    apiMock.get
      .mockResolvedValueOnce(
        makeCursorPage([makePost(100), makePost(99)], { hasNext: true, nextCursor: 99 })
      )
      .mockResolvedValueOnce(
        makeCursorPage([makePost(98), makePost(97)], { hasNext: true, nextCursor: 97 })
      );

    const { result } = renderHook(() => useLatestPosts());

    // 마운트 시 1차 자동 호출 완료 대기
    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.get).toHaveBeenCalledTimes(2);
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/api/posts?cursor=99&size=20');
    expect(result.current.posts.map((p) => p.id)).toEqual([100, 99, 98, 97]);
  });

  it('hasNext=false / nextCursor=null 수신 시 추가 loadMore는 가드로 호출되지 않는다', async () => {
    apiMock.get.mockResolvedValueOnce(
      makeCursorPage([makePost(1)], { hasNext: false, nextCursor: null })
    );

    const { result } = renderHook(() => useLatestPosts());

    await waitFor(() => expect(result.current.hasNext).toBe(false));
    expect(apiMock.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadMore();
    });

    // hasNext=false 가드로 추가 호출 없음
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });

  it('append 시 동일 id는 중복 제거된다 (1페이지 [3,2], 2페이지 [2,1] → [3,2,1])', async () => {
    apiMock.get
      .mockResolvedValueOnce(
        makeCursorPage([makePost(3), makePost(2)], { hasNext: true, nextCursor: 2 })
      )
      .mockResolvedValueOnce(
        makeCursorPage([makePost(2), makePost(1)], { hasNext: false, nextCursor: null })
      );

    const { result } = renderHook(() => useLatestPosts());

    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.posts.map((p) => p.id)).toEqual([3, 2, 1]);
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/api/posts?cursor=2&size=20');
  });

  it('API 실패 시 hasNext를 false로 두고 initialLoading을 해제한다', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useLatestPosts());

    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    expect(result.current.hasNext).toBe(false);
    expect(result.current.posts).toHaveLength(0);
  });
});
