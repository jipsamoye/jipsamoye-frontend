'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse, BoardListItem } from '@/types/api';
import { dummyPopularPosts, dummyLatestPosts } from '@/lib/dummyData';
import { timeAgoOrDate } from '@/lib/utils';
import PopularSlider from '@/components/domain/PopularSlider';
import PostCard from '@/components/domain/PostCard';
import { PostCardSkeleton, PopularSliderSkeleton } from '@/components/common/Skeleton';
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const [popularPosts, setPopularPosts] = useState<PetPostListItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [latestPosts, setLatestPosts] = useState<PetPostListItem[]>([]);
  const [initialLatestLoading, setInitialLatestLoading] = useState(true);
  const [boardPosts, setBoardPosts] = useState<BoardListItem[]>([]);
  const pageRef = useRef(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const latestSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.get<PetPostListItem[]>('/api/posts/top10')
      .then((res) => setPopularPosts(res.data.length > 0 ? res.data : dummyPopularPosts))
      .catch(() => setPopularPosts(dummyPopularPosts))
      .finally(() => setPopularLoading(false));

    api.get<PageResponse<BoardListItem>>('/api/boards?page=0&size=5', { silent: true })
      .then((res) => setBoardPosts(res.data.content))
      .catch(() => {});
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
      setInitialLatestLoading(false);
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

  // ?section=latest 진입 시 최신 자랑 섹션으로 부드럽게 스크롤
  useEffect(() => {
    if (sectionParam === 'latest' && !initialLatestLoading && latestSectionRef.current) {
      latestSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sectionParam, initialLatestLoading]);

  const popularSliderItems = popularPosts.map((p) => ({
    id: p.id,
    label: p.title,
    thumbnailUrl: p.thumbnailUrl,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    nickname: p.nickname,
    profileImageUrl: p.profileImageUrl,
  }));

  return (
    <div className="space-y-10">
      {/* 배너 */}
      <section>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-5 py-4 md:px-7 md:py-5 shadow-sm border border-amber-100/50">
          <div className="relative z-10">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold mb-1.5">
              반려동물 커뮤니티
            </span>
            <h1 className="text-base md:text-lg font-bold text-gray-900 mb-0.5">
              우리 애 자랑하러 오세요!
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              강아지, 고양이와 함께하는 일상을 공유해 보세요.
            </p>
          </div>
          <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-4xl md:text-5xl opacity-10 select-none">🐾</div>
        </div>
      </section>

      {/* 이주의 자랑 */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">이주의 자랑</h2>
          <Link href="/ranking" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            더보기
          </Link>
        </div>
        {popularLoading ? (
          <PopularSliderSkeleton />
        ) : popularPosts.length > 0 ? (
          <PopularSlider items={popularSliderItems} />
        ) : (
          <div className="text-center py-14 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-sm">아직 인기 게시글이 없어요</p>
          </div>
        )}
      </section>

      {/* 자유게시판 최신 글 + 공지사항 */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 자유게시판 최신 글 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">자유게시판 최신 글</h3>
              <Link href="/board" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                더보기
              </Link>
            </div>
            <div className="space-y-3">
              {boardPosts.length > 0 ? boardPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => router.push(`/board/${post.id}`)}
                  className="w-full flex items-center justify-between gap-3 text-left hover:opacity-70 transition-opacity"
                >
                  <span className="text-sm text-gray-700 truncate">{post.title}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {timeAgoOrDate(post.createdAt)}
                  </span>
                </button>
              )) : (
                <p className="text-sm text-gray-400">아직 게시글이 없어요</p>
              )}
            </div>
          </div>

          {/* 공지사항 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">공지사항</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 truncate">집사모여 서비스 오픈 안내</span>
                <span className="text-xs text-gray-400 flex-shrink-0">04. 14.</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 truncate">커뮤니티 이용 규칙 안내</span>
                <span className="text-xs text-gray-400 flex-shrink-0">04. 14.</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 최신 자랑 */}
      <section ref={latestSectionRef} id="latest">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">최신 자랑</h2>
        </div>
        {initialLatestLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : latestPosts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {latestPosts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🐾</p>
            <p className="text-sm">아직 게시글이 없어요. 첫 번째 집사가 되어보세요!</p>
          </div>
        )}

        <div ref={observerRef} className="h-10" />
        {loading && !initialLatestLoading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="space-y-10" />}>
      <HomeContent />
    </Suspense>
  );
}
