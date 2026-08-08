import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const soundMock = vi.hoisted(() => ({
  playKeycapSound: vi.fn(),
  warmKeycapSound: vi.fn(),
}));
vi.mock('@/lib/keycapSound', () => soundMock);

import PressableKeycap from '@/components/domain/PressableKeycap';

// jsdom은 matchMedia 미구현 → reduced-motion 감지 스텁 (ProfileHoverCard.test.tsx 패턴)
function stubMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const renderKeycap = (nudge: boolean) =>
  render(
    <PressableKeycap nudge={nudge}>
      <img src="/result.png" alt="완성된 AI 키캡 피규어" />
    </PressableKeycap>,
  );

const keyButton = () => screen.getByRole('button', { name: '키캡 누르기' });
const squashTarget = () => keyButton().firstElementChild as HTMLElement;
const ripple = () => document.querySelector('[data-testid="keycap-ripple"]');

describe('PressableKeycap — 유도(넛지)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    stubMatchMedia(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nudge=true: 눌러보기 배지와 물결을 렌더한다', () => {
    renderKeycap(true);
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
    expect(ripple()).not.toBeNull();
  });

  it('배지: 바깥 요소가 정렬(-translate-x-1/2), 안쪽 배지가 둥둥 (제약 4)', () => {
    renderKeycap(true);
    const badge = screen.getByText('눌러보기');
    expect(badge.className).toContain('animate-[badgeFloat');
    const wrapper = badge.parentElement as HTMLElement;
    expect(wrapper.className).toContain('-translate-x-1/2');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).not.toContain('animate-');
  });

  it('nudge=false(게시글 상세): 배지·물결·자가 시연 전부 없음', () => {
    vi.useFakeTimers();
    renderKeycap(false);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(squashTarget().className).not.toContain('keycapNudge');
  });

  it('이미 눌러본 사람(keycap.pressed): 유도가 아예 안 뜬다', () => {
    localStorage.setItem('keycap.pressed', '1');
    renderKeycap(true);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
  });

  it('한 번 누르면 배지·물결이 사라지고 다시 안 뜬다', () => {
    renderKeycap(true);
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('스크롤로 취소된 누름(pointercancel): 화면상 유도는 사라지되 다음 방문엔 다시 뜬다', () => {
    const { unmount } = renderKeycap(true);
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerCancel(keyButton());
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(localStorage.getItem('keycap.pressed')).toBeNull();

    unmount();
    renderKeycap(true);
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
    expect(ripple()).not.toBeNull();
  });

  it('자가 시연: 0.9초 뒤 keycapNudge 애니메이션, 끝나면 제거, 4.2초에 한 번 더 — 소리는 없다', () => {
    vi.useFakeTimers();
    renderKeycap(true);

    act(() => vi.advanceTimersByTime(900));
    expect(squashTarget().className).toContain('keycapNudge');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();

    fireEvent.animationEnd(squashTarget());
    expect(squashTarget().className).not.toContain('keycapNudge');

    act(() => vi.advanceTimersByTime(3300)); // 누적 4200ms
    expect(squashTarget().className).toContain('keycapNudge');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('시연 전에 누르면 남은 시연 타이머가 취소된다', () => {
    vi.useFakeTimers();
    renderKeycap(true);
    act(() => {
      fireEvent.pointerDown(keyButton());
      fireEvent.pointerUp(keyButton());
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(squashTarget().className).not.toContain('keycapNudge');
  });

  it('prefers-reduced-motion: 물결·자가 시연 없음, 배지는 표시, 소리는 유지', () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    renderKeycap(true);

    expect(ripple()).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(squashTarget().className).not.toContain('keycapNudge');
    expect(screen.getByText('눌러보기')).toBeInTheDocument();

    fireEvent.pointerDown(keyButton());
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');
  });
});
