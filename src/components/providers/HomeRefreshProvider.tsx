'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface HomeRefreshContextValue {
  /** key bumps each time refreshHome() is called. 콘텐츠 영역 wrapper에 부여해 강제 재마운트 트리거. */
  refreshKey: number;
  refreshHome: () => void;
}

const HomeRefreshContext = createContext<HomeRefreshContextValue>({
  refreshKey: 0,
  refreshHome: () => {},
});

export function useHomeRefresh() {
  return useContext(HomeRefreshContext);
}

/**
 * 헤더 로고 클릭 시 같은 페이지에 머물러도 콘텐츠를 강제 재마운트시키기 위한 컨텍스트.
 * - 다른 페이지 → 홈 이동: 평범한 router.push, 자연 마운트로 데이터 페치
 * - 홈 → 홈 클릭: refreshHome() 호출 → key 변경 → React가 children 통째로 재마운트 → useEffect 재실행 → 데이터 다시 페치
 */
export default function HomeRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshHome = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <HomeRefreshContext.Provider value={{ refreshKey, refreshHome }}>
      {children}
    </HomeRefreshContext.Provider>
  );
}
