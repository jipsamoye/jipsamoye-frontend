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

import { useBoardComments } from '@/hooks/useBoardComments';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePage = (items: object[], hasNext = false) => successRes({
  content: items,
  totalPages: hasNext ? 2 : 1,
  totalElements: items.length,
  currentPage: 0,
  size: 20,
  hasNext,
});

const makeComment = (overrides: Partial<{
  id: number; content: string | null; nickname: string;
  profileImageUrl: string | null; mentionedNickname: string | null;
  isMasked: boolean; replyCount: number; replies: object[];
  createdAt: string; updatedAt: string;
}> = {}) => ({
  id: 1,
  content: '좋은 글이에요',
  nickname: '멍냥이',
  profileImageUrl: null,
  mentionedNickname: null,
  isMasked: false,
  replyCount: 0,
  replies: [],
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('useBoardComments', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  describe('load (mount)', () => {
    it('마운트 시 GET /api/board-comments/board/{boardId}?page=0&size=20 호출', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment()]));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith('/api/board-comments/board/7?page=0&size=20');
      expect(result.current.comments).toHaveLength(1);
    });
  });

  describe('loadMore', () => {
    it('hasNext=true 일 때 다음 페이지를 append 한다', async () => {
      apiMock.get
        .mockResolvedValueOnce(makePage([makeComment({ id: 1 })], true))
        .mockResolvedValueOnce(makePage([makeComment({ id: 2 })], false));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.hasNext).toBe(true);

      await act(async () => { await result.current.loadMore(); });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/board-comments/board/7?page=1&size=20');
      expect(result.current.comments.map((c) => c.id)).toEqual([1, 2]);
      expect(result.current.hasNext).toBe(false);
    });

    it('hasNext=false 면 호출하지 않는다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment()], false));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.loadMore(); });
      expect(apiMock.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadReplies', () => {
    it('해당 부모의 replies를 전체 교체하고 replyCount 갱신', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 5, replies: [] }),
      ]));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      apiMock.get.mockResolvedValueOnce({
        status: 200, code: 'SUCCESS', message: '',
        data: {
          content: [makeComment({ id: 10, mentionedNickname: '멍냥이' })],
          totalPages: 1, totalElements: 5, currentPage: 0, size: 50, hasNext: false,
        },
      });
      await act(async () => { await result.current.loadReplies(1); });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/board-comments/1/replies?page=0&size=50');
      const root = result.current.comments[0];
      expect(root.replies).toHaveLength(1);
      expect(root.replies?.[0].mentionedNickname).toBe('멍냥이');
      expect(root.replyCount).toBe(5);
    });
  });

  describe('addComment', () => {
    it('부모 댓글 작성 — POST /api/board-comments에 boardId 포함, 목록 prepend', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([]));
      apiMock.post.mockResolvedValueOnce(successRes(makeComment({ id: 99, content: '신규' })));

      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => {
        await result.current.addComment({ rootId: null, parentId: null, content: '신규' });
      });

      expect(apiMock.post).toHaveBeenCalledWith('/api/board-comments', {
        boardId: 7,
        parentId: null,
        mentionedUserId: null,
        content: '신규',
      });
      expect(result.current.comments[0].id).toBe(99);
    });

    it('답글 작성 — parentId 포함 + 작성 후 root replies refetch', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 0, replies: [] }),
      ]));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      apiMock.post.mockResolvedValueOnce(successRes(makeComment({ id: 100, content: '답글' })));
      apiMock.get.mockResolvedValueOnce({
        status: 200, code: 'SUCCESS', message: '',
        data: {
          content: [makeComment({ id: 100, content: '답글' })],
          totalPages: 1, totalElements: 1, currentPage: 0, size: 50, hasNext: false,
        },
      });

      await act(async () => {
        await result.current.addComment({ rootId: 1, parentId: 1, content: '답글' });
      });

      expect(apiMock.post).toHaveBeenCalledWith('/api/board-comments', {
        boardId: 7, parentId: 1, mentionedUserId: null, content: '답글',
      });
      expect(apiMock.get).toHaveBeenLastCalledWith('/api/board-comments/1/replies?page=0&size=50');
      expect(result.current.comments[0].replies).toHaveLength(1);
    });

    it('답글의 답글 — rootId 기준으로 replies refetch', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 1, replies: [makeComment({ id: 10 })] }),
      ]));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      apiMock.post.mockResolvedValueOnce(successRes(makeComment({ id: 200 })));
      apiMock.get.mockResolvedValueOnce({
        status: 200, code: 'SUCCESS', message: '',
        data: {
          content: [makeComment({ id: 10 }), makeComment({ id: 200, mentionedNickname: '멍냥이' })],
          totalPages: 1, totalElements: 2, currentPage: 0, size: 50, hasNext: false,
        },
      });

      await act(async () => {
        await result.current.addComment({ rootId: 1, parentId: 10, content: '답글의 답글' });
      });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/board-comments/1/replies?page=0&size=50');
      expect(result.current.comments[0].replies).toHaveLength(2);
    });
  });

  describe('updateComment', () => {
    it('PATCH /api/board-comments/{id} 호출하고 부모 댓글 갱신', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment({ id: 1, content: '원본' })]));
      apiMock.patch.mockResolvedValueOnce(successRes(makeComment({ id: 1, content: '수정본' })));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.updateComment(1, '수정본'); });

      expect(apiMock.patch).toHaveBeenCalledWith('/api/board-comments/1', { content: '수정본' });
      expect(result.current.comments[0].content).toBe('수정본');
    });

    it('답글 갱신도 처리', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replies: [makeComment({ id: 10, content: '답글원본' })], replyCount: 1 }),
      ]));
      apiMock.patch.mockResolvedValueOnce(successRes(makeComment({ id: 10, content: '답글수정' })));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.updateComment(10, '답글수정'); });

      expect(result.current.comments[0].replies?.[0].content).toBe('답글수정');
    });
  });

  describe('deleteComment', () => {
    it('답글 없는 부모 → 완전 제거 + delta=-1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment({ id: 1, replyCount: 0 })]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(1); });
      expect(apiMock.delete).toHaveBeenCalledWith('/api/board-comments/1');
      expect(result.current.comments).toHaveLength(0);
      expect(delta).toBe(-1);
    });

    it('답글 있는 부모 → 마스킹 (content=null, isMasked=true) + delta=-1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 1, replies: [makeComment({ id: 10 })] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(1); });
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].isMasked).toBe(true);
      expect(result.current.comments[0].content).toBeNull();
      expect(delta).toBe(-1);
    });

    it('답글 단순 제거 → replies에서 제거, replyCount -1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 2, replies: [makeComment({ id: 10 }), makeComment({ id: 11 })] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(10); });
      expect(result.current.comments[0].replies?.map((r) => r.id)).toEqual([11]);
      expect(result.current.comments[0].replyCount).toBe(1);
      expect(delta).toBe(-1);
    });

    it('마스킹된 부모의 마지막 답글 → 부모도 cascade 제거', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({
          id: 1, isMasked: true, content: null, replyCount: 1,
          replies: [makeComment({ id: 10 })],
        }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useBoardComments(7));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.deleteComment(10); });
      expect(result.current.comments).toHaveLength(0);
    });
  });
});
