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
  it('isOpen=true 이면 게스트/네이버 버튼과 설명 pill이 렌더된다', () => {
    render(
      <LoginModal isOpen onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /게스트로 둘러보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /네이버로 계속하기/ })).toBeInTheDocument();
    expect(screen.getByText('회원가입 없이 모든 기능을 체험할 수 있어요')).toBeInTheDocument();
  });

  it('게스트 버튼의 접근성 이름은 정확히 "게스트로 둘러보기"이다 (🐾는 aria-hidden)', () => {
    render(
      <LoginModal isOpen onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    // 정확 매칭: 발자국 이모지(🐾)는 aria-hidden 처리되어 접근성 이름에 포함되지 않는다
    expect(
      screen.getByRole('button', { name: '게스트로 둘러보기' })
    ).toBeInTheDocument();
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

    const naverBtn = screen.getByRole('button', { name: /네이버로 계속하기/ });
    fireEvent.click(naverBtn);

    expect(startNaverLoginMock).toHaveBeenCalledTimes(1);
  });

  it('게스트 버튼 클릭 시 onGuestLogin과 onClose가 각각 1번씩 호출된다', () => {
    const onGuestLogin = vi.fn();
    const onClose = vi.fn();

    render(
      <LoginModal isOpen onClose={onClose} onGuestLogin={onGuestLogin} />
    );

    const guestBtn = screen.getByRole('button', { name: /게스트로 둘러보기/ });
    fireEvent.click(guestBtn);

    expect(onGuestLogin).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('isOpen=false 이면 아무것도 렌더되지 않는다', () => {
    render(
      <LoginModal isOpen={false} onClose={vi.fn()} onGuestLogin={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: /게스트로 둘러보기/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /네이버로 계속하기/ })).toBeNull();
    expect(screen.queryByText('회원가입 없이 모든 기능을 체험할 수 있어요')).toBeNull();
  });
});
