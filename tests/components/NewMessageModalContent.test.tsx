import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { FollowUser } from '@/types/api';

// 디바운스(300ms) 경과 + 그에 이어지는 비동기 검색(Promise) 해소까지 한 번에 흘려보낸다.
// 가짜 타이머 환경에서 waitFor 가 폴링하지 못해 타임아웃되는 문제를 피하기 위해
// 타이머 진행과 마이크로태스크 flush 를 act 안에서 직접 수행한다.
async function flushDebouncedSearch() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    // mockResolvedValue 가 만든 Promise 체인을 비운다
    await Promise.resolve();
    await Promise.resolve();
  });
}

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
}));

import NewMessageModalContent from '@/components/domain/NewMessageModalContent';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePage = (items: object[]) =>
  successRes({
    content: items,
    totalPages: 1,
    totalElements: items.length,
    currentPage: 0,
    size: 20,
    hasNext: false,
  });

const makeSearchUser = (nickname: string, isFollowing = false) => ({
  nickname,
  profileImageUrl: null,
  isFollowing,
});

const following: FollowUser[] = [
  { nickname: '뽀삐', profileImageUrl: null },
  { nickname: '나비', profileImageUrl: null },
];

describe('NewMessageModalContent', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('빈 검색어(추천): 팔로잉 목록을 노출하고 API를 호출하지 않는다', () => {
    render(<NewMessageModalContent followingList={following} onSelect={vi.fn()} />);

    expect(screen.getByText('뽀삐')).toBeInTheDocument();
    expect(screen.getByText('나비')).toBeInTheDocument();
    expect(apiMock.get).not.toHaveBeenCalled();
    // 추천 목록엔 "구독 중" 배지가 없다
    expect(screen.queryByText('구독 중')).not.toBeInTheDocument();
  });

  it('팔로잉 0 + 검색어 없음: 안내 문구를 노출한다', () => {
    render(<NewMessageModalContent followingList={[]} onSelect={vi.fn()} />);

    expect(
      screen.getByText('검색해서 메시지를 보낼 상대를 찾아보세요')
    ).toBeInTheDocument();
  });

  it('검색어 입력 시 300ms 디바운스 후 전체 유저 검색 결과를 노출한다', async () => {
    apiMock.get.mockResolvedValueOnce(
      makePage([makeSearchUser('cat', true), makeSearchUser('dog', false)])
    );

    render(<NewMessageModalContent followingList={following} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('누구에게 메시지를 보낼까요?'), {
      target: { value: 'ca' },
    });

    // 디바운스 전에는 호출되지 않음
    expect(apiMock.get).not.toHaveBeenCalled();

    await flushDebouncedSearch();

    expect(apiMock.get).toHaveBeenCalledWith(
      '/api/users/search?q=ca&page=0&size=20',
      { silent: true }
    );
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.getByText('dog')).toBeInTheDocument();
    // 추천 항목(뽀삐)은 검색 모드에서 사라진다
    expect(screen.queryByText('뽀삐')).not.toBeInTheDocument();
  });

  it('검색 결과 항목 중 isFollowing=true 이면 "구독 중" 배지를 표시한다', async () => {
    apiMock.get.mockResolvedValueOnce(
      makePage([makeSearchUser('cat', true), makeSearchUser('dog', false)])
    );

    render(<NewMessageModalContent followingList={following} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('누구에게 메시지를 보낼까요?'), {
      target: { value: 'a' },
    });
    await flushDebouncedSearch();

    expect(screen.getByText('cat')).toBeInTheDocument();
    // cat 만 isFollowing=true → 배지 1개
    const badges = screen.getAllByText('구독 중');
    expect(badges).toHaveLength(1);
  });

  it('검색 결과 0: "검색 결과가 없어요" 문구를 노출한다', async () => {
    apiMock.get.mockResolvedValueOnce(makePage([]));

    render(<NewMessageModalContent followingList={following} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('누구에게 메시지를 보낼까요?'), {
      target: { value: 'zzz' },
    });
    await flushDebouncedSearch();

    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument();
  });

  it('항목 선택 시 onSelect 가 nickname/profileImageUrl 과 함께 호출된다', () => {
    const onSelect = vi.fn();
    render(<NewMessageModalContent followingList={following} onSelect={onSelect} />);

    fireEvent.click(
      screen.getByRole('button', { name: '뽀삐에게 메시지 보내기' })
    );
    expect(onSelect).toHaveBeenCalledWith({ nickname: '뽀삐', profileImageUrl: null });
  });
});
