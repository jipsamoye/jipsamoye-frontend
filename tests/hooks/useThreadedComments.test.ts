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

import { useThreadedComments, ThreadedCommentConfig, BaseThreadedComment } from '@/hooks/useThreadedComments';

// ------- 테스트용 댓글 타입 -------
interface TestComment extends BaseThreadedComment {
  id: number;
  content: string | null;
  nickname: string;
  isMasked: boolean;
  replyCount: number;
  replies?: TestComment[];
}

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePage = (items: object[], hasNext = false, total?: number) =>
  successRes({
    content: items,
    totalPages: hasNext ? 2 : 1,
    totalElements: total ?? items.length,
    currentPage: 0,
    size: 20,
    hasNext,
  });

const makeComment = (overrides: Partial<TestComment> = {}): TestComment => ({
  id: 1,
  content: '테스트',
  nickname: '집사',
  isMasked: false,
  replyCount: 0,
  replies: [],
  ...overrides,
});

// ------- 설정 헬퍼 -------
function makeConfig(entityId = 1): ThreadedCommentConfig<TestComment> {
  return {
    entityId,
    listUrl: (page) => `/api/test/${entityId}?page=${page}&size=20`,
    repliesUrl: (parentId) => `/api/test/${parentId}/replies?page=0&size=50`,
    createUrl: '/api/test',
    itemUrl: (id) => `/api/test/${id}`,
    buildCreateBody: (parentId, content) => ({ entityId, parentId, content }),
  };
}

describe('useThreadedComments', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  // ── load ──────────────────────────────────────────────────────────────────

  describe('load (mount)', () => {
    it('마운트 시 listUrl(0) 로 GET 호출하고 comments/hasNext/loaded 를 갱신한다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment({ id: 1 })]));
      const { result } = renderHook(() => useThreadedComments(makeConfig(42)));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith('/api/test/42?page=0&size=20');
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.hasNext).toBe(false);
    });

    it('빈 목록 응답도 정상 처리 — comments=[], loaded=true', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([]));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.comments).toHaveLength(0);
    });
  });

  // ── loadMore ──────────────────────────────────────────────────────────────

  describe('loadMore', () => {
    it('hasNext=true 일 때 다음 페이지를 append 하고 page 증가', async () => {
      apiMock.get
        .mockResolvedValueOnce(makePage([makeComment({ id: 1 })], true))
        .mockResolvedValueOnce(makePage([makeComment({ id: 2 })], false));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.loadMore(); });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/test/1?page=1&size=20');
      expect(result.current.comments.map((c) => c.id)).toEqual([1, 2]);
      expect(result.current.hasNext).toBe(false);
    });

    it('hasNext=false 면 API 를 호출하지 않는다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment()], false));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.loadMore(); });
      expect(apiMock.get).toHaveBeenCalledTimes(1);
    });
  });

  // ── loadReplies ───────────────────────────────────────────────────────────

  describe('loadReplies', () => {
    it('해당 부모의 replies 를 전체 교체하고 replyCount 를 totalElements 로 갱신한다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 5, replies: [] }),
      ]));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      apiMock.get.mockResolvedValueOnce(
        successRes({
          content: [makeComment({ id: 10 }), makeComment({ id: 11 })],
          totalPages: 1,
          totalElements: 5,
          currentPage: 0,
          size: 50,
          hasNext: false,
        }),
      );
      await act(async () => { await result.current.loadReplies(1); });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/test/1/replies?page=0&size=50');
      const root = result.current.comments[0];
      expect(root.replies).toHaveLength(2);
      expect(root.replyCount).toBe(5);
    });
  });

  // ── addComment ────────────────────────────────────────────────────────────

  describe('addComment', () => {
    it('rootId=null 이면 POST 후 생성된 항목을 목록 앞에 prepend 한다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment({ id: 1 })]));
      apiMock.post.mockResolvedValueOnce(successRes(makeComment({ id: 99, content: '신규' })));
      const { result } = renderHook(() => useThreadedComments(makeConfig(7)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => {
        await result.current.addComment({ rootId: null, parentId: null, content: '신규' });
      });

      expect(apiMock.post).toHaveBeenCalledWith('/api/test', {
        entityId: 7,
        parentId: null,
        content: '신규',
      });
      expect(result.current.comments[0].id).toBe(99);
      expect(result.current.comments[1].id).toBe(1);
    });

    it('rootId!=null (답글) 이면 POST 후 loadReplies(rootId) 를 호출한다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 0, replies: [] }),
      ]));
      apiMock.post.mockResolvedValueOnce(successRes(makeComment({ id: 100 })));
      apiMock.get.mockResolvedValueOnce(
        successRes({
          content: [makeComment({ id: 100, content: '답글' })],
          totalPages: 1, totalElements: 1, currentPage: 0, size: 50, hasNext: false,
        }),
      );
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => {
        await result.current.addComment({ rootId: 1, parentId: 1, content: '답글' });
      });

      expect(apiMock.get).toHaveBeenLastCalledWith('/api/test/1/replies?page=0&size=50');
      expect(result.current.comments[0].replies).toHaveLength(1);
    });
  });

  // ── updateComment ─────────────────────────────────────────────────────────

  describe('updateComment', () => {
    it('PATCH itemUrl(id) 호출 후 부모 댓글 내용 갱신, replies 유지', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([makeComment({ id: 1, content: '원본' })]));
      apiMock.patch.mockResolvedValueOnce(successRes(makeComment({ id: 1, content: '수정본' })));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.updateComment(1, '수정본'); });

      expect(apiMock.patch).toHaveBeenCalledWith('/api/test/1', { content: '수정본' });
      expect(result.current.comments[0].content).toBe('수정본');
    });

    it('답글 수정 — 해당 replies 항목만 갱신된다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replies: [makeComment({ id: 10, content: '답글원본' })], replyCount: 1 }),
      ]));
      apiMock.patch.mockResolvedValueOnce(successRes(makeComment({ id: 10, content: '답글수정' })));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.updateComment(10, '답글수정'); });

      expect(result.current.comments[0].replies?.[0].content).toBe('답글수정');
    });
  });

  // ── deleteComment ─────────────────────────────────────────────────────────

  describe('deleteComment', () => {
    it('(a) 답글 있는 root 삭제 → 마스킹 유지 (content=null, isMasked=true) + delta=-1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 1, replies: [makeComment({ id: 10 })] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(1); });

      expect(apiMock.delete).toHaveBeenCalledWith('/api/test/1');
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].isMasked).toBe(true);
      expect(result.current.comments[0].content).toBeNull();
      expect(delta).toBe(-1);
      // 답글은 그대로 유지
      expect(result.current.comments[0].replies).toHaveLength(1);
    });

    it('(b) 답글 없는 root 삭제 → 완전 제거 + delta=-1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 0, replies: [] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(1); });

      expect(result.current.comments).toHaveLength(0);
      expect(delta).toBe(-1);
    });

    it('(b-2) replyCount>0 지만 replies=[] — hasReplies 판정은 replyCount 도 포함', async () => {
      // replies 배열이 로딩 안 됐어도 replyCount>0 이면 마스킹
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 3, replies: [] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.deleteComment(1); });

      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].isMasked).toBe(true);
    });

    it('(c) 마스킹된 root 의 마지막 답글 삭제 → cascade 제거 (부모도 사라짐)', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({
          id: 1, isMasked: true, content: null, replyCount: 1,
          replies: [makeComment({ id: 10 })],
        }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.deleteComment(10); });

      expect(result.current.comments).toHaveLength(0);
    });

    it('(c-2) 마스킹된 root 의 답글이 여러 개일 때 하나 삭제 → cascade 없음', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({
          id: 1, isMasked: true, content: null, replyCount: 2,
          replies: [makeComment({ id: 10 }), makeComment({ id: 11 })],
        }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.deleteComment(10); });

      // 부모 마스킹 유지, replyCount -1, 해당 답글만 제거
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].isMasked).toBe(true);
      expect(result.current.comments[0].replyCount).toBe(1);
      expect(result.current.comments[0].replies?.map((r) => r.id)).toEqual([11]);
    });

    it('(d) countDelta — 답글 삭제 시 delta=-1', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 2, replies: [makeComment({ id: 10 }), makeComment({ id: 11 })] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(10); });

      expect(delta).toBe(-1);
      expect(result.current.comments[0].replies?.map((r) => r.id)).toEqual([11]);
      expect(result.current.comments[0].replyCount).toBe(1);
    });

    it('(d-2) countDelta — 마스킹된 root 마지막 답글 cascade 시 delta=-1 (부모는 이미 카운트 외)', async () => {
      // cascade 시 답글 삭제만 카운트(-1), 부모는 이미 마스킹돼 추가 delta 없음
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({
          id: 1, isMasked: true, content: null, replyCount: 1,
          replies: [makeComment({ id: 10 })],
        }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      let delta = 0;
      await act(async () => { delta = await result.current.deleteComment(10); });

      expect(delta).toBe(-1);
      expect(result.current.comments).toHaveLength(0);
    });

    it('관계없는 댓글들은 그대로 유지된다', async () => {
      apiMock.get.mockResolvedValueOnce(makePage([
        makeComment({ id: 1, replyCount: 0, replies: [] }),
        makeComment({ id: 2, replyCount: 0, replies: [] }),
      ]));
      apiMock.delete.mockResolvedValueOnce(successRes(null));
      const { result } = renderHook(() => useThreadedComments(makeConfig(1)));
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => { await result.current.deleteComment(1); });

      expect(result.current.comments.map((c) => c.id)).toEqual([2]);
    });
  });
});
