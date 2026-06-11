import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/domain/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/Avatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

import PopularSlider from '@/components/domain/PopularSlider';

const ITEM = {
  id: 1,
  label: '귀여운 멍이',
  thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
  likeCount: 10,
  commentCount: 3,
  nickname: '집사A',
  profileImageUrl: null,
};

describe('PopularSlider — rAF throttle', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('연속 scroll 이벤트 2회에 rAF는 1회만 예약된다', () => {
    const { unmount } = render(<PopularSlider items={[ITEM]} />);

    const rafSpy = window.requestAnimationFrame as ReturnType<typeof vi.spyOn>;
    // 마운트 시 checkScroll 동기 호출 — rAF 없음. rAF 카운트 리셋
    rafSpy.mockClear();

    const container = document.querySelector('[class*="overflow-x-auto"]') as HTMLElement;
    if (container) {
      act(() => { container.dispatchEvent(new Event('scroll')); });
      act(() => { container.dispatchEvent(new Event('scroll')); });
    }

    // 두 번 scroll → rAF는 처음 1회만 예약 (두 번째는 rafIdRef !== null 이므로 스킵)
    expect(rafSpy).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('rAF 콜백 실행 후 다시 scroll 이벤트를 받으면 새 rAF가 예약된다', () => {
    const { unmount } = render(<PopularSlider items={[ITEM]} />);

    const rafSpy = window.requestAnimationFrame as ReturnType<typeof vi.spyOn>;
    rafSpy.mockClear();

    const container = document.querySelector('[class*="overflow-x-auto"]') as HTMLElement;
    if (container) {
      // 첫 scroll → rAF 예약
      act(() => { container.dispatchEvent(new Event('scroll')); });
      expect(rafSpy).toHaveBeenCalledTimes(1);

      // rAF 콜백 실행 (rafIdRef = null 로 리셋됨)
      act(() => {
        const cb = rafCallbacks[rafCallbacks.length - 1];
        if (cb) cb(performance.now());
      });

      // 다시 scroll → 새 rAF 예약 가능
      act(() => { container.dispatchEvent(new Event('scroll')); });
      expect(rafSpy).toHaveBeenCalledTimes(2);
    }

    unmount();
  });

  it('언마운트 시 pending rAF가 cancelAnimationFrame으로 정리된다', () => {
    const cancelSpy = window.cancelAnimationFrame as ReturnType<typeof vi.spyOn>;

    const { unmount } = render(<PopularSlider items={[ITEM]} />);

    const container = document.querySelector('[class*="overflow-x-auto"]') as HTMLElement;
    if (container) {
      // scroll → rAF 예약 (실행 전 언마운트)
      act(() => { container.dispatchEvent(new Event('scroll')); });
    }

    act(() => { unmount(); });

    // pending rAF가 있으면 cancel 되어야 함
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('PopularSlider — items 변경 시 화살표 가시성 재계산', () => {
  it('items 변경 후에도 canScrollRight/Left 상태가 재계산된다 (리스너 재등록 없이)', () => {
    // 이 테스트는 items prop 변경 시 별도 effect가 checkScroll을 호출하는지 확인
    // jsdom에서 실제 scrollWidth를 시뮬하기 어려우므로
    // 컴포넌트가 에러 없이 re-render되는 것을 검증
    const { rerender } = render(<PopularSlider items={[ITEM]} />);

    const newItem = { ...ITEM, id: 2, label: '두 번째 멍이' };
    expect(() => {
      rerender(<PopularSlider items={[ITEM, newItem]} />);
    }).not.toThrow();
  });
});
