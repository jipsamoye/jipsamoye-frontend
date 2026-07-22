import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
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
// 어떤 아이콘이 쓰였는지 식별하기 위해 icons 모듈을 목킹한다 (MobileDrawer.test.tsx와 동일 패턴)
vi.mock('@/components/layout/icons', () => ({
  MagnifyingGlassIcon: () => <svg data-testid="search-icon" />,
  BellIcon: () => <svg data-testid="bell-icon" />,
  KeycapIcon: () => <svg data-testid="keycap-icon" />,
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
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

  it('로그인 상태에서 모바일용 아이콘 버튼을 렌더한다', () => {
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink).toHaveAttribute('href', '/figurines/new');
  });

  it('모바일 아이콘 버튼에 lg:hidden 클래스가 걸려 있다', () => {
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    // jsdom은 미디어쿼리를 평가하지 않으므로 반응형 계약을 클래스 존재로 검증한다
    expect(screen.getByRole('link', { name: 'AI 키캡 만들기' }).className).toContain('lg:hidden');
  });

  it('모바일/데스크톱 진입점이 서로 배타적으로 노출된다', () => {
    const { container } = render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const links = Array.from(container.querySelectorAll('a[href="/figurines/new"]'));
    expect(links).toHaveLength(2);

    const mobile = links.filter((el) => el.className.includes('lg:hidden'));
    const desktop = links.filter((el) => el.className.includes('hidden') && el.className.includes('lg:flex'));
    expect(mobile).toHaveLength(1);
    expect(desktop).toHaveLength(1);
    expect(mobile[0]).not.toBe(desktop[0]);
  });

  it('비로그인 상태에서는 모바일 아이콘 버튼도 렌더하지 않는다', () => {
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'AI 키캡 만들기' })).toBeNull();
  });

  it('모바일 버튼은 반짝이가 아니라 키캡 아이콘을 쓴다', () => {
    // ✨은 "AI"만 말하고 무엇을 만드는지 말하지 않아 키캡 아이콘으로 교체했다.
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink.querySelector('[data-testid="keycap-icon"]')).not.toBeNull();
    expect(mobileLink.querySelector('[data-testid="sparkles-icon"]')).toBeNull();
  });

  it('로고가 모바일에서 축소되어 320px에서도 줄바꿈되지 않는다', () => {
    // 아이콘이 하나 늘어나면 320px에서 로고가 2줄로 접히는 회귀가 있었다.
    // text-xl(모바일) + shrink-0 조합이 이를 막는다.
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const logo = screen.getByRole('button', { name: '집사모여' });
    expect(logo.className).toContain('text-xl');
    expect(logo.className).toContain('lg:text-2xl');
    expect(logo.className).toContain('shrink-0');
  });
});
