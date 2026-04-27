'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { RankingPageResponse, PetPostListItem } from '@/types/api';
import { parseDateParam, toIsoDate, getWeekRange, getMonthRange, isFuture } from '@/lib/dateRange';
import RankingTabs from '@/components/domain/ranking/RankingTabs';
import RankingDateNav from '@/components/domain/ranking/RankingDateNav';
import RankingGrid from '@/components/domain/ranking/RankingGrid';

// TODO: 백엔드 배포 완료 후 mock 관련 코드 제거
// mock fallback: /api/posts/ranking 이 404/오류를 반환할 때 사용
import { dummyPopularPosts } from '@/lib/dummyData';

function buildMockResponse(
  type: 'weekly' | 'monthly',
  dateKey: string,
): RankingPageResponse {
  const date = parseDateParam(dateKey);

  let startDate: string;
  let endDate: string;

  if (type === 'weekly') {
    const { start, end } = getWeekRange(date);
    startDate = toIsoDate(start);
    // endDate 는 inclusive → end - 1일
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(end.getDate() - 1);
    endDate = toIsoDate(inclusiveEnd);
  } else {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const { start, end } = getMonthRange(y, m);
    startDate = toIsoDate(start);
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(end.getDate() - 1);
    endDate = toIsoDate(inclusiveEnd);
  }

  const today = toIsoDate(new Date());
  const isOngoing = startDate <= today && today <= endDate;

  return {
    period: type === 'weekly' ? 'WEEKLY' : 'MONTHLY',
    startDate,
    endDate,
    isOngoing,
    posts: {
      content: dummyPopularPosts,
      totalPages: 1,
      totalElements: dummyPopularPosts.length,
      currentPage: 0,
      size: 20,
      hasNext: false,
    },
  };
}
// END TODO mock

interface RangeState {
  startDate: string;
  endDate: string;
  isOngoing: boolean;
}

function RankingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터 파싱 — 잘못된 값은 silent fallback
  const typeParam = searchParams.get('type');
  const type: 'weekly' | 'monthly' =
    typeParam === 'weekly' || typeParam === 'monthly' ? typeParam : 'weekly';

  const dateParam = searchParams.get('date');
  const parsedDate = parseDateParam(dateParam);
  const dateKey = toIsoDate(parsedDate); // YYYY-MM-DD

  // ── state ─────────────────────────────────────────────────────────────────
  const [range, setRange] = useState<RangeState | null>(null);
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // stale closure 회피: page 는 ref 로 관리
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);

  // ── API 호출 ───────────────────────────────────────────────────────────────
  const fetchRanking = useCallback(
    async (page: number, reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (reset) setInitialLoading(true);
      else setLoading(true);

      try {
        const period = type === 'weekly' ? 'WEEKLY' : 'MONTHLY';
        const res = await api.get<RankingPageResponse>(
          `/api/posts/ranking?period=${period}&date=${dateKey}&page=${page}&size=20`,
        );
        const data = res.data;

        setRange({
          startDate: data.startDate,
          endDate: data.endDate,
          isOngoing: data.isOngoing,
        });

        if (reset) {
          setPosts(data.posts.content);
        } else {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPosts = data.posts.content.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        }

        setHasNext(data.posts.hasNext);
        pageRef.current = page + 1;

        // URL 정규화: 서버 응답의 startDate 로 date 파라미터 갱신
        // (월요일이 아닌 날짜로 진입한 경우 정규화, history 폭발 방지를 위해 replace)
        if (reset && data.startDate !== dateKey) {
          const normalizedDate =
            type === 'monthly'
              ? data.startDate // YYYY-MM-01 그대로
              : data.startDate;
          router.replace(`/ranking?type=${type}&date=${normalizedDate}`);
        }
      } catch {
        // TODO: 백엔드 배포 완료 후 mock fallback 제거
        // mock fallback: 백엔드 미배포 상태에서 화면 검증용
        if (reset) {
          const mock = buildMockResponse(type, dateKey);
          setRange({
            startDate: mock.startDate,
            endDate: mock.endDate,
            isOngoing: mock.isOngoing,
          });
          setPosts(mock.posts.content);
          setHasNext(mock.posts.hasNext);
          pageRef.current = 1;
        }
        // END TODO mock fallback
      } finally {
        loadingRef.current = false;
        setInitialLoading(false);
        setLoading(false);
      }
    },
    [type, dateKey, router],
  );

  // ── type / dateKey 변경 시 리셋 ────────────────────────────────────────────
  useEffect(() => {
    pageRef.current = 0;
    setPosts([]);
    setHasNext(false);
    setRange(null);
    fetchRanking(0, true);
  }, [type, dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IntersectionObserver 무한스크롤 (app/page.tsx 패턴 그대로) ─────────────
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    await fetchRanking(pageRef.current, false);
  }, [hasNext, fetchRanking]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── 네비게이션 핸들러 ──────────────────────────────────────────────────────
  const navigate = (direction: 'prev' | 'next') => {
    if (!range) return;

    const currentStart = parseDateParam(range.startDate);

    let newDate: Date;
    if (type === 'weekly') {
      newDate = new Date(currentStart);
      newDate.setDate(currentStart.getDate() + (direction === 'prev' ? -7 : 7));
    } else {
      newDate = new Date(currentStart);
      newDate.setMonth(currentStart.getMonth() + (direction === 'prev' ? -1 : 1));
    }

    // 미래 기간 차단
    if (direction === 'next' && isFuture(newDate)) return;

    const newDateStr = toIsoDate(newDate);
    router.replace(`/ranking?type=${type}&date=${newDateStr}`);
  };

  const handleTabChange = (newType: 'weekly' | 'monthly') => {
    // 탭 변경 시 오늘 날짜 기준으로 초기화
    const today = toIsoDate(new Date());
    router.replace(`/ranking?type=${newType}&date=${today}`);
  };

  const handleSelectMonth = (year: number, month: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    router.replace(`/ranking?type=monthly&date=${dateStr}`);
  };

  // ── canGoNext 계산 ─────────────────────────────────────────────────────────
  const canGoNext = !!range && !range.isOngoing;

  // ── 렌더 ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">인기 게시글 순위</h1>

      <RankingTabs type={type} onChange={handleTabChange} />

      {range && (
        <RankingDateNav
          type={type}
          startDate={range.startDate}
          endDate={range.endDate}
          isOngoing={range.isOngoing}
          canGoNext={canGoNext}
          onPrev={() => navigate('prev')}
          onNext={() => navigate('next')}
          onSelectMonth={handleSelectMonth}
        />
      )}

      <RankingGrid posts={posts} initialLoading={initialLoading} />

      {/* IntersectionObserver sentinel */}
      <div ref={observerRef} className="h-10" />
      {loading && !initialLoading && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/**
 * useSearchParams 는 Suspense 경계 안에 있어야 한다 (Next.js App Router 요건)
 */
export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RankingPageInner />
    </Suspense>
  );
}
