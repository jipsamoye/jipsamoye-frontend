import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import KeycapSwitchBar from '@/components/domain/KeycapSwitchBar';

const setup = (over: Partial<Parameters<typeof KeycapSwitchBar>[0]> = {}) => {
  const props = {
    selectedId: 'brown' as const,
    muted: false,
    onSelect: vi.fn(),
    onToggleMute: vi.fn(),
    ...over,
  };
  render(<KeycapSwitchBar {...props} />);
  return props;
};

describe('KeycapSwitchBar', () => {
  it('축 칩 7개를 확정 순서·라벨로 렌더하고 선택 칩에 aria-pressed를 준다', () => {
    setup({ selectedId: 'jade' });
    const labels = ['갈축', '청축', '적축', '네이비', '크림', '제이드', '흑축'];
    const chips = labels.map((l) => screen.getByRole('button', { name: l }));
    expect(chips).toHaveLength(7);
    expect(screen.getByRole('button', { name: '제이드' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '갈축' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('칩 클릭 시 onSelect(id)를 호출한다', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    expect(onSelect).toHaveBeenCalledWith('blue');
  });

  it('칩 줄은 가로 스크롤 없이 줄바꿈한다 (flex-wrap)', () => {
    setup();
    const chipRow = screen.getByRole('button', { name: '갈축' }).parentElement as HTMLElement;
    expect(chipRow.className).toContain('flex-wrap');
    expect(chipRow.className).not.toContain('overflow-x');
  });

  it('음소거 버튼: 소리 켜짐이면 "소리 끄기" 스피커+음파 SVG, 클릭 시 onToggleMute', () => {
    const { onToggleMute } = setup();
    const mute = screen.getByRole('button', { name: '소리 끄기' });
    // 이모지는 플랫폼 폰트에 따라 뭉개져 보여 SVG 아이콘으로 교체 (데코라 aria-hidden)
    expect(mute.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(mute);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('음소거 상태면 "소리 켜기" + aria-pressed, 빨간 X 변형 아이콘으로 바뀐다', () => {
    setup();
    const soundOn = screen.getByRole('button', { name: '소리 끄기' });
    // 소리 켜짐 상태엔 빨간 표시가 없어야 한다
    expect(soundOn.querySelector('.stroke-red-500')).toBeNull();
    cleanup();
    setup({ muted: true });
    const mute = screen.getByRole('button', { name: '소리 켜기' });
    expect(mute.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // 아이콘 전체를 가로지르는 굵은 빨간 X — 소리 안 남을 한눈에 알아볼 수 있게
    expect(mute.querySelector('path.stroke-red-500')).not.toBeNull();
    expect(mute).toHaveAttribute('aria-pressed', 'true');
  });
});
