import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import Header from '@/components/layout/Header';

// Header가 의존하는 프로바이더 훅 / 네비게이션 목킹
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

const mockNotification = vi.fn();
vi.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: () => mockNotification(),
}));

const baseContext = {
  notifications: [],
  unreadCount: 0,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  fetchNotifications: vi.fn(),
};

function openPanel(unreadCount = 0) {
  mockNotification.mockReturnValue({ ...baseContext, unreadCount });
  const utils = render(
    <Header isLoggedIn nickname="tester" profileImageUrl={null} />
  );
  // 종 버튼: relative + p-2.5 클래스 (프로필 버튼은 pl-2.5, 메뉴 버튼은 aria-label 보유)
  const bellButton = Array.from(utils.container.querySelectorAll('button')).find(
    (b) => b.className.includes('relative') && b.className.includes('p-2.5')
  );
  if (!bellButton) throw new Error('알림 종 버튼을 찾지 못했습니다');
  fireEvent.click(bellButton);
  // 알림 패널: 고유한 rounded-2xl + shadow-xl 컨테이너
  const panel = utils.container.querySelector<HTMLElement>('.rounded-2xl.shadow-xl');
  if (!panel) throw new Error('알림 패널이 렌더되지 않았습니다');
  return { ...utils, panel };
}

describe('Header 알림 패널 위치 (모바일 회귀)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('종 버튼 클릭 시 알림 패널이 열린다', () => {
    const { getByText } = openPanel();
    expect(getByText('새로운 알림이 없어요')).toBeInTheDocument();
  });

  it('모바일에서는 뷰포트 기준 fixed로 배치된다 (버튼 기준 absolute 아님)', () => {
    const { panel } = openPanel();
    // 모바일 base: 화면에 고정
    expect(panel.classList.contains('fixed')).toBe(true);
    // 버그 재현 방지: base에 단독 absolute/right-0가 있으면 모바일에서 버튼(가운데)에 붙어 깨짐
    expect(panel.classList.contains('absolute')).toBe(false);
    expect(panel.classList.contains('right-0')).toBe(false);
  });

  it('데스크톱(lg)에서는 종 버튼 기준 absolute 우측 정렬로 복원된다', () => {
    const { panel } = openPanel();
    expect(panel.classList.contains('lg:absolute')).toBe(true);
    expect(panel.classList.contains('lg:right-0')).toBe(true);
    expect(panel.classList.contains('lg:top-full')).toBe(true);
    expect(panel.classList.contains('lg:w-80')).toBe(true);
  });

  it('모바일에서 패널 폭이 뷰포트를 넘지 않도록 제한된다', () => {
    const { panel } = openPanel();
    // w-[min(20rem,calc(100vw-1rem))] → 화면보다 넓어지지 않음
    const hasClampedWidth = Array.from(panel.classList).some((c) =>
      c.startsWith('w-[min(')
    );
    expect(hasClampedWidth).toBe(true);
  });
});
