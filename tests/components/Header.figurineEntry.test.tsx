import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Header from '@/components/layout/Header';

// Header가 의존하는 프로바이더 훅 / 네비게이션 목킹 (Header.notificationPanel.test.tsx와 동일)
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/providers/NavigationGuard', () => ({
  useNavigationGuard: () => ({ guardedPush: vi.fn() }),
}));
vi.mock('@/components/providers/HomeRefreshProvider', () => ({
  useHomeRefresh: () => ({ refreshHome: vi.fn() }),
}));
vi.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    fetchNotifications: vi.fn(),
  }),
}));

describe('Header AI 키캡 진입 버튼', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('로그인 상태에서 /figurines/new 링크를 렌더한다', () => {
    const { container } = render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('비로그인 상태에서는 렌더하지 않는다', () => {
    const { container } = render(<Header />);
    expect(container.querySelector('a[href="/figurines/new"]')).toBeNull();
  });
});
