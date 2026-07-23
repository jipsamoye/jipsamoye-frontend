import { isResizableUrl } from './imageUrl';

/**
 * AI 키캡 결과 공유 URL 유틸.
 *
 * 공유 페이지(/figurines/share)는 img 쿼리 파라미터로 결과 이미지 URL을 받는다.
 * 잡 조회 API가 본인 전용(타인 403)이라 jobId 기반 공유가 불가능해,
 * 공개 CDN URL을 파라미터로 넘기는 방식을 쓴다 — 그래서 CDN 도메인 검증이 필수다.
 */

/**
 * 공유 페이지 img searchParam 검증.
 * https://images.jipsamoye.com/ 이미지만 통과, 그 외(타 도메인·http·배열·undefined)는 null.
 */
export function getSharedFigurineImageUrl(img: string | string[] | undefined): string | null {
  if (typeof img !== 'string') return null;
  return isResizableUrl(img) ? img : null;
}

/** 결과 화면 공유 버튼이 만드는 공유 페이지 URL. */
export function buildFigurineShareUrl(resultImageUrl: string, origin: string): string {
  return `${origin}/figurines/share?img=${encodeURIComponent(resultImageUrl)}`;
}
