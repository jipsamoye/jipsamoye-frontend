import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── naverAuth 모킹 ────────────────────────────────────────────────────────────
const { startNaverLoginMock } = vi.hoisted(() => ({
  startNaverLoginMock: vi.fn(),
}));

vi.mock('@/lib/naverAuth', () => ({
  startNaverLogin: startNaverLoginMock,
  NAVER_STATE_KEY: 'naver_oauth_state',
}));

import LoginModal from '@/components/domain/LoginModal';

beforeEach(() => {
  startNaverLoginMock.mockReset();
});

describe('LoginModal', () => {
  it('isOpen=true 이면 네이버 버튼과 Guest 버튼이 렌더된다', () => {
    render(
      <LoginModal isOpen onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    expect(screen.getByText(/네이버/)).toBeInTheDocument();
    expect(screen.getByText(/Guest/)).toBeInTheDocument();
  });

  it('카카오/구글 텍스트는 존재하지 않는다', () => {
    render(
      <LoginModal isOpen onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    expect(screen.queryByText(/카카오|구글|kakao|google/i)).toBeNull();
  });

  it('네이버 버튼 클릭 시 startNaverLogin이 호출된다', () => {
    render(
      <LoginModal isOpen onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    const naverBtn = screen.getByText(/네이버/);
    fireEvent.click(naverBtn);

    expect(startNaverLoginMock).toHaveBeenCalledTimes(1);
  });

  it('Guest 버튼 클릭 시 onGuestLogin과 onClose가 모두 호출된다', () => {
    const onGuestLogin = vi.fn();
    const onClose = vi.fn();

    render(
      <LoginModal isOpen onClose={onClose} onGuestLogin={onGuestLogin} />
    );

    const guestBtn = screen.getByText(/Guest/);
    fireEvent.click(guestBtn);

    expect(onGuestLogin).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('isOpen=false 이면 아무것도 렌더되지 않는다', () => {
    render(
      <LoginModal isOpen={false} onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    expect(screen.queryByText(/네이버/)).toBeNull();
    expect(screen.queryByText(/Guest/)).toBeNull();
  });
});
