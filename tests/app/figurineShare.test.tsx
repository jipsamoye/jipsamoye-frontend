import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

import FigurineSharePage, { generateMetadata } from '@/app/figurines/share/page';

const VALID_IMG = 'https://images.jipsamoye.com/posts/8/result.png';

const props = (img?: string | string[]) => ({
  searchParams: Promise.resolve({ img }),
});

describe('FigurineSharePage', () => {
  it('유효한 img: 800 썸네일 이미지와 "나도 만들어보기" CTA를 렌더한다', async () => {
    render(await FigurineSharePage(props(VALID_IMG)));

    const image = screen.getByAltText('AI 키캡 피규어');
    expect(image).toHaveAttribute(
      'src',
      'https://images.jipsamoye.com/posts/8/thumbnails/result_800.webp',
    );

    const cta = screen.getByRole('link', { name: '나도 만들어보기' });
    expect(cta).toHaveAttribute('href', '/figurines/new');
  });

  it('썸네일 로드 실패 시 원본 이미지로 폴백한다', async () => {
    render(await FigurineSharePage(props(VALID_IMG)));

    fireEvent.error(screen.getByAltText('AI 키캡 피규어'));

    expect(screen.getByAltText('AI 키캡 피규어')).toHaveAttribute('src', VALID_IMG);
  });

  it('img 없음: notFound', async () => {
    await expect(FigurineSharePage(props(undefined))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('타 도메인 img: notFound', async () => {
    await expect(FigurineSharePage(props('https://evil.com/x.png'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('generateMetadata', () => {
  it('유효한 img: og:image와 트위터 카드에 결과 이미지를 넣는다', async () => {
    const metadata = await generateMetadata(props(VALID_IMG));

    expect(metadata.title).toBe('AI 키캡 피규어 — 집사모여');
    expect(metadata.openGraph?.images).toEqual([
      { url: VALID_IMG, width: 1024, height: 1024 },
    ]);
    expect(metadata.twitter?.images).toEqual([VALID_IMG]);
  });

  it('무효한 img: og:image 없이 제목만 반환한다 (크롤러에 외부 이미지 노출 금지)', async () => {
    const metadata = await generateMetadata(props('https://evil.com/x.png'));

    expect(metadata.title).toBe('AI 키캡 피규어 — 집사모여');
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });
});
