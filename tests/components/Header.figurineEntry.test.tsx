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
  KeycapIcon: ({ className }: { className?: string }) => (
    <svg data-testid="keycap-icon" className={className} />
  ),
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

  it('비로그인 상태에서도 데스크톱/모바일 진입점을 모두 렌더한다', () => {
    // 진입은 항상 열어 두고, 실제 이용 시점(/figurines/new)에서 로그인 모달로 유도한다 (PR #54 정책)
    const { container } = render(<Header />);
    const links = Array.from(container.querySelectorAll('a[href="/figurines/new"]'));
    expect(links).toHaveLength(2);
    expect(links.filter((el) => el.className.includes('lg:hidden'))).toHaveLength(1);
    expect(links.filter((el) => el.className.includes('hidden') && el.className.includes('lg:flex'))).toHaveLength(1);
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

  it('비로그인 상태에서도 모바일 아이콘 버튼을 렌더한다', () => {
    render(<Header />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink).toHaveAttribute('href', '/figurines/new');
    expect(mobileLink.querySelector('[data-testid="keycap-icon"]')).not.toBeNull();
  });

  it('모바일 버튼은 반짝이가 아니라 키캡 아이콘을 쓴다', () => {
    // ✨은 "AI"만 말하고 무엇을 만드는지 말하지 않아 키캡 아이콘으로 교체했다.
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink.querySelector('[data-testid="keycap-icon"]')).not.toBeNull();
    expect(mobileLink.querySelector('[data-testid="sparkles-icon"]')).toBeNull();
  });

  it('데스크톱 버튼은 키캡 아이콘이 텍스트 앞에 온다', () => {
    const { container } = render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const desktop = Array.from(container.querySelectorAll('a[href="/figurines/new"]'))
      .find((el) => el.className.includes('lg:flex'));

    expect(desktop).toBeDefined();
    // 첫 자식이 아이콘이어야 "아이콘 → 텍스트" 순서다 (텍스트가 먼저면 첫 자식은 텍스트 노드)
    expect(desktop!.firstChild).toBe(desktop!.querySelector('[data-testid="keycap-icon"]'));
  });

  it('데스크톱 버튼의 키캡 아이콘은 w-6 h-6 크기다', () => {
    const { container } = render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const desktop = Array.from(container.querySelectorAll('a[href="/figurines/new"]'))
      .find((el) => el.className.includes('lg:flex'));
    const icon = desktop!.querySelector('[data-testid="keycap-icon"]');

    expect(icon?.getAttribute('class')).toContain('w-6');
    expect(icon?.getAttribute('class')).toContain('h-6');
  });

  it('모바일 버튼에 "AI 키캡" 텍스트 라벨이 보인다', () => {
    // 아이콘만으로는 무엇을 만드는 버튼인지 알기 어려워 라벨을 추가했다.
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink.textContent).toContain('AI 키캡');
  });

  it('모바일 버튼 라벨은 아이콘 아래 세로 스택으로 배치된다', () => {
    render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink.className).toContain('flex-col');
    // 헤더 높이를 해치지 않도록 라벨은 10px 고정 크기를 쓴다
    const label = mobileLink.querySelector('span');
    expect(label?.textContent).toBe('AI 키캡');
    expect(label?.className).toContain('text-[10px]');
  });

  it('비로그인 상태의 모바일 버튼에도 라벨이 보인다', () => {
    render(<Header />);
    const mobileLink = screen.getByRole('link', { name: 'AI 키캡 만들기' });
    expect(mobileLink.textContent).toContain('AI 키캡');
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
