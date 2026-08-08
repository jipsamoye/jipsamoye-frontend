import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
const soundMock = vi.hoisted(() => ({ playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() }));
vi.mock('@/lib/keycapSound', () => soundMock);

import FigurineSharePage from '@/app/figurines/share/page';

const VALID_IMG = 'https://images.jipsamoye.com/posts/8/result.png';
const props = { searchParams: Promise.resolve({ img: VALID_IMG }) };

describe('공유 페이지 — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('DetailImage가 PressableKeycap(유도 포함)으로 감싸인다', async () => {
    render(await FigurineSharePage(props));
    const keyButton = screen.getByRole('button', { name: '키캡 누르기' });
    expect(keyButton).toContainElement(screen.getByAltText('AI 키캡 피규어'));
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
    // 백드롭은 DetailImage가 이미 띄운 800 썸네일과 같은 URL — 추가 다운로드 없음
    const backdrop = keyButton.querySelector('[data-testid="keycap-backdrop"]') as HTMLElement;
    expect(backdrop.style.backgroundImage).toContain(
      'https://images.jipsamoye.com/posts/8/thumbnails/result_800.webp',
    );
  });

  it('DetailImage 썸네일→원본 폴백이 래핑 후에도 살아 있다 (스펙 제약 5)', async () => {
    render(await FigurineSharePage(props));
    fireEvent.error(screen.getByAltText('AI 키캡 피규어'));
    expect(screen.getByAltText('AI 키캡 피규어')).toHaveAttribute('src', VALID_IMG);
  });

  it('키캡을 누르면 소리가 나고, 칩바가 CTA("나도 만들어보기") 위에 있다', async () => {
    render(await FigurineSharePage(props));
    fireEvent.pointerDown(screen.getByRole('button', { name: '키캡 누르기' }));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');

    const chip = screen.getByRole('button', { name: '갈축' });
    const cta = screen.getByRole('link', { name: '나도 만들어보기' });
    expect(chip.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
