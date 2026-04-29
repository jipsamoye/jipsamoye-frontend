'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  BoardComment,
  PageResponse,
  BoardCommentCreateRequest,
  BoardCommentUpdateRequest,
} from '@/types/api';

const PAGE_SIZE = 20;
const REPLY_BATCH = 50;

export function useBoardComments(boardId: number) {
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const commentsRef = useRef<BoardComment[]>([]);
  commentsRef.current = comments;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PageResponse<BoardComment>>(
        `/api/board-comments/board/${boardId}?page=0&size=${PAGE_SIZE}`,
      );
      setComments(res.data.content);
      setHasNext(res.data.hasNext);
      setPage(0);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loading) return;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await api.get<PageResponse<BoardComment>>(
        `/api/board-comments/board/${boardId}?page=${next}&size=${PAGE_SIZE}`,
      );
      setComments((prev) => [...prev, ...res.data.content]);
      setHasNext(res.data.hasNext);
      setPage(next);
    } finally {
      setLoading(false);
    }
  }, [boardId, page, hasNext, loading]);

  const loadReplies = useCallback(async (parentId: number) => {
    const res = await api.get<PageResponse<BoardComment>>(
      `/api/board-comments/${parentId}/replies?page=0&size=${REPLY_BATCH}`,
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
      const body: BoardCommentCreateRequest = {
        boardId,
        parentId,
        mentionedUserId: null,
        content,
      };
      const res = await api.post<BoardComment>('/api/board-comments', body);
      const created = res.data;

      if (rootId === null) {
        setComments((prev) => [{ ...created, replies: [] }, ...prev]);
      } else {
        await loadReplies(rootId);
      }
      return created;
    },
    [boardId, loadReplies],
  );

  const updateComment = useCallback(async (id: number, content: string) => {
    const body: BoardCommentUpdateRequest = { content };
    const res = await api.patch<BoardComment>(`/api/board-comments/${id}`, body);
    const updated = res.data;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === id) return { ...updated, replies: c.replies };
        if (c.replies?.some((r) => r.id === id)) {
          return {
            ...c,
            replies: c.replies.map((r) => (r.id === id ? updated : r)),
          };
        }
        return c;
      }),
    );
    return updated;
  }, []);

  const deleteComment = useCallback(async (id: number): Promise<number> => {
    await api.delete(`/api/board-comments/${id}`);
    const prev = commentsRef.current;
    const next: BoardComment[] = [];
    let countDelta = 0;
    for (const c of prev) {
      if (c.id === id) {
        countDelta -= 1;
        const hasReplies = (c.replies?.length ?? 0) > 0 || c.replyCount > 0;
        if (!hasReplies) continue;
        next.push({ ...c, content: null, isMasked: true });
        continue;
      }
      if (c.replies?.some((r) => r.id === id)) {
        countDelta -= 1;
        const newReplies = c.replies!.filter((r) => r.id !== id);
        const newCount = Math.max(0, c.replyCount - 1);
        if (c.isMasked && newCount === 0) continue;
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
