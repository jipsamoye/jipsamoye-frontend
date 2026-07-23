import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { openLoginModal } from '@/lib/loginModal';

const { authMock } = vi.hoisted(() => ({
  authMock: { user: null, loading: false, loginAsGuest: vi.fn(), logout: vi.fn() },
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));
vi.mock('@/components/providers/AppProviders', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/providers/HomeRefreshProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useHomeRefresh: () => ({ refreshKey: 0 }),
}));
vi.mock('@/components/layout/Header', () => ({ default: () => <header /> }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <aside /> }));
vi.mock('@/components/layout/MobileDrawer', () => ({ default: () => null }));
vi.mock('@/components/layout/FloatingWriteButton', () => ({ default: () => null }));
vi.mock('@/components/common/Toast', () => ({ default: () => null }));
vi.mock('@/components/domain/LoginModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal" /> : null,
}));

import ClientLayout from '@/components/layout/ClientLayout';

describe('ClientLayout — 로그인 모달 전역 열기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('openLoginModal() 호출 시 로그인 모달이 열린다', () => {
    render(<ClientLayout><div /></ClientLayout>);
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();

    act(() => openLoginModal());

    expect(screen.getByTestId('login-modal')).toBeInTheDocument();
  });

  it('언마운트 후에는 openLoginModal()이 아무 일도 하지 않는다', () => {
    const { unmount } = render(<ClientLayout><div /></ClientLayout>);
    unmount();

    expect(() => openLoginModal()).not.toThrow();
  });
});
