import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { get: apiGetMock } }));

vi.mock('@/components/domain/PostCard', () => ({
  default: ({ post }: { post: { title: string } }) => (
    <div data-testid="post-card">{post.title}</div>
  ),
}));

vi.mock('@/components/common/Skeleton', () => ({
  PostCardSkeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/layout/icons', () => ({
  MagnifyingGlassIcon: () => <svg />,
}));

import SearchPage from '@/app/search/page';

// IntersectionObserver stub — 마지막으로 생성된 인스턴스의 콜백을 캡처
let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

beforeEach(() => {
  ioCallback = null;
  global.IntersectionObserver = vi.fn().mockImplementation((cb) => {
    ioCallback = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

const sliceResponse = (items: object[], hasNext = false) => ({
  data: {
    content: items,
    currentPage: 0,
    size: 20,
    hasNext,
  },
});

const makePost = (id: number) => ({
  id,
  title: `게시글 ${id}`,
  thumbnailUrl: null,
  likeCount: 0,
  commentCount: 0,
  nickname: '작성자',
  profileImageUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('SearchPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('2글자 이상 입력 후 Enter 하면 검색되고 결과가 렌더된다', async () => {
    apiGetMock.mockResolvedValueOnce(sliceResponse([makePost(1), makePost(2)]));

    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '강아지' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getAllByTestId('post-card')).toHaveLength(2)
    );
    expect(apiGetMock).toHaveBeenCalledWith(
      '/api/posts/search?q=%EA%B0%95%EC%95%84%EC%A7%80&page=0&size=20'
    );
  });

  it('1글자 입력 후 Enter 하면 검색하지 않고 안내 문구를 노출한다', () => {
    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('두 글자 이상 입력해주세요')).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('hasNext가 true면 스크롤 sentinel 노출 시 다음 페이지를 append한다', async () => {
    apiGetMock
      .mockResolvedValueOnce(sliceResponse([makePost(1)], true))
      .mockResolvedValueOnce(sliceResponse([makePost(2)], false));

    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '강아지' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getAllByTestId('post-card')).toHaveLength(1)
    );

    expect(apiGetMock).toHaveBeenCalledTimes(1);

    // IntersectionObserver 콜백 수동 트리거
    await waitFor(() => expect(ioCallback).not.toBeNull());
    act(() => {
      ioCallback!([{ isIntersecting: true }]);
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('post-card')).toHaveLength(2)
    );
    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(apiGetMock).toHaveBeenLastCalledWith(
      '/api/posts/search?q=%EA%B0%95%EC%95%84%EC%A7%80&page=1&size=20'
    );
  });

  it('검색 결과가 비어있으면 "검색 결과가 없어요"를 노출한다', async () => {
    apiGetMock.mockResolvedValueOnce(sliceResponse([]));

    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '없는검색어' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    );
  });

  it('새 검색을 시작하면 이전 검색 결과 카드가 즉시 사라진다', async () => {
    // 첫 검색: 결과 2개
    apiGetMock.mockResolvedValueOnce(sliceResponse([makePost(1), makePost(2)]));
    // 두 번째 검색: 응답을 지연시켜 클리어 시점을 관찰
    let resolveSecond!: (v: unknown) => void;
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => { resolveSecond = resolve; })
    );

    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '강아지' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getAllByTestId('post-card')).toHaveLength(2)
    );

    // 새 검색어로 재검색 — 응답 도착 전 이전 결과가 비워져야 함
    fireEvent.change(input, { target: { value: '고양이' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.queryAllByTestId('post-card')).toHaveLength(0)
    );

    // 두 번째 응답 도착 후 새 결과 렌더
    resolveSecond(sliceResponse([makePost(9)]));
    await waitFor(() =>
      expect(screen.getAllByTestId('post-card')).toHaveLength(1)
    );
  });

  it('한글 조합 중(isComposing) Enter는 검색을 트리거하지 않는다', () => {
    render(<SearchPage />);

    const input = screen.getByPlaceholderText('게시글을 검색해보세요');
    fireEvent.change(input, { target: { value: '강아지' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(apiGetMock).not.toHaveBeenCalled();
  });
});
