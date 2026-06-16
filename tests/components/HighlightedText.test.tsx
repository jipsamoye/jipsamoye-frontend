import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HighlightedText from '@/components/common/HighlightedText';

/**
 * 강조 구간은 text-primary(메인 컬러) span 으로 감싼다.
 * 매칭 구간만 골라 검사하기 위해 그 클래스를 가진 span 을 쿼리한다.
 */
function highlighted(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('span.text-primary')).map(
    (el) => el.textContent ?? ''
  );
}

describe('HighlightedText', () => {
  it('keyword가 빈 문자열이면 text를 그대로 렌더하고 강조하지 않는다', () => {
    const { container } = render(<HighlightedText text="소금이맘" keyword="" />);
    expect(container.textContent).toBe('소금이맘');
    expect(highlighted(container)).toHaveLength(0);
  });

  it('keyword가 공백뿐이면 강조하지 않는다', () => {
    const { container } = render(<HighlightedText text="소금이맘" keyword="   " />);
    expect(container.textContent).toBe('소금이맘');
    expect(highlighted(container)).toHaveLength(0);
  });

  it('부분일치 구간만 메인 컬러로 감싼다', () => {
    const { container } = render(<HighlightedText text="소금이맘" keyword="소금" />);
    // 전체 텍스트는 보존
    expect(container.textContent).toBe('소금이맘');
    // "소금"만 강조
    expect(highlighted(container)).toEqual(['소금']);
  });

  it('한 텍스트 안의 모든 매칭 구간을 강조한다', () => {
    const { container } = render(<HighlightedText text="가나가나" keyword="가나" />);
    expect(container.textContent).toBe('가나가나');
    expect(highlighted(container)).toEqual(['가나', '가나']);
  });

  it('대소문자를 무시하고 매칭하되 원본 표기는 보존한다', () => {
    const { container } = render(<HighlightedText text="Cat Lover CAT" keyword="cat" />);
    expect(container.textContent).toBe('Cat Lover CAT');
    // 매칭은 대소문자 무시, 강조된 텍스트는 원본 그대로
    expect(highlighted(container)).toEqual(['Cat', 'CAT']);
  });

  it('정규식 특수문자(.)를 literal로 매칭한다 (와일드카드 아님)', () => {
    const { container } = render(<HighlightedText text="a.b axb" keyword="." />);
    // "." 은 임의 문자가 아니라 literal "." 만 매칭
    expect(highlighted(container)).toEqual(['.']);
  });

  it('정규식 특수문자(*)를 literal로 매칭한다', () => {
    const { container } = render(<HighlightedText text="2*3=6" keyword="*" />);
    expect(highlighted(container)).toEqual(['*']);
  });

  it('매칭이 없으면 텍스트를 그대로 렌더한다', () => {
    const { container } = render(<HighlightedText text="강아지" keyword="고양이" />);
    expect(container.textContent).toBe('강아지');
    expect(highlighted(container)).toHaveLength(0);
  });

  it('className을 외곽 span에 적용한다', () => {
    const { container } = render(
      <HighlightedText text="소금이맘" keyword="소금" className="truncate" />
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('truncate');
  });
});
