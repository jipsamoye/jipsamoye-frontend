import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { BoardListItem as BoardListItemType } from '@/types/api';

// ─── vi.hoisted: 가변 모킹 값들 ───────────────────────────────────────────────
const { apiGetMock, useScrollRestoreMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  // useScrollRestore의 반환값(restored)을 테스트별로 제어
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useScrollRestoreMock: vi.fn<(...args: any[]) => boolean>(() => false),
}));

vi.mock('@/lib/api', () => ({ api: { get: apiGetMock } }));

// useScrollRestore를 모킹: restored 반환값만 제어하고, capture/restore는 기록하지 않는다
vi.mock('@/hooks/useScrollRestore', () => ({
  useScrollRestore: useScrollRestoreMock,
}));

vi.mock('@/components/domain/BoardListItem', () => ({
  default: ({ item }: { item: { title: string; id: number } }) => (
    <div data-testid="board-item">{item.title}</div>
  ),
}));

vi.mock('@/components/common/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/common/Pagination', () => ({
  default: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="pagination" onClick={() => onChange(2)}>
      페이지2
    </button>
  ),
}));

vi.mock('@/components/layout/icons', () => ({
  MagnifyingGlassIcon: () => <svg />,
}));

import BoardPage from '@/app/board/page';

const pageResponse = (items: object[], totalPages = 1) => ({
  data: {
    content: items,
    totalPages,
    totalElements: items.length,
    currentPage: 0,
    size: 20,
    hasNext: false,
  },
});

const sampleItem = {
  id: 1,
  category: 'GENERAL' as const,
  title: '첫 번째 글',
  contentPreview: '내용 미리보기',
  commentCount: 3,
  viewCount: 10,
  likeCount: 5,
  nickname: '집사A',
  profileImageUrl: null,
  createdAt: '2026-06-01T00:00:00Z',
};

describe('BoardPage — restoredModeRef 게이트', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useScrollRestoreMock.mockReset();
    useScrollRestoreMock.mockReturnValue(false);
  });

  it('일반 마운트(restored=false)이면 api.get을 호출한다', async () => {
    useScrollRestoreMock.mockReturnValue(false);
    apiGetMock.mockResolvedValueOnce(pageResponse([sampleItem]));

    render(<BoardPage />);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));
    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/boards'),
      expect.anything()
    );
  });

  it('useScrollRestore restore 콜백 실행 시 restoredModeRef가 세팅되어 api.get을 스킵한다', async () => {
    // useScrollRestore는 훅이므로 매 렌더마다 호출된다.
    // restore를 1회만 호출하도록 called 플래그로 가드한다.
    const snap = {
      items: [sampleItem] as BoardListItemType[],
      currentPage: 1,
      totalPages: 2,
      tab: 'ALL' as const,
      searchType: 'TITLE_CONTENT' as const,
      searchInput: '',
      activeQuery: null,
    };
    let restoreCalled = false;
    useScrollRestoreMock.mockImplementation(
      (_key: string, options: { restore: (s: typeof snap) => void }) => {
        if (!restoreCalled) {
          restoreCalled = true;
          options.restore(snap);
        }
        return true;
      }
    );

    render(<BoardPage />);

    // restoredModeRef.current=true이므로 fetch effect가 스킵되어야 한다
    await new Promise((r) => setTimeout(r, 20));
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('복원 마운트 후 탭 클릭 시 restoredModeRef가 해제되어 api.get이 호출된다', async () => {
    const snap = {
      items: [sampleItem] as BoardListItemType[],
      currentPage: 1,
      totalPages: 2,
      tab: 'ALL' as const,
      searchType: 'TITLE_CONTENT' as const,
      searchInput: '',
      activeQuery: null,
    };
    let restoreCalled = false;
    useScrollRestoreMock.mockImplementation(
      (_key: string, options: { restore: (s: typeof snap) => void }) => {
        if (!restoreCalled) {
          restoreCalled = true;
          options.restore(snap);
        }
        return true;
      }
    );
    apiGetMock.mockResolvedValue(pageResponse([sampleItem]));

    render(<BoardPage />);

    // 복원 직후 api.get 미호출 확인
    await new Promise((r) => setTimeout(r, 10));
    expect(apiGetMock).not.toHaveBeenCalled();

    // 탭 클릭 → restoredModeRef 해제 → fetch effect 실행
    const generalTab = screen.getByRole('button', { name: '일반' });
    fireEvent.click(generalTab);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));
    const firstCall = apiGetMock.mock.calls[0][0] as string;
    expect(firstCall).toContain('category=GENERAL');
  });

  it('검색 타입(select) 변경 시 api.get이 재호출된다', async () => {
    useScrollRestoreMock.mockReturnValue(false);
    apiGetMock.mockResolvedValue(pageResponse([sampleItem]));

    render(<BoardPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));

    // searchType select 변경
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'TITLE' } });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(2));
  });
});
