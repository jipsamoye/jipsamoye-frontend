'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { BoardListItem as BoardListItemType, BoardCategory, BoardSearchType, PageResponse } from '@/types/api';
import BoardListItem from '@/components/domain/BoardListItem';
import Skeleton from '@/components/common/Skeleton';
import { MagnifyingGlassIcon } from '@/components/layout/icons';

type Tab = 'ALL' | BoardCategory;

const TABS: { value: Tab; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'GENERAL', label: '일반' },
  { value: 'QUESTION', label: '질문' },
];

export default function BoardPage() {
  const [tab, setTab] = useState<Tab>('ALL');
  const [items, setItems] = useState<BoardListItemType[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const observerRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<BoardSearchType>('TITLE_CONTENT');
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  const reset = useCallback(() => {
    setItems([]);
    setHasNext(true);
    pageRef.current = 0;
    setInitialLoading(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      let url: string;
      if (activeQuery) {
        url = `/api/boards/search?q=${encodeURIComponent(activeQuery)}&type=${searchType}&page=${pageRef.current}&size=20`;
      } else {
        const categoryParam = tab === 'ALL' ? '' : `category=${tab}&`;
        url = `/api/boards?${categoryParam}page=${pageRef.current}&size=20`;
      }
      const res = await api.get<PageResponse<BoardListItemType>>(url, { silent: true });
      setItems((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...res.data.content.filter((p) => !ids.has(p.id))];
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
  }, [hasNext, tab, activeQuery, searchType]);

  useEffect(() => {
    reset();
  }, [tab, activeQuery, searchType, reset]);

  useEffect(() => {
    if (items.length === 0 && hasNext && !loadingRef.current) {
      loadMore();
    }
  }, [items.length, hasNext, loadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setActiveQuery(trimmed ? trimmed : null);
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveQuery(null);
    setSearchOpen(false);
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">전체 글</h1>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTab(t.value);
                if (activeQuery) clearSearch();
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${tab === t.value && !activeQuery
                  ? 'bg-amber-50 text-amber-600'
                  : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as BoardSearchType)}
            className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="TITLE_CONTENT">제목+내용</option>
            <option value="TITLE">제목</option>
          </select>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="검색어를 입력해주세요"
              className="h-9 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm w-56 focus:outline-none focus:ring-2 focus:ring-amber-300"
              onFocus={() => setSearchOpen(true)}
            />
            <button
              type="submit"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="검색"
            >
              <MagnifyingGlassIcon />
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="검색 지우기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>

      {activeQuery && (
        <div className="mb-4 text-sm text-gray-500">
          <span className="font-medium text-gray-700">&ldquo;{activeQuery}&rdquo;</span> 검색 결과
        </div>
      )}

      {initialLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 py-4 border-b border-gray-100">
              <Skeleton className="w-14 h-7 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="w-20 h-8" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex flex-col">
          {items.map((item) => (
            <BoardListItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">
            {activeQuery ? '검색 결과가 없어요' : '아직 작성된 글이 없어요'}
          </p>
        </div>
      )}

      <div ref={observerRef} className="h-10" />
      {loading && !initialLoading && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
