'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PetPost, PetPostListItem, CursorResponse, SliceResponse } from '@/types/api';

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
  const cursorRef = useRef<number | null>(null);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasNext) return;
    setLoading(true);
    try {
      const url =
        cursorRef.current == null
          ? '/api/posts?size=20'
          : `/api/posts?cursor=${cursorRef.current}&size=20`;
      const res = await api.get<CursorResponse<PetPostListItem>>(url);
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = res.data.content.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setHasNext(res.data.hasNext);
      cursorRef.current = res.data.nextCursor;
    } catch {
      setHasNext(false);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [loading, hasNext]);

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
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  const search = useCallback(async (resetPage = false) => {
    if (keyword.trim().length < 2) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    // 새 검색 시작 시 이전 결과를 즉시 비워 로딩 상태가 자연스럽게 보이도록 한다
    if (resetPage) {
      setPosts([]);
      setHasNext(true);
    }
    const currentPage = resetPage ? 0 : pageRef.current;
    setLoading(true);
    try {
      const res = await api.get<SliceResponse<PetPostListItem>>(
        `/api/posts/search?q=${encodeURIComponent(keyword)}&page=${currentPage}&size=20`
      );
      if (resetPage) {
        setPosts(res.data.content);
        pageRef.current = 1;
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPosts = res.data.content.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
        pageRef.current += 1;
      }
      setHasNext(res.data.hasNext);
    } catch {
      setHasNext(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [keyword]);

  return { posts, loading, hasNext, search, setPosts };
}
