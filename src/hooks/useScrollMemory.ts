'use client';

import { useEffect, useRef } from 'react';

/**
 * 페이지의 스크롤 위치를 sessionStorage에 저장하고, 다시 진입 시 복원.
 *
 * 동작 흐름:
 * 1) 스크롤 이벤트마다 sessionStorage 업데이트 (rAF throttle)
 * 2) ready=true 시 sessionStorage 값으로 1회 초기 복원 (콘텐츠 로드 후)
 * 3) popstate 이벤트로도 복원 — Next.js App Router cache hit 시 useEffect 재실행 안 되는 케이스 대응
 *
 * @param key 페이지 식별 키 (예: 'home', 'board')
 * @param ready 초기 복원 트리거 (콘텐츠 로드 완료 시 true)
 */
export function useScrollMemory(key: string, ready: boolean = true) {
  const storageKey = `scroll:${key}`;
  const restoredRef = useRef(false);
  const saveRafRef = useRef<number | null>(null);

  // 1) 초기 복원 — ready=true가 되었을 때 한 번만
  useEffect(() => {
    if (!ready || restoredRef.current || typeof window === 'undefined') return;
    restoredRef.current = true;
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved));
      });
    }
  }, [ready, storageKey]);

  // 2) popstate (router.back() 후 cache hit) 시 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        requestAnimationFrame(() => {
          window.scrollTo(0, Number(saved));
        });
      }
    };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, [storageKey]);

  // 3) 스크롤 시 sessionStorage 업데이트 (rAF throttle)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const save = () => {
      if (saveRafRef.current !== null) cancelAnimationFrame(saveRafRef.current);
      saveRafRef.current = requestAnimationFrame(() => {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      if (saveRafRef.current !== null) cancelAnimationFrame(saveRafRef.current);
    };
  }, [storageKey]);
}
