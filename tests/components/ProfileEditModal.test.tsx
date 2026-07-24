import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User } from '@/types/api';

// ─── 가변 모킹 값 ─────────────────────────────────────────────────────────────
const { apiMock, pushMock, toastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  pushMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import ProfileEditModal from '@/components/domain/ProfileEditModal';

const baseProfile: User = {
  nickname: '집사',
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

function renderModal() {
  return render(
    <ProfileEditModal
      isOpen
      onClose={vi.fn()}
      profile={baseProfile}
      onSaved={vi.fn()}
    />
  );
}

const getNicknameInput = () => screen.getByDisplayValue('집사') as HTMLInputElement;
const getSaveButton = () =>
  screen.getByRole('button', { name: /변경 내용 저장/ }) as HTMLButtonElement;

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.patch.mockReset();
  pushMock.mockReset();
  toastMock.mockReset();
  // 기본: 중복 체크는 사용 가능으로 응답
  apiMock.get.mockResolvedValue({ data: true });
});

describe('ProfileEditModal 닉네임 공백 검증', () => {
  it('중간 공백이 있으면 안내 문구를 표시하고 저장 버튼을 비활성화한다', () => {
    renderModal();
    fireEvent.change(getNicknameInput(), { target: { value: '집 사' } });

    expect(screen.getByText('닉네임에 공백을 포함할 수 없어요')).toBeInTheDocument();
    expect(getSaveButton()).toBeDisabled();
  });

  it('앞뒤 공백도 공백 에러로 처리한다', () => {
    renderModal();
    fireEvent.change(getNicknameInput(), { target: { value: '집사 ' } });

    expect(screen.getByText('닉네임에 공백을 포함할 수 없어요')).toBeInTheDocument();
    expect(getSaveButton()).toBeDisabled();
  });

  it('공백이 있으면 중복 체크 API를 호출하지 않는다', () => {
    renderModal();
    fireEvent.change(getNicknameInput(), { target: { value: '뽀 삐' } });

    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('공백을 제거하면 에러 문구가 사라지고 정상 검증으로 복귀한다', async () => {
    renderModal();
    const input = getNicknameInput();

    // 먼저 공백 입력 → 에러
    fireEvent.change(input, { target: { value: '뽀 삐' } });
    expect(screen.getByText('닉네임에 공백을 포함할 수 없어요')).toBeInTheDocument();

    // 공백 제거 → 디바운스 후 사용 가능
    fireEvent.change(input, { target: { value: '뽀삐' } });
    await waitFor(() => {
      expect(screen.getByText('사용 가능한 닉네임이에요 ✓')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('닉네임에 공백을 포함할 수 없어요')
    ).not.toBeInTheDocument();
    expect(getSaveButton()).not.toBeDisabled();
  });

  it('공백 없는 2자 미만 입력은 길이 안내 문구를 표시한다 (공백 규칙과 구분)', () => {
    renderModal();
    fireEvent.change(getNicknameInput(), { target: { value: '가' } });

    expect(screen.getByText('2자 이상 입력해 주세요')).toBeInTheDocument();
    expect(
      screen.queryByText('닉네임에 공백을 포함할 수 없어요')
    ).not.toBeInTheDocument();
  });
});
