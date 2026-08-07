/**
 * PNG-in-ICO 인코더.
 *
 * ICO 안에 BMP 대신 PNG를 그대로 넣는 방식이다. Vista 이후 Windows,
 * 모든 모던 브라우저, 구글 파비콘 크롤러가 지원한다. 라이브러리 없이
 * 순수 Node Buffer 조작만으로 만들 수 있어 새 의존성이 필요 없다.
 *
 * 레이아웃 (전부 리틀엔디언):
 *   ICONDIR      6바이트     reserved=0, type=1, count=N
 *   ICONDIRENTRY 16바이트×N  width, height, colorCount, reserved,
 *                            planes, bitCount, bytesInRes, imageOffset
 *   PNG 블롭 N개
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const ICONDIR_SIZE = 6;
export const ICONDIRENTRY_SIZE = 16;

/**
 * @param {Buffer} buf
 * @returns {boolean}
 */
export function isPng(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

/**
 * @param {{ size: number, png: Buffer }[]} images
 * @returns {Buffer}
 */
export function encodeIco(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('encodeIco: 이미지가 최소 1개 필요합니다');
  }
  for (const { size, png } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`encodeIco: size는 1~256 정수여야 합니다 (받은 값: ${size})`);
    }
    if (!isPng(png)) {
      throw new Error(`encodeIco: ${size}px 항목이 PNG가 아닙니다`);
    }
  }

  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4); // count

  const directory = Buffer.alloc(ICONDIRENTRY_SIZE * images.length);
  let offset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * images.length;

  images.forEach(({ size, png }, index) => {
    const at = index * ICONDIRENTRY_SIZE;
    // ICO 스펙상 256px는 0으로 표현한다 (1바이트에 256이 안 들어감)
    const dimension = size === 256 ? 0 : size;
    directory.writeUInt8(dimension, at);
    directory.writeUInt8(dimension, at + 1);
    directory.writeUInt8(0, at + 2); // colorCount: 팔레트 없음
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // planes
    directory.writeUInt16LE(32, at + 6); // bitCount: RGBA
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}
