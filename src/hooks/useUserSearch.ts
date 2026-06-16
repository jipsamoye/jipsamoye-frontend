'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { PageResponse, UserSearchItem } from '@/types/api';

/**
 * 새 메시지 모달의 "전체 유저 검색" 훅.
 * - GET /api/users/search?q=&page=0&size=20 → ApiResponse<PageResponse<UserSearchItem>>.
 * - 빈 검색어면 호출하지 않고 결과를 비운다(추천 목록은 호출부가 별도 처리).
 * - latest-wins: 새 검색은 절대 drop하지 않고 항상 발사한다. requestIdRef(최신 요청 id)로
 *   "늦게 도착한 옛 응답은 무시"만 보장한다(단발성 검색-치환 UI라 동기 중복 가드 대신 latest-wins).
 * - reset(): 모달을 닫거나 검색어가 비었을 때 결과/로딩을 초기화하며 in-flight 응답을 무효화한다.
 */
export function useUserSearch() {
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  // 응답이 늦게 도착했을 때 더 최신 검색을 덮어쓰지 않도록 요청 순번을 추적
  const requestIdRef = useRef(0);

  const search = useCallback(async (keyword: string) => {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      // 검색어가 비면 진행 중인 요청도 무효화하고 결과를 비운다
      requestIdRef.current++;
      setResults([]);
      setLoading(false);
      return;
    }
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await api.get<PageResponse<UserSearchItem>>(
        `/api/users/search?q=${encodeURIComponent(trimmed)}&page=0&size=20`,
        { silent: true }
      );
      // 더 최신 검색이 시작됐으면 이 응답은 버린다
      if (reqId !== requestIdRef.current) return;
      setResults(res.data?.content ?? []);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setResults([]);
    } finally {
      // 최신 요청의 응답만 loading 을 해제한다(늦게 끝난 옛 요청은 무시)
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current++;
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, reset };
}
