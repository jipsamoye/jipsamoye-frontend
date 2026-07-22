'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse, CursorResponse, BoardListItem, RankingPageResponse } from '@/types/api';
import { dummyLatestPosts } from '@/lib/dummyData';
import { timeAgoOrDate } from '@/lib/utils';
import PopularSlider from '@/components/domain/PopularSlider';
import PostCard from '@/components/domain/PostCard';
import { PostCardSkeleton, PopularSliderSkeleton } from '@/components/common/Skeleton';
import { useScrollRestore } from '@/hooks/useScrollRestore';

interface HomeSnapshot {
  popularPosts: PetPostListItem[];
  boardPosts: BoardListItem[];
  latestPosts: PetPostListItem[];
  cursor: number | null;
  hasNext: boolean;
}

function isHomeSnapshot(data: unknown): data is HomeSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.popularPosts) &&
    Array.isArray(d.boardPosts) &&
    Array.isArray(d.latestPosts) &&
    (typeof d.cursor === 'number' || d.cursor === null) &&
    typeof d.hasNext === 'boolean'
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const [popularPosts, setPopularPosts] = useState<PetPostListItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [latestPosts, setLatestPosts] = useState<PetPostListItem[]>([]);
  const [initialLatestLoading, setInitialLatestLoading] = useState(true);
  const [boardPosts, setBoardPosts] = useState<BoardListItem[]>([]);
  const cursorRef = useRef<number | null>(null);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const latestSectionRef = useRef<HTMLElement>(null);

  // 최신 상태를 capture에서 읽을 수 있도록 ref 미러
  const popularPostsRef = useRef(popularPosts);
  popularPostsRef.current = popularPosts;
  const boardPostsRef = useRef(boardPosts);
  boardPostsRef.current = boardPosts;
  const latestPostsRef = useRef(latestPosts);
  latestPostsRef.current = latestPosts;
  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;

  const restored = useScrollRestore<HomeSnapshot>('home', {
    capture: () => {
      // 로딩 중이면 빈 목록 저장 방지 — null 반환으로 저장 스킵
      if (popularLoading || initialLatestLoading || latestPostsRef.current.length === 0) {
        return null;
      }
      return {
        popularPosts: popularPostsRef.current,
        boardPosts: boardPostsRef.current,
        latestPosts: latestPostsRef.current,
        cursor: cursorRef.current,
        hasNext: hasNextRef.current,
      };
    },
    restore: (snap) => {
      setPopularPosts(snap.popularPosts);
      setBoardPosts(snap.boardPosts);
      setLatestPosts(snap.latestPosts);
      cursorRef.current = snap.cursor;
      setHasNext(snap.hasNext);
      setPopularLoading(false);
      setInitialLatestLoading(false);
    },
    validate: isHomeSnapshot,
  });

  useEffect(() => {
    if (restored) return; // 복원 시 fetch 생략
    // "이주의 자랑" = 이번 주(월~일) 올라온 글 중 좋아요순 상위 10개.
    // /top10(역대 누적)이 아닌 주간 랭킹을 사용해야 라벨 의미와 일치한다.
    api.get<RankingPageResponse>('/api/posts/ranking?period=WEEKLY&page=0&size=10')
      .then((res) => setPopularPosts(res.data.posts.content))
      .catch(() => setPopularPosts([]))
      .finally(() => setPopularLoading(false));

    api.get<PageResponse<BoardListItem>>('/api/boards?page=0&size=3', { silent: true })
      .then((res) => setBoardPosts(res.data.content))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url =
        cursorRef.current == null
          ? '/api/posts?size=20'
          : `/api/posts?cursor=${cursorRef.current}&size=20`;
      const res = await api.get<CursorResponse<PetPostListItem>>(url);
      setLatestPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = res.data.content.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setHasNext(res.data.hasNext);
      cursorRef.current = res.data.nextCursor;
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
    if (restored) return; // 복원 시 초기 loadMore 생략
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

  // ?section=latest 진입 시 최신 자랑 섹션으로 부드럽게 스크롤 (복원 시 건너뜀)
  useEffect(() => {
    if (restored) return;
    if (sectionParam === 'latest' && !initialLatestLoading && latestSectionRef.current) {
      latestSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sectionParam, initialLatestLoading, restored]);

  const popularSliderItems = popularPosts.map((p) => ({
    id: p.id,
    label: p.title,
    thumbnailUrl: p.thumbnailUrl,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    nickname: p.nickname,
    profileImageUrl: p.profileImageUrl,
    aiGenerated: p.aiGenerated,
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
          <Link href="/ranking" className="text-base text-gray-900 hover:text-gray-600 transition-colors">
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
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-900">자유게시판 최신 글</h2>
              <Link href="/board" className="text-base text-gray-900 hover:text-gray-600 transition-colors">
                더보기
              </Link>
            </div>
            <div className="space-y-0">
              {boardPosts.length > 0 ? boardPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => router.push(`/board/${post.id}`)}
                  className="w-full flex items-center gap-2 text-left py-2.5 border-b border-gray-100 last:border-b-0 hover:opacity-70 transition-opacity"
                >
                  <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {post.category === 'QUESTION' ? '질문' : '일반'}
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">{post.title}</span>
                    <span className="flex-shrink-0 flex items-center gap-1">
                      <span className="text-xs text-amber-600 tabular-nums">❤ {post.likeCount}</span>
                      <span className="text-xs text-gray-400 tabular-nums">💬 {post.commentCount}</span>
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgoOrDate(post.createdAt)}</span>
                </button>
              )) : (
                <p className="text-sm text-gray-400">아직 게시글이 없어요</p>
              )}
            </div>
          </div>

          {/* 공지사항 */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-900">공지사항</h2>
            </div>
            <div className="space-y-0">
              <div className="flex items-center gap-2 py-2.5 border-b border-gray-100">
                <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-900 text-white">공지</span>
                <span className="text-sm font-semibold text-gray-900 truncate flex-1">집사모여 서비스 오픈 안내</span>
                <span className="text-xs text-gray-400 flex-shrink-0">04. 14.</span>
              </div>
              <div className="flex items-center gap-2 py-2.5">
                <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-900 text-white">공지</span>
                <span className="text-sm font-semibold text-gray-900 truncate flex-1">커뮤니티 이용 규칙 안내</span>
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
