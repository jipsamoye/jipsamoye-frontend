import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSharedFigurineImageUrl } from '@/lib/figurineShare';

/**
 * AI 키캡 결과 공유 페이지 — 로그인 없이 접근 가능해야 한다 (OG 크롤러 포함).
 * img 파라미터는 우리 CDN 이미지만 허용, 그 외는 404.
 */

interface FigurineSharePageProps {
  searchParams: Promise<{ img?: string | string[] }>;
}

const PAGE_TITLE = 'AI 키캡 피규어 — 집사모여';
const PAGE_DESCRIPTION = '우리 애 사진으로 만든 아티산 키캡 피규어를 구경해 보세요!';

export async function generateMetadata({ searchParams }: FigurineSharePageProps): Promise<Metadata> {
  const { img } = await searchParams;
  const imageUrl = getSharedFigurineImageUrl(img);
  if (!imageUrl) return { title: PAGE_TITLE };

  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      // 결과물은 항상 1024×1024 PNG (백엔드 스펙)
      images: [{ url: imageUrl, width: 1024, height: 1024 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [imageUrl],
    },
  };
}

export default async function FigurineSharePage({ searchParams }: FigurineSharePageProps) {
  const { img } = await searchParams;
  const imageUrl = getSharedFigurineImageUrl(img);
  if (!imageUrl) notFound();

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-gray-900">AI 키캡 피규어</h1>
      <p className="mt-2 text-sm text-gray-600">
        우리 애 사진을 올리면 아티산 키캡 위 미니 피규어로 만들어 드려요.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- 생성 직후 공유될 수 있어 Lambda 썸네일 없이 원본을 직접 표시 */}
      <img src={imageUrl} alt="AI 키캡 피규어" decoding="async" className="mt-6 w-full rounded-2xl" />
      <Link
        href="/figurines/new"
        className="block w-full mt-4 px-6 py-3 bg-amber-500 text-white rounded-xl text-base font-medium text-center hover:bg-amber-600 transition-all duration-200"
      >
        나도 만들어보기
      </Link>
    </div>
  );
}
