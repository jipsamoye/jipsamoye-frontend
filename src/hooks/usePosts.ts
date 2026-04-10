'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PetPost, PetPostListItem, PageResponse } from '@/types/api';

export function usePopularPosts() {
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PetPostListItem[]>('/api/posts/popular')
      .then((res) => setPosts(res.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading };
}

export function useLatestPosts() {
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasNext) return;
    setLoading(true);
    try {
      const res = await api.get<PageResponse<PetPostListItem>>(`/api/posts?page=${page}&size=20`);
      setPosts((prev) => [...prev, ...res.data.content]);
      setHasNext(res.data.hasNext);
      setPage((prev) => prev + 1);
    } catch {
      setHasNext(false);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [page, loading, hasNext]);

  useEffect(() => {
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { posts, loading, initialLoading, hasNext, loadMore };
}

export function usePost(id: number) {
  const [post, setPost] = useState<PetPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PetPost>(`/api/posts/${id}`)
      .then((res) => setPost(res.data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { post, loading };
}

export function useSearchPosts(keyword: string) {
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (resetPage = false) => {
    if (!keyword.trim()) return;
    const currentPage = resetPage ? 0 : page;
    setLoading(true);
    try {
      const res = await api.get<PageResponse<PetPostListItem>>(
        `/api/posts/search?q=${encodeURIComponent(keyword)}&page=${currentPage}&size=20`
      );
      if (resetPage) {
        setPosts(res.data.content);
        setPage(1);
      } else {
        setPosts((prev) => [...prev, ...res.data.content]);
        setPage((prev) => prev + 1);
      }
      setHasNext(res.data.hasNext);
    } catch {
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  return { posts, loading, hasNext, search, setPosts };
}
