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
 * 이 10~40% 밴드는 위 값 하나(Windows, Malgun Gothic)로만 보정됐다. macOS의
 * Apple SD Gothic Neo 등 다른 한글 폰트는 획 굵기가 달라 실측값이 달라질 수
 * 있다 — 다른 환경에서 이 밴드를 벗어나는 실패가 난다면 밴드 자체를 넓혀야
 * 할 수도 있다.
 *
 * 한계: 이 가드는 "글자가 아예 안 그려짐"과 "전부 흰색"처럼 확실히 잘못된
 * 경우는 잡지만, 두부(□□) 감지는 best-effort라 100% 잡아내지 못한다.
 * `git diff`는 바이너리 파일(.ico/.png)에 대해 "Binary files differ"만
 * 보여줄 뿐 내용을 보여주지 않으므로 방어선이 되지 못한다. 최종 방어선은
 * 사람이 생성된 PNG를 직접 열어 눈으로 확인하는 것이다.
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
        `한글 폰트가 없는 환경일 수도 있고, 폰트는 있지만 획 굵기가 달라 ` +
        `(이 밴드는 Windows/Malgun Gothic 실측 기준) 벗어났을 수도 있습니다 — ` +
        `scripts/generate-favicons.mjs 상단 주석 참고.`
    );
  }
  return ratio;
}
