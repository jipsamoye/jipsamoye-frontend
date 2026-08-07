/**
 * 파비콘 SVG의 용도별 변형.
 */

/**
 * apple-touch-icon용 변형.
 *
 * iOS는 홈 화면 아이콘에 자체 마스크(둥근 모서리)를 씌운다. 원본 SVG의
 * rx를 그대로 두면 둥근 모서리가 두 번 적용되어 모서리가 투명하게 비친다.
 * rx를 제거해 꽉 찬 사각형으로 굽고, 라운딩은 iOS에 맡긴다.
 *
 * @param {string} svg
 * @returns {string}
 */
export function toAppleTouchSvg(svg) {
  return svg.replace(/\s+rx="[^"]*"/g, '');
}
