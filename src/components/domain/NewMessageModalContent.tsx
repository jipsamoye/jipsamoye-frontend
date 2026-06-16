'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/common/Avatar';
import HighlightedText from '@/components/common/HighlightedText';
import { useUserSearch } from '@/hooks/useUserSearch';
import type { FollowUser } from '@/types/api';

/** onSelect로 넘기는 최소 상대 정보(팔로잉 추천·검색 결과 공통) */
export interface NewMessageTarget {
  nickname: string;
  profileImageUrl: string | null;
}

interface NewMessageModalContentProps {
  /** 빈 검색어일 때 "추천"으로 보여줄 내 팔로잉 목록 */
  followingList: FollowUser[];
  /** 상대를 선택(메시지 보내기)했을 때 */
  onSelect: (target: NewMessageTarget) => void;
}

const DEBOUNCE_MS = 300;

/**
 * 새 메시지 모달 본문.
 * - 빈 검색어: followingList를 "추천"으로 노출(배지 없음).
 * - 검색어 입력: 300ms 디바운스 후 GET /api/users/search 호출 → 전체 유저 결과.
 *   검색 결과 항목 중 isFollowing=true 이면 "구독 중" 배지 표시.
 * - 빈 상태: 검색어 있으면 "검색 결과가 없어요", 없으면 "검색해서 메시지를 보낼 상대를 찾아보세요".
 *
 * DM 목록(왼쪽 패널) 검색과는 무관 — 이쪽만 API를 호출한다.
 */
export default function NewMessageModalContent({
  followingList,
  onSelect,
}: NewMessageModalContentProps) {
  const [query, setQuery] = useState('');
  const { results, loading, search, reset } = useUserSearch();

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  // 디바운스: 검색어 입력이 멈춘 뒤 300ms 후 검색. 빈 검색어면 결과 초기화.
  useEffect(() => {
    if (trimmed.length === 0) {
      reset();
      return;
    }
    const timer = setTimeout(() => {
      void search(trimmed);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, search, reset]);

  // 표시할 리스트: 검색 중이면 검색 결과, 아니면 팔로잉 추천.
  const items: NewMessageTarget[] = isSearching ? results : followingList;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="누구에게 메시지를 보낼까요?"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all duration-200"
        />
      </div>

      <div className="-mx-2 max-h-72 overflow-y-auto">
        {isSearching && loading ? (
          <p className="py-6 text-center text-sm text-gray-400">검색 중...</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {isSearching ? '검색 결과가 없어요' : '검색해서 메시지를 보낼 상대를 찾아보세요'}
          </p>
        ) : (
          items.map((item) => {
            // 검색 모드: 결과의 isFollowing 분기.
            // 추천 모드(빈 검색어): GET /following 전원이 내 팔로잉이므로 항상 배지 노출.
            const following = isSearching
              ? results.find((r) => r.nickname === item.nickname)?.isFollowing ?? false
              : true;
            return (
              <div
                key={item.nickname}
                className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={item.profileImageUrl} alt={item.nickname} size="md" />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {isSearching ? (
                      <HighlightedText text={item.nickname} keyword={trimmed} />
                    ) : (
                      item.nickname
                    )}
                  </span>
                  {following && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium">
                      구독 중
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onSelect(item)}
                  aria-label={`${item.nickname}에게 메시지 보내기`}
                  className="flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
