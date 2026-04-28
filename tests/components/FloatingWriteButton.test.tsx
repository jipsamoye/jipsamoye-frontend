import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import FloatingWriteButton from '@/components/layout/FloatingWriteButton';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const mockPathname = (path: string) => {
  (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(path);
};

describe('FloatingWriteButton', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('경로별 노출 및 라벨', () => {
    it('홈(/)에서 자랑하기 라벨과 /posts/new 링크를 렌더한다', () => {
      mockPathname('/');
      const { container, getByText } = render(<FloatingWriteButton />);
      expect(container.firstChild).not.toBeNull();
      expect(getByText('자랑하기')).toBeInTheDocument();
      expect(container.querySelector('a')).toHaveAttribute('href', '/posts/new');
    });

    it('/board에서 글쓰기 라벨과 /board/new 링크를 렌더한다', () => {
      mockPathname('/board');
      const { getByText, container } = render(<FloatingWriteButton />);
      expect(getByText('글쓰기')).toBeInTheDocument();
      expect(container.querySelector('a')).toHaveAttribute('href', '/board/new');
    });

    it('/board/123에서도 글쓰기 라벨과 /board/new 링크를 렌더한다 (startsWith 매칭)', () => {
      mockPathname('/board/123');
      const { getByText, container } = render(<FloatingWriteButton />);
      expect(getByText('글쓰기')).toBeInTheDocument();
      expect(container.querySelector('a')).toHaveAttribute('href', '/board/new');
    });

    it.each(['/ranking', '/users/foo', '/posts/123', '/feed', '/liked', '/search'])(
      '%s 에서는 FAB을 렌더하지 않는다',
      (path) => {
        mockPathname(path);
        const { container } = render(<FloatingWriteButton />);
        expect(container.firstChild).toBeNull();
      }
    );
  });

  describe('폼 페이지 가드', () => {
    it.each(['/posts/new', '/board/new', '/posts/123/edit', '/board/123/edit'])(
      '%s 에서는 FAB을 렌더하지 않는다',
      (path) => {
        mockPathname(path);
        const { container } = render(<FloatingWriteButton />);
        expect(container.firstChild).toBeNull();
      }
    );
  });

  describe('스크롤 기반 확장/축소', () => {
    it('scrollY=0 마운트 시 라벨 span이 확장 상태(opacity-100)다', () => {
      mockPathname('/');
      const { getByText } = render(<FloatingWriteButton />);
      const span = getByText('자랑하기');
      expect(span.className).toContain('opacity-100');
    });

    it('scrollY=200 후 scroll 이벤트 발생 시 라벨 span이 축소 상태(opacity-0)가 된다', () => {
      mockPathname('/');
      const { getByText } = render(<FloatingWriteButton />);
      act(() => {
        Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 200 });
        fireEvent.scroll(window);
      });
      const span = getByText('자랑하기');
      expect(span.className).toContain('opacity-0');
    });

    it('scrollY=200 후 scrollY=0으로 돌아오면 다시 확장 상태(opacity-100)가 된다', () => {
      mockPathname('/');
      const { getByText } = render(<FloatingWriteButton />);
      act(() => {
        Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 200 });
        fireEvent.scroll(window);
      });
      act(() => {
        Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 });
        fireEvent.scroll(window);
      });
      const span = getByText('자랑하기');
      expect(span.className).toContain('opacity-100');
    });
  });
});
