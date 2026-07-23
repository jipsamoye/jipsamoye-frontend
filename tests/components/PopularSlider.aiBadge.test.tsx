import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const baseItem = {
  id: 1,
  label: '귀여운 멍이',
  thumbnailUrl: 'https://images.jipsamoye.com/posts/1/abc.webp',
  likeCount: 10,
  commentCount: 3,
  nickname: '집사A',
  profileImageUrl: null,
};

describe('PopularSlider — AI 키캡 배지', () => {
  it('aiGenerated=true 아이템이면 "AI 키캡" 배지를 렌더한다', () => {
    const { getByText } = render(
      <PopularSlider items={[{ ...baseItem, aiGenerated: true }]} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('label이 "AI 키캡 자랑"이면 (플래그 없이도) 배지를 렌더한다', () => {
    const { getByText } = render(
      <PopularSlider items={[{ ...baseItem, label: 'AI 키캡 자랑' }]} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('일반 아이템에는 배지를 렌더하지 않는다', () => {
    const { queryByText } = render(<PopularSlider items={[baseItem]} />);
    expect(queryByText('AI 키캡')).toBeNull();
  });

  it('썸네일 없는(플레이스홀더) AI 아이템에도 배지를 렌더한다', () => {
    const { getByText } = render(
      <PopularSlider items={[{ ...baseItem, thumbnailUrl: null, aiGenerated: true }]} />
    );
    expect(getByText('AI 키캡')).toBeInTheDocument();
  });

  it('슬라이더 배지는 모바일 축소 사이즈(size="sm")로 렌더된다', () => {
    const { getByText } = render(
      <PopularSlider items={[{ ...baseItem, aiGenerated: true }]} />
    );
    const badge = getByText('AI 키캡');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('md:text-sm');
    expect(badge.className).toContain('top-2');
    expect(badge.className).toContain('md:top-3');
  });

  it('홈(page.tsx)의 popularSliderItems 매핑이 aiGenerated를 전달한다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/page.tsx'),
      'utf-8'
    );
    const mapping = source.slice(source.indexOf('popularSliderItems'));
    expect(mapping.slice(0, mapping.indexOf('}))'))).toContain('aiGenerated');
  });
});
