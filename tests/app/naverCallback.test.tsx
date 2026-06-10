import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { User } from '@/types/api';
import React from 'react';

// ── vi.hoisted: 가변 모킹 값들 ─────────────────────────────────────────────────
const {
  replaceMock,
  updateUserMock,
  showToastMock,
  requestNaverLoginMock,
  searchParamsRef,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  updateUserMock: vi.fn(),
  showToastMock: vi.fn(),
  requestNaverLoginMock: vi.fn(),
  // 테스트별로 바꿀 searchParams 참조
  searchParamsRef: { current: new URLSearchParams('code=c&state=s') },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock('@/lib/naverAuth', () => ({
  requestNaverLogin: requestNaverLoginMock,
  NAVER_STATE_KEY: 'naver_oauth_state',
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => ({ updateUser: updateUserMock }),
}));

vi.mock('@/components/common/Toast', () => ({
  showToast: showToastMock,
  default: () => null,
}));

import NaverCallbackPage from '@/app/auth/naver/callback/page';

// ── 공통 User 샘플 ─────────────────────────────────────────────────────────────
const sampleUser: User = {
  nickname: '집사갑',
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
  totalLikeCount: 0,
  ranking: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const NAVER_STATE_KEY = 'naver_oauth_state';

beforeEach(() => {
  replaceMock.mockReset();
  updateUserMock.mockReset();
  showToastMock.mockReset();
  requestNaverLoginMock.mockReset();
  sessionStorage.clear();
  // 기본 searchParams: code=c, state=s
  searchParamsRef.current = new URLSearchParams('code=c&state=s');
});

describe('NaverCallbackPage', () => {
  it('state 일치 + requestNaverLogin 성공(기존 유저) → updateUser + replace("/") 호출', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    requestNaverLoginMock.mockResolvedValue({ ok: true, isNewUser: false, user: sampleUser });

    render(<NaverCallbackPage />);

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith(sampleUser));
    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('신규 유저(isNewUser:true)이면 "환영" 포함 토스트를 표시한다', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    requestNaverLoginMock.mockResolvedValue({ ok: true, isNewUser: true, user: sampleUser });

    render(<NaverCallbackPage />);

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
    const [msg] = showToastMock.mock.calls[0] as [string];
    expect(msg).toContain('환영');
    expect(replaceMock).toHaveBeenCalledWith('/');
    // [Minor 항목 6] 신규 유저 케이스에서도 updateUser가 user 인자로 호출되어야 한다
    expect(updateUserMock).toHaveBeenCalledWith(sampleUser);
  });

  it('state 불일치이면 showToast(에러) + replace("/") 호출, requestNaverLogin 미호출', async () => {
    // sessionStorage에 다른 state 저장
    sessionStorage.setItem(NAVER_STATE_KEY, 'DIFFERENT_STATE');
    // searchParams의 state=s 와 불일치

    render(<NaverCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
    expect(showToastMock).toHaveBeenCalled();
    expect(requestNaverLoginMock).not.toHaveBeenCalled();
  });

  it('code 없음이면 showToast + replace("/") 호출, requestNaverLogin 미호출', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    // code 없는 searchParams
    searchParamsRef.current = new URLSearchParams('state=s');

    render(<NaverCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
    expect(showToastMock).toHaveBeenCalled();
    expect(requestNaverLoginMock).not.toHaveBeenCalled();
  });

  it('requestNaverLogin이 NAVER_TOKEN_EXCHANGE_FAILED → "만료" 포함 토스트', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    requestNaverLoginMock.mockResolvedValue({ ok: false, code: 'NAVER_TOKEN_EXCHANGE_FAILED' });

    render(<NaverCallbackPage />);

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
    const [msg] = showToastMock.mock.calls[0] as [string];
    expect(msg).toContain('만료');
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('requestNaverLogin이 다른 에러 코드 → 토스트 후 replace("/")', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    requestNaverLoginMock.mockResolvedValue({ ok: false, code: 'NAVER_API_ERROR' });

    render(<NaverCallbackPage />);

    await waitFor(() => expect(showToastMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  // [Major 항목 2] 제목과 주석을 정직하게 정정
  // 실제 브라우저 dev 모드의 React StrictMode는 effect를 두 번 실행하지만,
  // Vitest(NODE_ENV=test)에서는 이중 실행이 일어나지 않는다.
  // 따라서 이 테스트는 "테스트 환경의 정상 흐름에서 1회만 호출되는지" 검증한다.
  // `ran.current` ref 가드는 브라우저 dev StrictMode의 단일 마운트 내 이중 effect만
  // 방어하며, 테스트 환경에선 재현 불가 — 실제 회귀 방어는 코드 리뷰로 보장.
  it('정상 흐름에서 requestNaverLogin이 1회만 호출된다', async () => {
    sessionStorage.setItem(NAVER_STATE_KEY, 's');
    requestNaverLoginMock.mockResolvedValue({ ok: true, isNewUser: false, user: sampleUser });

    render(
      <React.StrictMode>
        <NaverCallbackPage />
      </React.StrictMode>
    );

    await waitFor(() => expect(updateUserMock).toHaveBeenCalled());
    expect(requestNaverLoginMock).toHaveBeenCalledTimes(1);
  });

  // [Minor 항목 4] 콜백 직접 진입(CSRF 시나리오): sessionStorage에 state가 없는 상태
  it('sessionStorage에 state가 없는 상태(saved=null)에서 콜백 직접 진입 → 에러 토스트 + replace("/"), requestNaverLogin 미호출', async () => {
    // sessionStorage를 비워둔다 (beforeEach에서 이미 clear됨, 명시적으로 확인)
    expect(sessionStorage.getItem(NAVER_STATE_KEY)).toBeNull();
    // searchParams에는 code/state가 있지만 sessionStorage에 저장된 state가 없음
    searchParamsRef.current = new URLSearchParams('code=c&state=s');

    render(<NaverCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
    expect(showToastMock).toHaveBeenCalled();
    expect(requestNaverLoginMock).not.toHaveBeenCalled();
  });
});
