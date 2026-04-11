'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse } from '@/types/api';
import { dummyPopularPosts, dummyLatestPosts } from '@/lib/dummyData';
import PopularSlider from '@/components/domain/PopularSlider';
import PostCard from '@/components/domain/PostCard';

export default function Home() {
  const [popularPosts, setPopularPosts] = useState<PetPostListItem[]>([]);
  const [latestPosts, setLatestPosts] = useState<PetPostListItem[]>([]);
  const pageRef = useRef(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);

  // 인기 게시글
  useEffect(() => {
    api.get<PetPostListItem[]>('/api/posts/popular')
      .then((res) => setPopularPosts(res.data.length > 0 ? res.data : dummyPopularPosts))
      .catch(() => setPopularPosts(dummyPopularPosts));
  }, []);

  // 최신 게시글 무한 스크롤
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await api.get<PageResponse<PetPostListItem>>(`/api/posts?page=${pageRef.current}&size=20`);
      setLatestPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = res.data.content.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setHasNext(res.data.hasNext);
      pageRef.current += 1;
    } catch {
      if (latestPosts.length === 0) {
        setLatestPosts(dummyLatestPosts);
      }
      setHasNext(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasNext]);

  useEffect(() => {
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Intersection Observer로 무한 스크롤
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const popularSliderItems = popularPosts.map((p) => ({
    id: p.id,
    label: p.title,
    thumbnailUrl: p.thumbnailUrl,
    likeCount: p.likeCount,
    nickname: p.nickname,
  }));

  return (
    <div>
      {/* 배너 */}
      <section className="mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 p-8 md:p-12">
          <div className="relative z-10">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
              반려동물 커뮤니티
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              우리 애 자랑하러 오세요!
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-lg whitespace-nowrap">
              강아지, 고양이와 함께하는 일상을 공유하고 다른 집사들과 소통해보세요.
            </p>
          </div>
          <div className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 text-6xl md:text-8xl opacity-20 select-none">🐾</div>
          <div className="absolute right-20 md:right-32 bottom-2 text-4xl md:text-5xl opacity-10 select-none">🐕</div>
          <div className="absolute right-8 md:right-16 bottom-4 text-3xl md:text-4xl opacity-10 select-none">🐈</div>
        </div>
      </section>

      {/* 오늘의 멍냥 */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">오늘의 멍냥</h2>
        {popularPosts.length > 0 ? (
          <PopularSlider items={popularSliderItems} />
        ) : (
          <div className="text-center py-12 text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-sm">아직 인기 게시글이 없어요</p>
          </div>
        )}
      </section>

      {/* 최신 게시글 */}
      <section>
        <h2 className="text-xl font-bold mb-4">최신 게시글</h2>
        {latestPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {latestPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">🐾</p>
            <p>아직 게시글이 없어요. 첫 번째 집사가 되어보세요!</p>
          </div>
        ) : null}

        {/* 무한 스크롤 감지 영역 */}
        <div ref={observerRef} className="h-10" />
        {loading && <div className="flex justify-center py-4 text-gray-400">로딩 중...</div>}
      </section>
    </div>
  );
}
