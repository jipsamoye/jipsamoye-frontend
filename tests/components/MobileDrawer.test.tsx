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
  SparklesIcon: () => <svg />,
}));

import MobileDrawer from '@/components/layout/MobileDrawer';

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

describe('MobileDrawer', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.loading = false;
  });

  it('비로그인 상태에서는 DM 메뉴를 렌더하지 않는다', () => {
    authMock.user = null;
    const { container } = render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('DM')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/dm"]')).toBeNull();
  });

  it('로그인 상태에서는 DM 메뉴를 렌더한다', () => {
    authMock.user = sampleUser;
    const { container } = render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('DM')).toBeInTheDocument();
    expect(container.querySelector('a[href="/dm"]')).not.toBeNull();
  });

  it('비로그인 상태에서도 인증이 필요없는 메뉴는 그대로 노출한다', () => {
    authMock.user = null;
    const { container } = render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);

    for (const label of ['홈', '랭킹', '자유게시판', '오픈채팅']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/ranking"]')).not.toBeNull();
    expect(container.querySelector('a[href="/board"]')).not.toBeNull();
    expect(container.querySelector('a[href="/chat"]')).not.toBeNull();
  });

  it('로그인 상태에서만 AI 키캡 메뉴를 렌더한다', () => {
    authMock.user = sampleUser;
    const { container } = render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('AI 키캡 만들기')).toBeInTheDocument();
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('비로그인 상태에서는 AI 키캡 메뉴를 렌더하지 않는다', () => {
    authMock.user = null;
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('AI 키캡 만들기')).not.toBeInTheDocument();
  });
});
