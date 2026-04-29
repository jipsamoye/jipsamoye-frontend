import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollMemory } from '@/hooks/useScrollMemory';

describe('useScrollMemory', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    // requestAnimationFrame을 동기 즉시 실행으로 mock — 테스트 단순화
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('ready=true이고 저장된 위치가 있으면 scrollTo로 복원한다', () => {
    sessionStorage.setItem('scroll:home', '1234');
    renderHook(() => useScrollMemory('home', true));
    expect(scrollToSpy).toHaveBeenCalledWith(0, 1234);
  });

  it('ready=false면 초기 복원하지 않는다', () => {
    sessionStorage.setItem('scroll:home', '1234');
    renderHook(() => useScrollMemory('home', false));
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('저장된 위치가 없으면 scrollTo 호출하지 않는다', () => {
    renderHook(() => useScrollMemory('home', true));
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('popstate 이벤트가 발생하면 저장된 위치로 복원한다 (router.back cache hit 대응)', () => {
    sessionStorage.setItem('scroll:home', '999');
    renderHook(() => useScrollMemory('home', false)); // 초기 복원 비활성
    expect(scrollToSpy).not.toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(scrollToSpy).toHaveBeenCalledWith(0, 999);
  });

  it('scroll 이벤트 시 sessionStorage에 현재 scrollY를 저장한다', () => {
    renderHook(() => useScrollMemory('home', true));

    Object.defineProperty(window, 'scrollY', { value: 567, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    expect(sessionStorage.getItem('scroll:home')).toBe('567');
  });

  it('서로 다른 키는 서로 다른 위치를 저장/복원한다', () => {
    sessionStorage.setItem('scroll:home', '100');
    sessionStorage.setItem('scroll:board', '200');

    const { unmount: unmountHome } = renderHook(() => useScrollMemory('home', true));
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 100);
    unmountHome();

    scrollToSpy.mockClear();
    renderHook(() => useScrollMemory('board', true));
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 200);
  });
});
