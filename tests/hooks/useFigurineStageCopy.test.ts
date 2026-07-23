import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFigurineStageCopy, FIGURINE_STAGES } from '@/hooks/useFigurineStageCopy';

const T0 = 1_700_000_000_000;

/**
 * T0 기준 sec초 경과 시점까지 타이머를 흘린다.
 * fake timer는 advanceTimersByTime이 Date.now()도 함께 밀므로 델타만 진행시킨다.
 */
const advanceTo = (sec: number) => {
  act(() => {
    const delta = T0 + sec * 1000 - Date.now();
    if (delta > 0) vi.advanceTimersByTime(delta);
  });
};

describe('useFigurineStageCopy — 경과 시간 기반 단계 카피', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('시작 직후엔 analyzing 단계다', () => {
    const { result } = renderHook(() => useFigurineStageCopy(T0));
    expect(result.current.stage).toBe('analyzing');
    expect(result.current.line).toBe('사진에서 우리 애를 찾고 있어요');
  });

  it('8/22/40/60초 경계에서 각 단계로 전환된다', () => {
    const { result } = renderHook(() => useFigurineStageCopy(T0));

    advanceTo(8);
    expect(result.current.stage).toBe('sculpting');

    advanceTo(22);
    expect(result.current.stage).toBe('casting');

    advanceTo(40);
    expect(result.current.stage).toBe('polishing');

    advanceTo(60);
    expect(result.current.stage).toBe('overtime');
  });

  it('경계 직전 1초는 이전 단계에 머문다 (7초는 analyzing)', () => {
    const { result } = renderHook(() => useFigurineStageCopy(T0));
    advanceTo(7);
    expect(result.current.stage).toBe('analyzing');
  });

  it('60초 이후 300초까지 overtime에 머문다 (그 위 단계 없음)', () => {
    const { result } = renderHook(() => useFigurineStageCopy(T0));
    advanceTo(300);
    expect(result.current.stage).toBe('overtime');
    expect(result.current.line).toBe('거의 다 왔어요. 조금만 더 기다려 주세요');
  });

  it('60초를 넘으면 보조 문구가 "더 걸릴 수 있어요"로 바뀐다', () => {
    const { result } = renderHook(() => useFigurineStageCopy(T0));
    expect(result.current.hint).toBe('보통 1분 안에 완성돼요');

    advanceTo(60);
    expect(result.current.hint).toBe('사진에 따라 더 걸릴 수 있어요');
  });

  it('startedAt이 과거면 마운트 즉시 해당 단계로 시작한다 (첫 tick을 기다리지 않음)', () => {
    vi.setSystemTime(T0 + 45_000);
    const { result } = renderHook(() => useFigurineStageCopy(T0));
    expect(result.current.stage).toBe('polishing');
  });

  it('startedAt이 바뀌면 다음 tick을 기다리지 않고 즉시 analyzing으로 되돌아간다', () => {
    const { result, rerender } = renderHook(({ at }) => useFigurineStageCopy(at), {
      initialProps: { at: T0 },
    });
    advanceTo(45);
    expect(result.current.stage).toBe('polishing');

    // 다시 만들기 — 기준 시각이 지금으로 갱신된다
    const restartedAt = Date.now();
    rerender({ at: restartedAt });
    expect(result.current.stage).toBe('analyzing');
    expect(result.current.elapsedSec).toBe(0);
  });

  it('언마운트 후에는 인터벌이 더 이상 실행되지 않는다', () => {
    const { unmount } = renderHook(() => useFigurineStageCopy(T0));
    unmount();
    // 살아있는 타이머가 없어야 한다
    expect(vi.getTimerCount()).toBe(0);
  });

  it('단계 정의는 퍼센트 문구를 포함하지 않는다 (서버가 진행률을 주지 않음)', () => {
    for (const s of FIGURINE_STAGES) {
      expect(s.line).not.toContain('%');
    }
  });
});
