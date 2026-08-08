import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FigurineJob, User } from '@/types/api';
import type { FigurinePhase } from '@/hooks/useFigurineJob';

const { hookState, routerMock, authMock, preloadMock, soundMock } = vi.hoisted(() => ({
  hookState: {
    job: null as FigurineJob | null,
    phase: 'idle' as FigurinePhase,
    errorMessage: null as string | null,
    start: vi.fn(),
    publish: vi.fn(),
    reset: vi.fn(),
  },
  routerMock: { push: vi.fn() },
  authMock: { user: { nickname: '집사' } as unknown as User, loading: false },
  preloadMock: { preloadImage: vi.fn() },
  soundMock: { playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useFigurineJob', () => ({ useFigurineJob: () => hookState }));
vi.mock('@/lib/preloadImage', () => ({ preloadImage: preloadMock.preloadImage }));
vi.mock('@/lib/keycapSound', () => soundMock);

import FigurineCreator from '@/components/domain/FigurineCreator';

describe('FigurineCreator — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    hookState.phase = 'completed';
    hookState.job = {
      jobId: 1, status: 'COMPLETED',
      resultImageUrl: 'https://cdn/results/1.png',
      failReason: null, petPostId: null,
    };
    preloadMock.preloadImage.mockResolvedValue(undefined);
  });

  it('완성 이미지가 PressableKeycap(유도 포함)으로 감싸인다', async () => {
    render(<FigurineCreator />);
    const keyButton = await screen.findByRole('button', { name: '키캡 누르기' });
    expect(keyButton).toContainElement(screen.getByAltText('완성된 AI 키캡 피규어'));
    // 결과 화면은 유도 있음 (기획 확정)
    expect(await screen.findByText('눌러보기')).toBeInTheDocument();
  });

  it('축 칩바가 이미지 아래·CTA 위에 온다 (기획 확정 순서)', async () => {
    render(<FigurineCreator />);
    const chip = await screen.findByRole('button', { name: '갈축' });
    const cta = screen.getByRole('button', { name: '자랑 피드에 게시하기' });
    // DOM 순서: 칩이 CTA보다 앞
    expect(chip.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
