/**
 * 렌더 결과에 글자가 실제로 그려졌는지 픽셀 통계로 검증한다.
 *
 * 왜 픽셀을 세는가: 한글 폰트가 없는 환경에서 구우면 글자가 사라지거나
 * 두부(□)가 된다. document.fonts.check()는 존재하지 않는 폰트명에도
 * true를 반환하는 것이 실측으로 확인되어 가드로 쓸 수 없다.
 *
 * 실측 정상값(Windows / Malgun Gothic):
 *   16px 25.8% · 32px 20.5% · 48px 22.0% · 180px 22.4%
 *
 * 한계: "글자 없음"과 "전부 흰색"은 잡지만 두부(□□)를 100% 잡지는
 * 못한다. 최종 방어선은 산출물이 커밋되어 git diff로 사람이 보는 것.
 */

export const MIN_GLYPH_RATIO = 0.1;
export const MAX_GLYPH_RATIO = 0.4;

/**
 * @param {{ size: number, opaque: number, white: number }} stats
 * @returns {number} 흰색 픽셀 비율
 */
export function assertGlyphCoverage({ size, opaque, white }) {
  if (opaque === 0) {
    throw new Error(`${size}px: 렌더 결과가 전부 투명합니다 — SVG가 그려지지 않았습니다`);
  }
  const ratio = white / opaque;
  if (ratio < MIN_GLYPH_RATIO || ratio > MAX_GLYPH_RATIO) {
    throw new Error(
      `${size}px: 글자 픽셀 비율이 ${(ratio * 100).toFixed(1)}% 로 정상 범위` +
        `(${MIN_GLYPH_RATIO * 100}~${MAX_GLYPH_RATIO * 100}%)를 벗어났습니다. ` +
        `한글 폰트가 없는 환경일 수 있습니다 — scripts/generate-favicons.mjs 상단 주석 참고.`
    );
  }
  return ratio;
}
