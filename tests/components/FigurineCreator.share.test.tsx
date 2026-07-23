import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { FigurineJob, User } from '@/types/api';
import type { FigurinePhase } from '@/hooks/useFigurineJob';
import { buildFigurineShareUrl } from '@/lib/figurineShare';

const { hookState, routerMock, authMock, uploadMock, toastMock, preloadMock } = vi.hoisted(() => ({
  hookState: {
    job: null as FigurineJob | null,
    phase: 'idle' as FigurinePhase,
    errorMessage: null as string | null,
    start: vi.fn(),
    publish: vi.fn(),
    reset: vi.fn(),
  },
  routerMock: { push: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  uploadMock: { uploadPostImage: vi.fn() },
  toastMock: { showToast: vi.fn() },
  preloadMock: { preloadImage: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useFigurineJob', () => ({ useFigurineJob: () => hookState }));
vi.mock('@/lib/uploadImage', () => uploadMock);
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));
vi.mock('@/lib/preloadImage', () => ({ preloadImage: preloadMock.preloadImage }));

import FigurineCreator from '@/components/domain/FigurineCreator';

const RESULT_URL = 'https://images.jipsamoye.com/figurines/8/result.png';

const completedJob = (overrides: Partial<FigurineJob> = {}): FigurineJob => ({
  jobId: 1,
  status: 'COMPLETED',
  resultImageUrl: RESULT_URL,
  failReason: null,
  petPostId: null,
  ...overrides,
});

function setNavigatorProp(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { writable: true, configurable: true, value });
}

describe('FigurineCreator — 링크로 공유하기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.phase = 'completed';
    hookState.job = completedJob();
    hookState.errorMessage = null;
    authMock.user = { nickname: '집사' } as unknown as User;
    preloadMock.preloadImage.mockResolvedValue(undefined);
    setNavigatorProp('share', undefined);
    setNavigatorProp('clipboard', undefined);
  });

  it('completed: 결과 화면에 공유 버튼이 활성 상태로 보인다', async () => {
    render(<FigurineCreator />);
    expect(await screen.findByText('링크로 공유하기')).toBeEnabled();
  });

  it('navigator.share 지원 시 공유 페이지 URL로 네이티브 공유 시트를 연다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('share', share);
    render(<FigurineCreator />);

    fireEvent.click(await screen.findByText('링크로 공유하기'));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: 'AI 키캡 피규어 — 집사모여',
        url: buildFigurineShareUrl(RESULT_URL, window.location.origin),
      });
    });
  });

  it('navigator.share 취소(거부)는 조용히 무시한다', async () => {
    setNavigatorProp('share', vi.fn().mockRejectedValue(new DOMException('취소', 'AbortError')));
    render(<FigurineCreator />);

    fireEvent.click(await screen.findByText('링크로 공유하기'));

    await waitFor(() => expect(toastMock.showToast).not.toHaveBeenCalled());
  });

  it('navigator.share 미지원 시 클립보드에 복사하고 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('clipboard', { writeText });
    render(<FigurineCreator />);

    fireEvent.click(await screen.findByText('링크로 공유하기'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(buildFigurineShareUrl(RESULT_URL, window.location.origin));
      expect(toastMock.showToast).toHaveBeenCalledWith('링크가 복사됐어요!');
    });
  });

  it('클립보드 복사 실패 시 실패 토스트를 띄운다', async () => {
    setNavigatorProp('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    render(<FigurineCreator />);

    fireEvent.click(await screen.findByText('링크로 공유하기'));

    await waitFor(() => {
      expect(toastMock.showToast).toHaveBeenCalledWith('링크 복사에 실패했어요.');
    });
  });

  it('posted 상태에서도 공유 버튼은 활성 상태다 (서버 변이 없는 동작)', async () => {
    hookState.phase = 'posted';
    hookState.job = completedJob({ petPostId: 77 });
    render(<FigurineCreator />);

    expect(await screen.findByText('링크로 공유하기')).toBeEnabled();
  });

  it('posting 중에는 공유 버튼이 비활성화된다', async () => {
    hookState.phase = 'posting';
    render(<FigurineCreator />);

    expect(await screen.findByText('링크로 공유하기')).toBeDisabled();
  });
});
