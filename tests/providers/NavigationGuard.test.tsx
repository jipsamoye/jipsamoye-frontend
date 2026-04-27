import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const routerPushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, back: vi.fn() }),
}));

// Modal needs to render children to let us observe modal state; mock it minimally
vi.mock('@/components/common/Modal', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock('@/components/common/Button', () => ({
  default: ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import NavigationGuardProvider, { useNavigationGuard } from '@/components/providers/NavigationGuard';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NavigationGuardProvider>{children}</NavigationGuardProvider>
);

function makeAnchorEvent(overrides: Partial<MouseEvent> = {}): React.MouseEvent<HTMLAnchorElement> {
  const base = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
  return base as unknown as React.MouseEvent<HTMLAnchorElement>;
}

describe('useNavigationGuard — interceptLink', () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    // reset window.history state
    window.history.replaceState(null, '', window.location.href);
  });

  it('가드 비활성 상태에서는 preventDefault를 호출하지 않는다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });
    const e = makeAnchorEvent();

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('가드 활성 상태에서는 preventDefault를 호출하고 모달을 열어야 한다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });

    act(() => {
      result.current.setBlocked(true);
    });

    const e = makeAnchorEvent();

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).toHaveBeenCalledOnce();
  });

  it('metaKey(Cmd+click)일 때는 가드 활성 상태에서도 preventDefault를 호출하지 않는다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });

    act(() => {
      result.current.setBlocked(true);
    });

    const e = makeAnchorEvent({ metaKey: true });

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('ctrlKey일 때는 가드 활성 상태에서도 preventDefault를 호출하지 않는다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });

    act(() => {
      result.current.setBlocked(true);
    });

    const e = makeAnchorEvent({ ctrlKey: true });

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('shiftKey일 때는 가드 활성 상태에서도 preventDefault를 호출하지 않는다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });

    act(() => {
      result.current.setBlocked(true);
    });

    const e = makeAnchorEvent({ shiftKey: true });

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('마우스 우클릭(button=2)일 때는 가드 활성 상태에서도 preventDefault를 호출하지 않는다', () => {
    const { result } = renderHook(() => useNavigationGuard(), { wrapper });

    act(() => {
      result.current.setBlocked(true);
    });

    const e = makeAnchorEvent({ button: 2 });

    act(() => {
      result.current.interceptLink(e, '/ranking');
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('Provider 없이 사용해도 interceptLink는 에러 없이 noop 동작한다', () => {
    const { result } = renderHook(() => useNavigationGuard());
    const e = makeAnchorEvent();
    expect(() => result.current.interceptLink(e, '/ranking')).not.toThrow();
  });
});
