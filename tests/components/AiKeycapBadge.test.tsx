import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AiKeycapBadge from '@/components/common/AiKeycapBadge';

describe('AiKeycapBadge', () => {
  it('"AI 키캡" 텍스트를 렌더한다', () => {
    const { getByText } = render(<AiKeycapBadge />);
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('className을 전달하면 기본 스타일에 병합된다 (위치 지정용)', () => {
    const { getByText } = render(<AiKeycapBadge className="absolute top-3 left-3" />);
    const badge = getByText('AI 키캡');
    expect(badge.className).toContain('absolute');
    expect(badge.className).toContain('rounded-full');
  });

  it('스크린리더가 배지 의미를 읽을 수 있다 (img role 아님, 텍스트 노출)', () => {
    const { getByText } = render(<AiKeycapBadge />);
    expect(getByText('AI 키캡').textContent).toBe('AI 키캡');
  });

  it('기본(size 미지정)은 고정 크기(text-sm)를 유지한다 — 상세 페이지용', () => {
    const { getByText } = render(<AiKeycapBadge />);
    const badge = getByText('AI 키캡');
    expect(badge.className).toContain('text-sm');
    expect(badge.className).not.toContain('text-xs');
  });

  it('size="sm"이면 모바일에서 축소되고 md 이상에서 기본 크기로 복귀한다 — 카드용', () => {
    const { getByText } = render(<AiKeycapBadge size="sm" />);
    const badge = getByText('AI 키캡');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('md:text-sm');
    expect(badge.className).toContain('px-2.5');
    expect(badge.className).toContain('md:px-4');
  });
});
