import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { KeycapIcon } from '@/components/layout/icons';

describe('KeycapIcon', () => {
  afterEach(cleanup);

  it('기본값은 nav 아이콘과 같은 w-5 h-5 아웃라인이다', () => {
    const { container } = render(<KeycapIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toBe('w-5 h-5');
    expect(svg?.getAttribute('fill')).toBe('none');
  });

  it('className으로 크기를 덮어쓸 수 있다', () => {
    const { container } = render(<KeycapIcon className="w-6 h-6" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('w-6 h-6');
  });

  it('filled는 면을 채우고 stroke를 쓰지 않는다', () => {
    const { container } = render(<KeycapIcon filled />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
    expect(svg?.getAttribute('stroke')).toBeNull();
  });

  it('아이소메트릭 키캡은 윗면·좌측면·우측면 3면으로 이뤄진다', () => {
    // 3/4 뷰의 입체감은 면 3개가 모두 있어야 성립한다.
    const outline = render(<KeycapIcon />);
    expect(outline.container.querySelectorAll('svg > path')).toHaveLength(3);
    cleanup();

    const solid = render(<KeycapIcon filled />);
    expect(solid.container.querySelectorAll('svg > path')).toHaveLength(3);
  });

  it('filled는 옆면 명도를 낮춰 입체를 표현한다', () => {
    const { container } = render(<KeycapIcon filled />);
    const paths = Array.from(container.querySelectorAll('svg > path'));
    const opacities = paths.map((p) => p.getAttribute('opacity'));
    // 윗면은 불투명, 옆면 2개는 반투명이어야 육면체가 평면으로 뭉개지지 않는다.
    expect(opacities.filter((o) => o === null)).toHaveLength(1);
    expect(opacities.filter((o) => o !== null)).toHaveLength(2);
  });
});
