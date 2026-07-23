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

  it('label을 전달하면 해당 텍스트를 렌더한다 — 사이드바 "신규" 뱃지용', () => {
    const { getByText, queryByText } = render(<AiKeycapBadge label="신규" />);
    expect(getByText('신규')).toBeInTheDocument();
    expect(queryByText('AI 키캡')).not.toBeInTheDocument();
  });

  it('label을 바꿔도 그라데이션 디자인은 동일하게 유지된다', () => {
    const { getByText } = render(<AiKeycapBadge label="신규" />);
    const badge = getByText('신규');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('from-amber-500');
    expect(badge.className).toContain('font-extrabold');
  });

  it('size="xs"이면 메뉴 텍스트 옆에 어울리는 고정 소형 크기를 쓴다 — 사이드바용', () => {
    const { getByText } = render(<AiKeycapBadge size="xs" label="신규" />);
    const badge = getByText('신규');
    expect(badge.className).toContain('text-[10px]');
    expect(badge.className).not.toContain('md:text-sm');
  });

  it('floating이면 둥둥 뜨는 애니메이션을 단다 (모션 축소 설정 사용자는 제외)', () => {
    const { getByText } = render(<AiKeycapBadge label="신규" floating />);
    expect(getByText('신규').className).toContain('motion-safe:animate-[badgeFloat');
  });

  it('floating 미지정이면 애니메이션이 없다 — 카드/상세 뱃지는 정적', () => {
    const { getByText } = render(<AiKeycapBadge label="신규" />);
    expect(getByText('신규').className).not.toContain('animate-');
  });
});
