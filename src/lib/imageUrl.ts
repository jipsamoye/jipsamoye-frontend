/**
 * Lambda 썸네일 URL 규칙 (백엔드 Lambda 스펙 기준):
 *   원본:   https://images.jipsamoye.com/{dirName}/{userId}/{uuid}.{ext}
 *   썸네일: https://images.jipsamoye.com/{dirName}/{userId}/thumbnails/{uuid}_{size}.webp
 *
 * Lambda 미지원 URL(외부 도메인, 잘못된 형태 등)은 원본 그대로 반환하여
 * onError fallback 없이도 안전하게 동작.
 */

const CDN_ORIGIN = 'https://images.jipsamoye.com/';

export type ThumbnailSize = 200 | 800;

export function isResizableUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith(CDN_ORIGIN);
}

export function toThumbnailUrl(url: string, size: ThumbnailSize): string {
  if (!isResizableUrl(url)) return url;
  return url.replace(/\/([^/]+)\.[^.]+$/, `/thumbnails/$1_${size}.webp`);
}

/** PostCard·PopularSlider 등 피드/그리드용 — 1x=200, 2x=800 */
export function buildSrcSet(url: string): string {
  return `${toThumbnailUrl(url, 200)} 200w, ${toThumbnailUrl(url, 800)} 800w`;
}
