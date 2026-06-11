'use client';

import { useEffect, useRef, useState } from 'react';

// ─── 모듈 레벨 popstate 플래그 ────────────────────────────────────────────────
// 여러 인스턴스가 같은 모듈을 공유하므로 1회용 플래그로 처리
let popstateTriggered = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    popstateTriggered = true;
  });

  // pushState / replaceState 래핑 — 일반 내비게이션 시 플래그를 클리어
  // Next.js App Router의 Link / router.push 가 pushState 를 호출하므로
  // "훅 없는 페이지 경유 뒤 일반 진입" 시나리오에서도 안전하게 리셋된다.
  // (setTimeout 자동 만료 방식은 App Router 비동기 렌더와 경합하므로 사용하지 않는다)
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    popstateTriggered = false;
    origPushState(...args);
  };
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    popstateTriggered = false;
    origReplaceState(...args);
  };
}

// ─── 스토리지 키 버전 ─────────────────────────────────────────────────────────
// 향후 스키마 변경 시 버전을 올려 구버전 스냅샷을 자동 무시한다.
const STORAGE_VERSION = 'v1';

interface ScrollRestoreSnapshot<T> {
  data: T;
  scrollY: number;
}

interface UseScrollRestoreOptions<T> {
  /** unmount 시 저장할 데이터를 반환하는 함수. null을 반환하면 저장을 건너뜀. */
  capture: () => T | null;
  /** popstate 진입 시 스냅샷 데이터로 상태를 복원하는 함수 */
  restore: (snap: T) => void;
  /**
   * 선택적 유효성 검사. 스냅샷 data가 올바른 구조인지 확인한다.
   * 실패하면 스냅샷을 무시하고 일반 로딩으로 폴백한다.
   */
  validate?: (data: unknown) => data is T;
}

function getStorageKey(key: string) {
  return `scroll-restore:${STORAGE_VERSION}:${key}`;
}

function saveSnapshot<T>(key: string, data: T, scrollY: number): void {
  try {
    const snapshot: ScrollRestoreSnapshot<T> = { data, scrollY };
    sessionStorage.setItem(getStorageKey(key), JSON.stringify(snapshot));
  } catch {
    // sessionStorage 접근 불가(시크릿 모드 등) — 조용히 무시
  }
}

function loadSnapshot<T>(
  key: string,
  validate?: (data: unknown) => data is T,
): ScrollRestoreSnapshot<T> | null {
  try {
    const raw = sessionStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScrollRestoreSnapshot<T>;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('data' in parsed) ||
      typeof parsed.scrollY !== 'number'
    ) {
      sessionStorage.removeItem(getStorageKey(key));
      return null;
    }
    // validate 콜백이 있으면 data 구조 검증
    if (validate && !validate(parsed.data)) {
      sessionStorage.removeItem(getStorageKey(key));
      return null;
    }
    return parsed;
  } catch {
    // JSON 파싱 실패 등 — 해당 스냅샷 제거 후 null 반환
    try {
      sessionStorage.removeItem(getStorageKey(key));
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * 뒤로가기/앞으로가기(popstate) 진입 시 목록 상태 + 스크롤 위치를 복원하는 공용 훅.
 *
 * @param key - sessionStorage 저장 키 (페이지별 고유값)
 * @param options - capture / restore / validate 콜백
 * @returns restored - 복원 여부 (true이면 초기 fetch 생략 가능)
 */
export function useScrollRestore<T>(
  key: string,
  options: UseScrollRestoreOptions<T>,
): boolean {
  // 마운트 시점에 popstate 플래그를 소모하고 스냅샷 유효성을 동기적으로 판단.
  // SSR에서는 false (window 없음), 클라이언트에서 lazy init으로 1회만 결정.
  const [restored] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (!popstateTriggered) return false;
    // 플래그 소모 (1회용)
    popstateTriggered = false;
    // 스냅샷 유효성 확인 (파싱 + validate)
    const snapshot = loadSnapshot<T>(key, options.validate);
    return snapshot !== null;
  });

  // 스냅샷 ref — effect에서 복원 콜백 호출용.
  // lazy useState와 동일한 타이밍에 1회만 읽는다 (loadSnapshot 중복 호출 제거).
  const snapshotRef = useRef<ScrollRestoreSnapshot<T> | null>(null);
  if (restored && snapshotRef.current === null && typeof window !== 'undefined') {
    snapshotRef.current = loadSnapshot<T>(key, options.validate);
  }

  // capture 콜백 최신값 ref 미러 (unmount cleanup에서 최신 상태 캡처)
  const captureRef = useRef(options.capture);
  captureRef.current = options.capture;

  // restore 콜백 최신값 ref 미러
  const restoreRef = useRef(options.restore);
  restoreRef.current = options.restore;

  // 스크롤 위치 ref (throttled scroll로 갱신).
  // 복원 직후에는 저장된 scrollY로 초기화해 "복원 후 150ms 내 이탈" 시
  // scrollY=0 이 저장되는 문제를 방지한다.
  const scrollYRef = useRef(0);

  // 복원 effect — 마운트 후 1회
  useEffect(() => {
    if (!restored || !snapshotRef.current) return;
    const snap = snapshotRef.current;
    restoreRef.current(snap.data);
    // 복원된 scrollY를 즉시 ref에 반영 (복원 직후 빠른 이탈 대비)
    scrollYRef.current = snap.scrollY;
    // 렌더 반영 후 스크롤 복원.
    // restore setState가 passive effect이므로 단일 rAF이 콘텐츠 커밋 전에
    // 실행되어 scrollTo가 클램프될 수 있다 → 더블 rAF으로 확실히 레이아웃 후 실행.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.scrollTo(0, snap.scrollY);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 스크롤 추적 + unmount 저장 effect
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastScrollY = scrollYRef.current;

    // leading + trailing throttle:
    // leading — 첫 이벤트 즉시 기록
    // trailing — 마지막 이벤트를 타이머로 반드시 기록 (빠른 스크롤 직후 이탈 대비)
    const handleScroll = () => {
      lastScrollY = window.scrollY;
      if (!throttleTimer) {
        // leading 기록
        scrollYRef.current = lastScrollY;
        throttleTimer = setTimeout(() => {
          // trailing 기록
          scrollYRef.current = lastScrollY;
          throttleTimer = null;
        }, 150);
      } else {
        // trailing 갱신: 타이머 만료 시 lastScrollY를 쓰므로 별도 처리 불필요
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        // cleanup 시 미처 trailing 기록이 안 된 마지막 scrollY를 반영
        scrollYRef.current = lastScrollY;
      }
      // unmount 시 현재 상태 저장.
      // capture()가 null을 반환하면 저장 스킵 (빈 목록 저장 방지).
      const captureResult = captureRef.current();
      if (captureResult !== null) {
        saveSnapshot(key, captureResult, scrollYRef.current);
      }
      // null이어도 기존 스냅샷은 그대로 유지 (removeItem 호출 안 함)
    };
  }, [key]);

  return restored;
}
