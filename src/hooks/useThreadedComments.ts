'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageResponse } from '@/types/api';

const PAGE_SIZE = 20;
const REPLY_BATCH = 50;

/** useThreadedComments 가 의존하는 최소 필드 */
export interface BaseThreadedComment {
  id: number;
  content: string | null;
  isMasked: boolean;
  replyCount: number;
  replies?: BaseThreadedComment[];
}

export interface ThreadedCommentConfig<TComment extends BaseThreadedComment> {
  /**
   * 목록 조회 URL 생성 함수 (page, size 파라미터 포함)
   * 예: `/api/comments/post/1?page=0&size=20`
   */
  listUrl: (page: number) => string;
  /**
   * 답글 조회 URL 생성 함수
   * 예: `/api/comments/1/replies?page=0&size=50`
   */
  repliesUrl: (parentId: number) => string;
  /** 댓글/답글 생성 URL (예: `/api/comments`) */
  createUrl: string;
  /** 단일 댓글 URL — 수정/삭제용 (예: `/api/comments/1`) */
  itemUrl: (id: number) => string;
  /** POST body 생성 */
  buildCreateBody: (parentId: number | null, content: string) => object;
  /**
   * config 주체의 식별자 (예: petPostId, boardId).
   * 이 값이 바뀌면 목록을 다시 로드한다.
   */
  entityId: number;
}

export function useThreadedComments<TComment extends BaseThreadedComment>(
  config: ThreadedCommentConfig<TComment>,
) {
  const [comments, setComments] = useState<TComment[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const commentsRef = useRef<TComment[]>([]);
  commentsRef.current = comments;

  // config 레퍼런스를 ref 로 안정화 (최신값을 항상 참조)
  const configRef = useRef(config);
  configRef.current = config;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PageResponse<TComment>>(
        configRef.current.listUrl(0),
      );
      setComments(res.data.content);
      setHasNext(res.data.hasNext);
      setPage(0);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [config.entityId]); // entityId 바뀌면 load 재생성 → useEffect 재실행

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loading) return;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await api.get<PageResponse<TComment>>(
        configRef.current.listUrl(next),
      );
      setComments((prev) => [...prev, ...res.data.content]);
      setHasNext(res.data.hasNext);
      setPage(next);
    } finally {
      setLoading(false);
    }
  }, [page, hasNext, loading]);

  const loadReplies = useCallback(async (parentId: number) => {
    const res = await api.get<PageResponse<TComment>>(
      configRef.current.repliesUrl(parentId),
    );
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: res.data.content, replyCount: res.data.totalElements }
          : c,
      ),
    );
  }, []);

  const addComment = useCallback(
    async ({
      rootId,
      parentId,
      content,
    }: {
      rootId: number | null;
      parentId: number | null;
      content: string;
    }) => {
      const body = configRef.current.buildCreateBody(parentId, content);
      const res = await api.post<TComment>(configRef.current.createUrl, body);
      const created = res.data;

      if (rootId === null) {
        setComments((prev) => [{ ...created, replies: [] }, ...prev]);
      } else {
        await loadReplies(rootId);
      }
      return created;
    },
    [loadReplies],
  );

  const updateComment = useCallback(async (id: number, content: string) => {
    const res = await api.patch<TComment>(configRef.current.itemUrl(id), { content });
    const updated = res.data;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === id) return { ...updated, replies: c.replies } as TComment;
        if (c.replies?.some((r) => r.id === id)) {
          return {
            ...c,
            replies: c.replies.map((r) => (r.id === id ? updated : r)),
          } as TComment;
        }
        return c;
      }),
    );
    return updated;
  }, []);

  const deleteComment = useCallback(async (id: number): Promise<number> => {
    await api.delete(configRef.current.itemUrl(id));
    const prev = commentsRef.current;
    const next: TComment[] = [];
    let countDelta = 0;
    for (const c of prev) {
      if (c.id === id) {
        countDelta -= 1;
        const hasReplies = (c.replies?.length ?? 0) > 0 || c.replyCount > 0;
        if (!hasReplies) continue; // 완전 제거
        next.push({ ...c, content: null, isMasked: true }); // 마스킹
        continue;
      }
      if (c.replies?.some((r) => r.id === id)) {
        countDelta -= 1;
        const newReplies = c.replies!.filter((r) => r.id !== id);
        const newCount = Math.max(0, c.replyCount - 1);
        if (c.isMasked && newCount === 0) continue; // cascade
        next.push({ ...c, replies: newReplies, replyCount: newCount });
        continue;
      }
      next.push(c);
    }
    setComments(next);
    return countDelta;
  }, []);

  return {
    comments,
    hasNext,
    loading,
    loaded,
    load,
    loadMore,
    loadReplies,
    addComment,
    updateComment,
    deleteComment,
  };
}
