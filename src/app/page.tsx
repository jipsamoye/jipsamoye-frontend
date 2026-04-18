'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
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

  useEffect(() => {
    api.get<PetPostListItem[]>('/api/posts/top10')
      .then((res) => setPopularPosts(res.data.length > 0 ? res.data : dummyPopularPosts))
      .catch(() => setPopularPosts(dummyPopularPosts));
  }, []);

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
    <div className="space-y-10">
      {/* 배너 — 토스 스타일 깔끔한 카드 */}
      <section>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-8 md:p-12 shadow-sm border border-amber-100/50">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold mb-4">
              반려동물 커뮤니티
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 font-[family-name:var(--font-jua)]">
              우리 애 자랑하러 오세요!
            </h1>
            <p className="text-sm md:text-base text-gray-500 max-w-lg leading-relaxed">
              강아지, 고양이와 함께하는 일상을 공유하고<br className="hidden md:block" /> 다른 집사들과 소통해보세요.
            </p>
          </div>
          <div className="absolute right-6 md:right-16 top-1/2 -translate-y-1/2 text-7xl md:text-9xl opacity-10 select-none">🐾</div>
        </div>
      </section>

      {/* 이주의 멍냥 — 토스 스타일 섹션 헤더 */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold font-[family-name:var(--font-jua)] text-gray-900">이주의 멍냥</h2>
          <Link href="/ranking" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            전체보기 →
          </Link>
        </div>
        {popularPosts.length > 0 ? (
          <PopularSlider items={popularSliderItems} />
        ) : (
          <div className="text-center py-14 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-sm">아직 인기 게시글이 없어요</p>
          </div>
        )}
      </section>

      {/* 자유게시판 + 공지사항 — 토스 스타일 카드 분할 */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 자유게시판 최신 글 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">자유게시판 최신 글</h3>
              <Link href="/board" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                더보기
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-gray-300">📝</span>
                <span className="truncate">혹시 이런 글찍어 보신 분 계시나요?</span>
                <span className="text-xs text-gray-300 flex-shrink-0">2분 전</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-gray-300">📝</span>
                <span className="truncate">강아지 사료 추천 부탁드려요!</span>
                <span className="text-xs text-gray-300 flex-shrink-0">15분 전</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-gray-300">📝</span>
                <span className="truncate">고양이 장난감 뭐가 좋을까요</span>
                <span className="text-xs text-gray-300 flex-shrink-0">1시간 전</span>
              </div>
            </div>
          </div>

          {/* 공지사항 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">공지사항</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-amber-400">📢</span>
                <span className="truncate">집사모여 서비스 오픈 안내</span>
                <span className="text-xs text-gray-300 flex-shrink-0">2026.04.14</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-amber-400">📢</span>
                <span className="truncate">커뮤니티 이용 규칙 안내</span>
                <span className="text-xs text-gray-300 flex-shrink-0">2026.04.14</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 최신 게시글 — 토스 스타일 */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold font-[family-name:var(--font-jua)] text-gray-900">최신 게시글</h2>
        </div>
        {latestPosts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {latestPosts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🐾</p>
            <p className="text-sm">아직 게시글이 없어요. 첫 번째 집사가 되어보세요!</p>
          </div>
        ) : null}

        <div ref={observerRef} className="h-10" />
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </section>
    </div>
  );
}
