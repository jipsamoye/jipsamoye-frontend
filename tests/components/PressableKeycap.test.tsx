import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const soundMock = vi.hoisted(() => ({
  playKeycapSound: vi.fn(),
  warmKeycapSound: vi.fn(),
}));
vi.mock('@/lib/keycapSound', () => soundMock);

import PressableKeycap from '@/components/domain/PressableKeycap';

const renderKeycap = (props: { nudge?: boolean; className?: string } = {}) =>
  render(
    <PressableKeycap {...props}>
      <img src="/result.png" alt="완성된 AI 키캡 피규어" />
    </PressableKeycap>,
  );

const keyButton = () => screen.getByRole('button', { name: '키캡 누르기' });
// 스쿼시 대상은 children을 감싼 래퍼 div
const squashTarget = () => keyButton().firstElementChild as HTMLElement;

describe('PressableKeycap — 누름 코어', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('children 이미지를 그대로 렌더하고 버튼 역할을 가진다 (DetailImage 폴백 보존 구조)', () => {
    renderKeycap();
    expect(screen.getByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
    expect(keyButton()).toBeInTheDocument();
  });

  it('pointerdown: 스쿼시 클래스 + down 소리 / pointerup: 원복 + up 소리', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');

    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).not.toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });

  it('pointerleave로 벗어나도 올라온다 — 이후 pointerup이 와도 up은 한 번만', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerLeave(keyButton());
    fireEvent.pointerUp(keyButton());
    const ups = soundMock.playKeycapSound.mock.calls.filter(([, d]) => d === 'up');
    expect(ups).toHaveLength(1);
  });

  it('키보드: Space keydown/keyup으로 누르고 뗄 수 있고, 반복 keydown은 무시한다', () => {
    renderKeycap();
    fireEvent.keyDown(keyButton(), { key: ' ' });
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    fireEvent.keyDown(keyButton(), { key: ' ', repeat: true });
    const downs = soundMock.playKeycapSound.mock.calls.filter(([, d]) => d === 'down');
    expect(downs).toHaveLength(1);
    fireEvent.keyUp(keyButton(), { key: ' ' });
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });

  it('음소거 저장 상태: 소리는 안 나지만 스쿼시는 동작한다', () => {
    localStorage.setItem('keycap.muted', '1');
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('저장된 축(jade)을 마운트 후 반영해 재생·칩 선택에 쓴다', () => {
    localStorage.setItem('keycap.switch', 'jade');
    renderKeycap();
    expect(screen.getByRole('button', { name: '제이드' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(keyButton());
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('jade', 'down');
  });

  it('칩 클릭: 선택 저장 + warm + 프리뷰(down 즉시, 130ms 뒤 up)', () => {
    vi.useFakeTimers();
    renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    expect(localStorage.getItem('keycap.switch')).toBe('blue');
    expect(soundMock.warmKeycapSound).toHaveBeenCalledWith('blue');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('blue', 'down');
    act(() => vi.advanceTimersByTime(130));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('blue', 'up');
    vi.useRealTimers();
  });

  it('칩 연타: 앞선 프리뷰의 up 타이머는 취소된다 (130ms 안 연타 시 소리 중첩 방지)', () => {
    vi.useFakeTimers();
    renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    act(() => vi.advanceTimersByTime(50));
    fireEvent.click(screen.getByRole('button', { name: '적축' }));
    act(() => vi.advanceTimersByTime(300));
    const ups = soundMock.playKeycapSound.mock.calls.filter(([, d]) => d === 'up');
    expect(ups).toEqual([['red', 'up']]);
    vi.useRealTimers();
  });

  it('프리뷰 중 언마운트되면 남은 up 타이머가 취소된다', () => {
    vi.useFakeTimers();
    const { unmount } = renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(soundMock.playKeycapSound).not.toHaveBeenCalledWith('blue', 'up');
    vi.useRealTimers();
  });

  it('누른 채 포커스를 잃으면 눌린 상태가 풀린다 (blur 갇힘 방지)', () => {
    renderKeycap();
    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.blur(keyButton());
    expect(squashTarget().className).not.toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });

  it('음소거 토글이 localStorage에 저장되고, 음소거 중 칩 클릭은 선택만 바꾼다', () => {
    renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '소리 끄기' }));
    expect(localStorage.getItem('keycap.muted')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: '적축' }));
    expect(localStorage.getItem('keycap.switch')).toBe('red');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('첫 누름(pointerdown→pointerup)을 localStorage에 기록한다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('pointercancel로 끝난 누름은 기록하지 않는다 (모바일 스크롤로 유도 소진 방지)', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerCancel(keyButton());
    expect(localStorage.getItem('keycap.pressed')).toBeNull();
    // 소리·원복은 그대로 (기록만 건너뛴다)
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
    expect(squashTarget().className).not.toContain('scale-y-[0.9]');
  });

  it('pointerleave·blur로 끝난 누름은 정상 up으로 기록한다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerLeave(keyButton());
    expect(localStorage.getItem('keycap.pressed')).toBe('1');

    localStorage.removeItem('keycap.pressed');
    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.blur(keyButton());
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('이미지 드래그 금지: 스쿼시 래퍼가 자손 img의 -webkit-user-drag를 끈다', () => {
    renderKeycap();
    expect(squashTarget().className).toContain('[&_img]:[-webkit-user-drag:none]');
  });

  it('마운트 시 현재 축 소리를 미리 받아둔다 (warm)', () => {
    renderKeycap();
    expect(soundMock.warmKeycapSound).toHaveBeenCalledWith('brown');
  });

  it('음소거 저장 상태면 마운트 warm을 건너뛴다 (불필요한 fetch 없음)', () => {
    localStorage.setItem('keycap.muted', '1');
    renderKeycap();
    expect(soundMock.warmKeycapSound).not.toHaveBeenCalled();
  });

  it('탭(즉시 down→up)에도 릴리즈 애니메이션이 재생돼 눌림→복귀가 보인다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    // 트랜지션은 렌더 프레임이 없으면 생성되지 않으므로 키프레임으로 보장
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapRelease' });
    expect(squashTarget().className).not.toContain('keycapRelease');
  });

  it('pointercancel로 끝난 누름은 릴리즈를 재생하지 않는다 (스크롤 잔류 방지)', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerCancel(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
  });

  it('pointerleave·blur·Space 종료도 릴리즈를 재생한다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerLeave(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapRelease' });

    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.blur(keyButton());
    expect(squashTarget().className).toContain('keycapReleaseAlt_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapReleaseAlt' });

    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.keyUp(keyButton(), { key: ' ' });
    expect(squashTarget().className).toContain('keycapRelease_150ms');
  });

  it('연타: 릴리즈 진행 중 다음 탭은 다른 키프레임 이름으로 재시작된다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');

    // 애니메이션이 끝나기 전 두 번째 탭 — down 동안은 릴리즈가 꺼지고(스쿼시가 우선),
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
    // up에서 다른 이름으로 재생 → 같은 프레임에 갈아끼워져도 브라우저가 확실히 재시작
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapReleaseAlt_150ms');
  });

  it('animationEnd 분기: keycapNudge가 끝나도 릴리즈 상태를 건드리지 않는다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    // 다른 애니메이션의 end가 릴리즈를 끄면 안 된다
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapNudge' });
    expect(squashTarget().className).toContain('keycapRelease_150ms');
  });

  it('reduced-motion: 릴리즈 클래스가 붙지 않고 소리는 그대로 난다', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });
});
