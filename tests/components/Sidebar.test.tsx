import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { User } from '@/types/api';

const { authMock } = vi.hoisted(() => ({
  authMock: { user: null as User | null, loading: false },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));

vi.mock('@/components/providers/NavigationGuard', () => ({
  useNavigationGuard: () => ({ interceptLink: vi.fn() }),
}));

vi.mock('@/components/layout/icons', () => ({
  HomeIcon: () => <svg />,
  TrophyIcon: () => <svg />,
  NoteIcon: () => <svg />,
  OpenChatIcon: () => <svg />,
  PaperAirplaneIcon: () => <svg />,
  KeycapIcon: () => <svg data-testid="keycap-icon" />,
}));

import Sidebar from '@/components/layout/Sidebar';

const sampleUser: User = {
  nickname: '나',
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
} as unknown as User;

describe('Sidebar', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.loading = false;
  });

  it('비로그인 상태에서는 DM 메뉴를 렌더하지 않는다', () => {
    authMock.user = null;
    const { container } = render(<Sidebar />);
    expect(screen.queryByText('DM')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/dm"]')).toBeNull();
  });

  it('로그인 상태에서는 DM 메뉴를 렌더한다', () => {
    authMock.user = sampleUser;
    const { container } = render(<Sidebar />);
    expect(screen.getByText('DM')).toBeInTheDocument();
    expect(container.querySelector('a[href="/dm"]')).not.toBeNull();
  });

  it('비로그인 상태에서도 인증이 필요없는 메뉴는 그대로 노출한다', () => {
    authMock.user = null;
    const { container } = render(<Sidebar />);

    for (const label of ['홈', '랭킹', '자유게시판', '오픈채팅']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/ranking"]')).not.toBeNull();
    expect(container.querySelector('a[href="/board"]')).not.toBeNull();
    expect(container.querySelector('a[href="/chat"]')).not.toBeNull();
  });

  it('비로그인 상태에서도 AI 키캡 만들기 메뉴를 렌더한다', () => {
    authMock.user = null;
    const { container } = render(<Sidebar />);
    expect(screen.getByText('AI 키캡 만들기')).toBeInTheDocument();
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('로그인 상태에서도 AI 키캡 만들기 메뉴를 렌더한다', () => {
    authMock.user = sampleUser;
    const { container } = render(<Sidebar />);
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('AI 키캡 메뉴는 헤더·모바일 드로어와 같은 키캡 아이콘을 쓴다', () => {
    // 같은 기능이 진입점마다 다른 아이콘을 쓰면 같은 기능으로 인식되지 않는다.
    authMock.user = null;
    const { container } = render(<Sidebar />);
    const link = container.querySelector('a[href="/figurines/new"]');
    expect(link?.querySelector('[data-testid="keycap-icon"]')).not.toBeNull();
  });

  it('AI 키캡 만들기 메뉴 옆에 "신규" 뱃지를 AI 키캡 뱃지와 같은 디자인으로 렌더한다', () => {
    authMock.user = null;
    const { container } = render(<Sidebar />);
    const link = container.querySelector('a[href="/figurines/new"]');
    const badge = Array.from(link?.querySelectorAll('span') ?? []).find(
      (el) => el.textContent === '신규',
    );
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('from-amber-500');
    expect(badge?.className).toContain('rounded-full');
  });

  it('"신규" 뱃지는 AI 키캡 만들기 메뉴에만 붙는다', () => {
    authMock.user = sampleUser;
    const { container } = render(<Sidebar />);
    for (const href of ['/', '/ranking', '/board', '/chat', '/dm']) {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link?.textContent).not.toContain('신규');
    }
  });
});
