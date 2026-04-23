import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import HomeRefreshProvider, { useHomeRefresh } from '@/components/providers/HomeRefreshProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HomeRefreshProvider>{children}</HomeRefreshProvider>
);

describe('HomeRefreshProvider', () => {
  it('refreshKey 초기값은 0이다', () => {
    const { result } = renderHook(() => useHomeRefresh(), { wrapper });
    expect(result.current.refreshKey).toBe(0);
  });

  it('refreshHome() 호출 시 refreshKey가 1씩 증가한다', () => {
    const { result } = renderHook(() => useHomeRefresh(), { wrapper });

    act(() => result.current.refreshHome());
    expect(result.current.refreshKey).toBe(1);

    act(() => result.current.refreshHome());
    expect(result.current.refreshKey).toBe(2);

    act(() => result.current.refreshHome());
    expect(result.current.refreshKey).toBe(3);
  });

  it('Provider 없이 사용하면 noop fallback이 동작한다 (앱 어디서든 안전 호출)', () => {
    const { result } = renderHook(() => useHomeRefresh());
    expect(result.current.refreshKey).toBe(0);
    expect(() => result.current.refreshHome()).not.toThrow();
  });
});
