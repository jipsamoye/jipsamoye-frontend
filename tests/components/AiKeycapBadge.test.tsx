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
});
