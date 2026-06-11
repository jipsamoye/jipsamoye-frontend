'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { BoardListItem as BoardListItemType, BoardCategory, BoardSearchType, PageResponse } from '@/types/api';
import BoardListItem from '@/components/domain/BoardListItem';
import Skeleton from '@/components/common/Skeleton';
import Pagination from '@/components/common/Pagination';
import { MagnifyingGlassIcon } from '@/components/layout/icons';
import { useScrollRestore } from '@/hooks/useScrollRestore';

type Tab = 'ALL' | BoardCategory;

const TABS: { value: Tab; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'GENERAL', label: '일반' },
  { value: 'QUESTION', label: '질문' },
];

const PAGE_SIZE = 20;

interface BoardSnapshot {
  items: BoardListItemType[];
  currentPage: number;
  totalPages: number;
  tab: Tab;
  searchType: BoardSearchType;
  searchInput: string;
  activeQuery: string | null;
}

const VALID_TABS: Tab[] = ['ALL', 'GENERAL', 'QUESTION'];
const VALID_SEARCH_TYPES: BoardSearchType[] = ['TITLE_CONTENT', 'TITLE'];

function isBoardSnapshot(data: unknown): data is BoardSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.items) &&
    typeof d.currentPage === 'number' &&
    typeof d.totalPages === 'number' &&
    (VALID_TABS as unknown[]).includes(d.tab) &&
    (VALID_SEARCH_TYPES as unknown[]).includes(d.searchType) &&
    typeof d.searchInput === 'string' &&
    (d.activeQuery === null || typeof d.activeQuery === 'string')
  );
}

export default function BoardPage() {
  const [tab, setTab] = useState<Tab>('ALL');
  const [items, setItems] = useState<BoardListItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [searchType, setSearchType] = useState<BoardSearchType>('TITLE_CONTENT');
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  // 복원 모드 게이트 — restore 시 true로 세팅, fetch effect는 이 플래그가 true이면
  // 전부 스킵한다. 사용자 인터랙션 핸들러에서 setState 전에 false로 해제한다.
  // skipNextFetchRef(1회용)과 달리 복원값으로 인한 deps 변경 실행도 전부 막는다.
  const restoredModeRef = useRef(false);

  // 최신 상태를 capture에서 읽을 수 있도록 ref 미러
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const searchTypeRef = useRef(searchType);
  searchTypeRef.current = searchType;
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;
  const activeQueryRef = useRef(activeQuery);
  activeQueryRef.current = activeQuery;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  useScrollRestore<BoardSnapshot>('board', {
    capture: () => {
      // 로딩 중이면 빈 목록 저장 방지 — null 반환으로 저장 스킵
      if (loading) return null;
      return {
        items: itemsRef.current,
        currentPage: currentPageRef.current,
        totalPages: totalPagesRef.current,
        tab: tabRef.current,
        searchType: searchTypeRef.current,
        searchInput: searchInputRef.current,
        activeQuery: activeQueryRef.current,
      };
    },
    restore: (snap) => {
      setItems(snap.items);
      setCurrentPage(snap.currentPage);
      setTotalPages(snap.totalPages);
      setTab(snap.tab);
      setSearchType(snap.searchType);
      setSearchInput(snap.searchInput);
      setActiveQuery(snap.activeQuery);
      setLoading(false);
      // 복원 모드 활성화 — fetch effect가 복원 기인 실행(마운트 1회 + deps 변경)을 전부 스킵
      restoredModeRef.current = true;
    },
    validate: isBoardSnapshot,
  });

  useEffect(() => {
    // 복원 모드이면 fetch 전부 스킵 (마운트 + deps 변경 모두 포함)
    if (restoredModeRef.current) return;

    let cancelled = false;
    setLoading(true);

    const apiPage = currentPage - 1;
    const url = activeQuery
      ? `/api/boards/search?q=${encodeURIComponent(activeQuery)}&type=${searchType}&page=${apiPage}&size=${PAGE_SIZE}`
      : `/api/boards?${tab === 'ALL' ? '' : `category=${tab}&`}page=${apiPage}&size=${PAGE_SIZE}`;

    api.get<PageResponse<BoardListItemType>>(url, { silent: true })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.content);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotalPages(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, tab, activeQuery, searchType]);

  const handleTabChange = (value: Tab) => {
    // 사용자 인터랙션 — 복원 모드 해제 후 setState (이후 fetch effect 정상 실행)
    restoredModeRef.current = false;
    setTab(value);
    setCurrentPage(1);
    if (activeQuery) {
      setSearchInput('');
      setActiveQuery(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    // 사용자 인터랙션 — 복원 모드 해제
    restoredModeRef.current = false;
    setActiveQuery(trimmed ? trimmed : null);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    // 사용자 인터랙션 — 복원 모드 해제
    restoredModeRef.current = false;
    setSearchInput('');
    setActiveQuery(null);
    setCurrentPage(1);
  };

  const handleSearchTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // 사용자 인터랙션 — 복원 모드 해제 후 setState (이후 fetch effect 정상 실행)
    restoredModeRef.current = false;
    setSearchType(e.target.value as BoardSearchType);
  };

  const handlePageChange = useCallback((page: number) => {
    // 사용자 인터랙션 — 복원 모드 해제
    restoredModeRef.current = false;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">전체 글</h1>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => handleTabChange(t.value)}
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
            onChange={handleSearchTypeChange}
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

      {loading ? (
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
        <>
          <div className="flex flex-col">
            {items.map((item) => (
              <BoardListItem key={item.id} item={item} />
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onChange={handlePageChange} />
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">
            {activeQuery ? '검색 결과가 없어요' : '아직 작성된 글이 없어요'}
          </p>
        </div>
      )}
    </div>
  );
}
