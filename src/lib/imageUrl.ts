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

/**
 * PostCard·PopularSlider 등 피드/그리드용 srcset 생성.
 *
 * 선언 폭을 세로(3:4) 사진 worst-case 실폭으로 보수적으로 선언한다.
 *   Lambda는 긴 변 기준 리사이즈 → 세로 사진(3:4)의 실폭 = size × 0.75
 *     _200.webp 실폭: 200 × 0.75 = 150px
 *     _800.webp 실폭: 800 × 0.75 = 600px
 *
 * 카드가 정사각 object-cover crop이라 폭이 병목이므로,
 * worst-case 폭으로 선언해야 어떤 비율의 사진도 업스케일로 흐려지지 않는다.
 * (가로 사진은 약간 일찍 800을 받게 되지만 비용 미미 — 안전한 방향.)
 *
 * 한계: 800 썸네일(세로 실폭 600px)이 현재 최대 후보라서, 1열 모바일 DPR2(필요 ~686px)나
 * 초광폭 데스크톱에서 세로 사진에 ~1.1–1.3배 업스케일이 남는다.
 * Lambda에 1200 사이즈 추가 시 900w 후보를 srcset에 넣어 해결 가능.
 */
export function buildSrcSet(url: string): string {
  return `${toThumbnailUrl(url, 200)} 150w, ${toThumbnailUrl(url, 800)} 600w`;
}
