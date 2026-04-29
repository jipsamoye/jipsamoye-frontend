'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Comment,
  PageResponse,
  CommentCreateRequest,
  CommentUpdateRequest,
} from '@/types/api';

const PAGE_SIZE = 20;
const REPLY_BATCH = 50;

export function useComments(petPostId: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const commentsRef = useRef<Comment[]>([]);
  commentsRef.current = comments;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PageResponse<Comment>>(
        `/api/comments/post/${petPostId}?page=0&size=${PAGE_SIZE}`,
      );
      setComments(res.data.content);
      setHasNext(res.data.hasNext);
      setPage(0);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [petPostId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loading) return;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await api.get<PageResponse<Comment>>(
        `/api/comments/post/${petPostId}?page=${next}&size=${PAGE_SIZE}`,
      );
      setComments((prev) => [...prev, ...res.data.content]);
      setHasNext(res.data.hasNext);
      setPage(next);
    } finally {
      setLoading(false);
    }
  }, [petPostId, page, hasNext, loading]);

  const loadReplies = useCallback(async (parentId: number) => {
    const res = await api.get<PageResponse<Comment>>(
      `/api/comments/${parentId}/replies?page=0&size=${REPLY_BATCH}`,
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
      const body: CommentCreateRequest = {
        petPostId,
        parentId,
        mentionedUserId: null,
        content,
      };
      const res = await api.post<Comment>('/api/comments', body);
      const created = res.data;

      if (rootId === null) {
        setComments((prev) => [{ ...created, replies: [] }, ...prev]);
      } else {
        await loadReplies(rootId);
      }
      return created;
    },
    [petPostId, loadReplies],
  );

  const updateComment = useCallback(async (id: number, content: string) => {
    const body: CommentUpdateRequest = { content };
    const res = await api.patch<Comment>(`/api/comments/${id}`, body);
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
    await api.delete(`/api/comments/${id}`);
    const prev = commentsRef.current;
    const next: Comment[] = [];
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
        const newReplies = c.replies.filter((r) => r.id !== id);
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
