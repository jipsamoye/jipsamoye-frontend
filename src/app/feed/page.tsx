'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { UsersIcon } from '@/components/layout/icons';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse } from '@/types/api';
import PostCard from '@/components/domain/PostCard';
import { PostCardSkeleton } from '@/components/common/Skeleton';

export default function FeedPage() {
  const { user, loading: authLoading } = useAuthContext();
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await api.get<PageResponse<PetPostListItem>>(`/api/posts/feed?page=${pageRef.current}&size=20`);
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = res.data.content.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setHasNext(res.data.hasNext);
      pageRef.current += 1;
    } catch {
      setHasNext(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, [hasNext]);

  // 로그인 확인 후 첫 로드
  useEffect(() => {
    if (authLoading || !user) return;
    setInitialLoading(true);
    loadMore();
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한 스크롤
  useEffect(() => {
    if (!user) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore, user]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">구독 피드</h1>

      {authLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : !user ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-20 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-500 mb-4">
            <UsersIcon filled />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">로그인 후 이용할 수 있어요</h2>
          <p className="text-sm text-gray-500">
            로그인하면 구독한 집사들의 새 자랑을 모아 볼 수 있어요.
          </p>
        </div>
      ) : initialLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : posts.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
          <div ref={observerRef} className="h-10" />
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 py-20 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-500 mb-4">
            <UsersIcon filled />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">아직 구독한 집사의 게시글이 없어요</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            마음에 드는 집사를 구독하면<br />새 자랑이 여기에 모아져요.
          </p>
        </div>
      )}
    </div>
  );
}
