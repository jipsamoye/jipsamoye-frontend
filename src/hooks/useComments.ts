'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Comment, PageResponse } from '@/types/api';

export function useComments(postId: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadMore = useCallback(async () => {
    try {
      const res = await api.get<PageResponse<Comment>>(`/api/posts/${postId}/comments?page=${page}&size=20`);
      setComments((prev) => [...prev, ...res.data.content]);
      setHasNext(res.data.hasNext);
      setPage((prev) => prev + 1);
    } catch {
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [postId, page]);

  useEffect(() => {
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addComment = useCallback(async (content: string) => {
    try {
      const res = await api.post<Comment>(`/api/posts/${postId}/comments`, { content });
      setComments((prev) => [res.data, ...prev]);
      return res.data;
    } catch {
      return null;
    }
  }, [postId]);

  const updateComment = useCallback(async (commentId: number, content: string) => {
    try {
      const res = await api.patch<Comment>(`/api/comments/${commentId}`, { content });
      setComments((prev) => prev.map((c) => c.id === commentId ? res.data : c));
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const deleteComment = useCallback(async (commentId: number) => {
    try {
      await api.delete(`/api/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { comments, loading, hasNext, loadMore, addComment, updateComment, deleteComment };
}
