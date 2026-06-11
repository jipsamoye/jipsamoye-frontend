import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── window.scrollTo mock ────────────────────────────────────────────────────
const scrollToMock = vi.fn();
vi.stubGlobal('scrollTo', scrollToMock);

// ─── requestAnimationFrame mock ──────────────────────────────────────────────
// 더블 rAF을 지원하기 위해 중첩 호출도 즉시 실행하도록 재귀 구현
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
});

// ─── sessionStorage mock ─────────────────────────────────────────────────────
const sessionStorageStore: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete sessionStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(sessionStorageStore).forEach((k) => delete sessionStorageStore[k]); }),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// ─── useScrollRestore 모듈 임포트 ────────────────────────────────────────────
// 주의: vi.resetModules() 없이 모듈을 공유한다.
// popstate 플래그(모듈 레벨 변수)는 테스트 간에 공유되므로, 각 테스트는
// 고유한 스토리지 키를 사용하거나 순서에 의존하지 않도록 작성해야 한다.
// triggerPopstate() 헬퍼로 popstate를 발생시키면 플래그가 세팅되며,
// 훅 마운트(useState lazy init)에서 1회 소모된다.
import { useScrollRestore } from '@/hooks/useScrollRestore';

// 스토리지 키 버전 접두사 (useScrollRestore.ts의 STORAGE_VERSION과 일치)
const KEY_PREFIX = 'scroll-restore:v1:';

interface TestSnapshot {
  items: string[];
  page: number;
}

function isTestSnapshot(data: unknown): data is TestSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.items) && typeof d.page === 'number';
}

describe('useScrollRestore', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    scrollToMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── 헬퍼: 실제 popstate 이벤트를 dispatch하여 모듈 플래그를 세팅 ────────
  function triggerPopstate() {
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  // ─── 헬퍼: 실제 pushState 호출로 플래그를 클리어 ────────────────────────
  function triggerPushState() {
    history.pushState(null, '', window.location.href);
  }

  describe('저장 (unmount)', () => {
    it('unmount 시 capture() 결과와 scrollY를 sessionStorage에 저장한다', () => {
      const captureData: TestSnapshot = { items: ['a', 'b'], page: 2 };
      const captureFn = vi.fn(() => captureData);
      const restoreFn = vi.fn();

      const { unmount } = renderHook(() =>
        useScrollRestore<TestSnapshot>('test-save', {
          capture: captureFn,
          restore: restoreFn,
        })
      );

      unmount();

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        `${KEY_PREFIX}test-save`,
        expect.stringContaining('"items":["a","b"]')
      );
    });

    it('unmount 시 저장된 데이터에 scrollY 필드가 포함된다', () => {
      const captureFn = vi.fn(() => ({ items: [], page: 0 }));
      const { unmount } = renderHook(() =>
        useScrollRestore<TestSnapshot>('test-scrolly', {
          capture: captureFn,
          restore: vi.fn(),
        })
      );

      unmount();

      const callArg = sessionStorageMock.setItem.mock.calls[0][1] as string;
      const parsed = JSON.parse(callArg);
      expect(typeof parsed.scrollY).toBe('number');
    });

    it('capture()가 null을 반환하면 저장을 스킵하고 기존 스냅샷을 유지한다', () => {
      // 기존 스냅샷을 미리 저장
      sessionStorageStore[`${KEY_PREFIX}test-null-capture`] = JSON.stringify({
        data: { items: ['existing'], page: 1 },
        scrollY: 200,
      });

      const captureFn = vi.fn(() => null);
      const { unmount } = renderHook(() =>
        useScrollRestore<TestSnapshot>('test-null-capture', {
          capture: captureFn as () => TestSnapshot | null,
          restore: vi.fn(),
        })
      );

      unmount();

      // setItem이 호출되지 않아야 함 (기존 스냅샷 유지)
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled();
      // 기존 스냅샷이 그대로 있어야 함
      expect(sessionStorageStore[`${KEY_PREFIX}test-null-capture`]).toBeDefined();
      const saved = JSON.parse(sessionStorageStore[`${KEY_PREFIX}test-null-capture`]);
      expect(saved.data.items).toEqual(['existing']);
    });
  });

  describe('정상 복원: popstate → 재마운트', () => {
    it('popstate 후 재마운트 시 restore가 스냅샷 데이터와 함께 호출된다', async () => {
      const snapshot: TestSnapshot = { items: ['x', 'y'], page: 3 };

      // 1단계: 스냅샷 저장
      sessionStorageStore[`${KEY_PREFIX}home-normal`] = JSON.stringify({
        data: snapshot,
        scrollY: 250,
      });

      // popstate 이벤트 발생
      triggerPopstate();

      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('home-normal', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn,
          })
        );
      });

      expect(restoreFn).toHaveBeenCalledWith(snapshot);
    });

    it('popstate 후 재마운트 시 window.scrollTo(0, savedY)가 호출된다', async () => {
      const snapshot: TestSnapshot = { items: ['z'], page: 1 };
      sessionStorageStore[`${KEY_PREFIX}home-scrollto`] = JSON.stringify({
        data: snapshot,
        scrollY: 480,
      });

      triggerPopstate();

      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('home-scrollto', {
            capture: vi.fn(() => snapshot),
            restore: vi.fn(),
          })
        );
      });

      expect(scrollToMock).toHaveBeenCalledWith(0, 480);
    });

    it('복원 성공 시 restored=true를 반환한다', async () => {
      const snapshot: TestSnapshot = { items: ['q'], page: 5 };
      sessionStorageStore[`${KEY_PREFIX}home-flag`] = JSON.stringify({
        data: snapshot,
        scrollY: 100,
      });

      triggerPopstate();

      let result: ReturnType<typeof renderHook<boolean, unknown>>['result'] | undefined;
      await act(async () => {
        const rendered = renderHook(() =>
          useScrollRestore<TestSnapshot>('home-flag', {
            capture: vi.fn(() => snapshot),
            restore: vi.fn(),
          })
        );
        result = rendered.result;
      });

      expect(result?.current).toBe(true);
    });
  });

  describe('엣지: 일반 마운트 (popstate 없음)', () => {
    it('popstate 없이 마운트하면 restore가 호출되지 않는다', async () => {
      const snapshot: TestSnapshot = { items: ['a'], page: 1 };
      sessionStorageStore[`${KEY_PREFIX}home-nopopstate`] = JSON.stringify({
        data: snapshot,
        scrollY: 300,
      });

      // popstate 없이 바로 마운트
      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('home-nopopstate', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn,
          })
        );
      });

      expect(restoreFn).not.toHaveBeenCalled();
      expect(scrollToMock).not.toHaveBeenCalled();
    });

    it('popstate 없이 마운트하면 restored=false를 반환한다', async () => {
      let result: ReturnType<typeof renderHook<boolean, unknown>>['result'] | undefined;
      await act(async () => {
        const rendered = renderHook(() =>
          useScrollRestore<TestSnapshot>('home-norest', {
            capture: vi.fn(() => ({ items: [], page: 0 })),
            restore: vi.fn(),
          })
        );
        result = rendered.result;
      });

      expect(result?.current).toBe(false);
    });
  });

  describe('엣지: popstate 있어도 스냅샷 없으면 복원 안 함', () => {
    it('sessionStorage에 해당 키가 없으면 restore가 호출되지 않는다', async () => {
      // 다른 키 스냅샷은 있지만 'home-nosnap' 키는 없음
      triggerPopstate();

      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('home-nosnap', {
            capture: vi.fn(() => ({ items: [], page: 0 })),
            restore: restoreFn,
          })
        );
      });

      expect(restoreFn).not.toHaveBeenCalled();
    });
  });

  describe('엣지: 깨진 JSON — 폴백 (예외 없이 restored=false)', () => {
    it('sessionStorage에 깨진 JSON이 있으면 예외 없이 restored=false', async () => {
      sessionStorageStore[`${KEY_PREFIX}home-broken`] = '{ invalid json ';

      triggerPopstate();

      let result: ReturnType<typeof renderHook<boolean, unknown>>['result'] | undefined;
      let threw = false;
      try {
        await act(async () => {
          const rendered = renderHook(() =>
            useScrollRestore<TestSnapshot>('home-broken', {
              capture: vi.fn(() => ({ items: [], page: 0 })),
              restore: vi.fn(),
            })
          );
          result = rendered.result;
        });
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
      expect(result?.current).toBe(false);
      // 깨진 스냅샷은 제거됨
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(`${KEY_PREFIX}home-broken`);
    });

    it('구조 불일치 (scrollY 누락) 시 복원 안 함', async () => {
      // scrollY 없이 저장된 경우
      sessionStorageStore[`${KEY_PREFIX}home-malformed`] = JSON.stringify({ data: { items: [], page: 0 } });

      triggerPopstate();

      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('home-malformed', {
            capture: vi.fn(() => ({ items: [], page: 0 })),
            restore: restoreFn,
          })
        );
      });

      expect(restoreFn).not.toHaveBeenCalled();
    });
  });

  describe('엣지: popstate 플래그 1회 소모', () => {
    it('popstate 후 첫 번째 마운트만 복원하고, 두 번째 마운트는 복원하지 않는다', async () => {
      const snapshot: TestSnapshot = { items: ['once'], page: 7 };

      // 두 키 모두 스냅샷 준비
      sessionStorageStore[`${KEY_PREFIX}page-first`] = JSON.stringify({ data: snapshot, scrollY: 100 });
      sessionStorageStore[`${KEY_PREFIX}page-second`] = JSON.stringify({ data: snapshot, scrollY: 200 });

      triggerPopstate();

      const restoreFn1 = vi.fn();
      const restoreFn2 = vi.fn();

      // 첫 번째 마운트 — 플래그 소모
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('page-first', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn1,
          })
        );
      });

      // 두 번째 마운트 — 플래그 이미 소모됨
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('page-second', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn2,
          })
        );
      });

      expect(restoreFn1).toHaveBeenCalledTimes(1);
      expect(restoreFn2).not.toHaveBeenCalled();
    });
  });

  describe('[blocker1] pushState 호출 시 popstate 플래그 클리어', () => {
    it('popstate → pushState → 마운트 순서이면 복원하지 않는다', async () => {
      const snapshot: TestSnapshot = { items: ['stale'], page: 2 };
      sessionStorageStore[`${KEY_PREFIX}push-clear`] = JSON.stringify({ data: snapshot, scrollY: 300 });

      // popstate 발생 (뒤로가기)
      triggerPopstate();
      // pushState 호출 (일반 내비게이션 — 로고 클릭 등)
      triggerPushState();

      // 이 시점에서 플래그는 클리어되어 있어야 함
      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('push-clear', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn,
          })
        );
      });

      expect(restoreFn).not.toHaveBeenCalled();
      expect(scrollToMock).not.toHaveBeenCalled();
    });
  });

  describe('[major4] validate 콜백', () => {
    it('validate가 실패하면 복원하지 않는다', async () => {
      // data 구조가 잘못된 스냅샷 (items가 배열이 아님)
      sessionStorageStore[`${KEY_PREFIX}validate-fail`] = JSON.stringify({
        data: { items: 'not-array', page: 1 },
        scrollY: 150,
      });

      triggerPopstate();

      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('validate-fail', {
            capture: vi.fn(() => ({ items: [], page: 0 })),
            restore: restoreFn,
            validate: isTestSnapshot,
          })
        );
      });

      expect(restoreFn).not.toHaveBeenCalled();
      // 잘못된 스냅샷은 제거됨
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(`${KEY_PREFIX}validate-fail`);
    });

    it('validate가 성공하면 정상 복원된다', async () => {
      const snapshot: TestSnapshot = { items: ['valid'], page: 1 };
      sessionStorageStore[`${KEY_PREFIX}validate-pass`] = JSON.stringify({
        data: snapshot,
        scrollY: 200,
      });

      triggerPopstate();

      const restoreFn = vi.fn();
      await act(async () => {
        renderHook(() =>
          useScrollRestore<TestSnapshot>('validate-pass', {
            capture: vi.fn(() => snapshot),
            restore: restoreFn,
            validate: isTestSnapshot,
          })
        );
      });

      expect(restoreFn).toHaveBeenCalledWith(snapshot);
    });
  });

  describe('[major6] trailing throttle — 스크롤 후 unmount 시 마지막 scrollY 저장', () => {
    it('스크롤 이벤트 후 unmount 시 기록된 scrollY가 저장된다', () => {
      vi.useFakeTimers();

      // window.scrollY를 모의로 설정 가능하도록 property 재정의
      let mockScrollY = 0;
      Object.defineProperty(window, 'scrollY', {
        get: () => mockScrollY,
        configurable: true,
      });

      const captureFn = vi.fn(() => ({ items: ['a'], page: 1 }));
      const { unmount } = renderHook(() =>
        useScrollRestore<TestSnapshot>('throttle-test', {
          capture: captureFn,
          restore: vi.fn(),
        })
      );

      // 스크롤 이벤트 발생
      mockScrollY = 500;
      window.dispatchEvent(new Event('scroll'));

      // 타이머 flush (trailing throttle 포함)
      vi.runAllTimers();

      unmount();

      // setItem이 호출됐는지 확인
      expect(sessionStorageMock.setItem).toHaveBeenCalled();
      const callArg = sessionStorageMock.setItem.mock.calls[0][1] as string;
      const saved = JSON.parse(callArg);
      // scrollY가 0이 아닌 실제 스크롤 위치로 저장되어야 함
      expect(saved.scrollY).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('150ms 윈도 내 두 번째 스크롤(y 변경) 후 타이머 flush 없이 unmount 시 cleanup이 마지막 scrollY를 저장한다', () => {
      vi.useFakeTimers();

      let mockScrollY = 0;
      Object.defineProperty(window, 'scrollY', {
        get: () => mockScrollY,
        configurable: true,
      });

      const captureFn = vi.fn(() => ({ items: ['b'], page: 2 }));
      const { unmount } = renderHook(() =>
        useScrollRestore<TestSnapshot>('throttle-trailing', {
          capture: captureFn,
          restore: vi.fn(),
        })
      );

      // 첫 번째 스크롤 — leading 기록(300), throttle 타이머 시작
      mockScrollY = 300;
      window.dispatchEvent(new Event('scroll'));

      // 150ms 이내에 두 번째 스크롤 — lastScrollY만 갱신, 타이머는 유지
      vi.advanceTimersByTime(50);
      mockScrollY = 700;
      window.dispatchEvent(new Event('scroll'));

      // 타이머 flush 없이 바로 unmount → cleanup 경로에서 lastScrollY(700)가 저장되어야 함
      unmount();

      expect(sessionStorageMock.setItem).toHaveBeenCalled();
      const callArg = sessionStorageMock.setItem.mock.calls[0][1] as string;
      const saved = JSON.parse(callArg);
      expect(saved.scrollY).toBe(700);

      vi.useRealTimers();
    });
  });
});
