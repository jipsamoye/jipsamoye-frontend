import { describe, it, expect } from 'vitest';
// @ts-expect-error - .mjs 스크립트 헬퍼에는 타입 선언이 없다 (tsconfig에서 tests는 제외됨)
import { encodeIco, isPng, ICONDIR_SIZE, ICONDIRENTRY_SIZE } from '../../scripts/lib/ico.mjs';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 최소한의 가짜 PNG — 시그니처만 맞고 길이가 다른 버퍼 */
function fakePng(length: number): Buffer {
  const buf = Buffer.alloc(length, 0x7f);
  PNG_SIG.copy(buf, 0);
  return buf;
}

describe('encodeIco — PNG-in-ICO 인코더', () => {
  it('ICO 매직넘버(00 00 01 00)와 이미지 개수를 헤더에 쓴다', () => {
    const ico = encodeIco([
      { size: 16, png: fakePng(100) },
      { size: 32, png: fakePng(200) },
      { size: 48, png: fakePng(300) },
    ]);
    expect([...ico.subarray(0, 4)]).toEqual([0x00, 0x00, 0x01, 0x00]);
    expect(ico.readUInt16LE(4)).toBe(3);
  });

  it('디렉터리 엔트리에 16·32·48 크기를 기록한다', () => {
    const ico = encodeIco([
      { size: 16, png: fakePng(100) },
      { size: 32, png: fakePng(200) },
      { size: 48, png: fakePng(300) },
    ]);
    const sizes = [0, 1, 2].map((i) => {
      const at = ICONDIR_SIZE + i * ICONDIRENTRY_SIZE;
      return [ico.readUInt8(at), ico.readUInt8(at + 1)];
    });
    expect(sizes).toEqual([[16, 16], [32, 32], [48, 48]]);
  });

  it('planes=1, bitCount=32, colorCount/reserved=0으로 쓴다', () => {
    const ico = encodeIco([{ size: 48, png: fakePng(100) }]);
    expect(ico.readUInt8(ICONDIR_SIZE + 2)).toBe(0);
    expect(ico.readUInt8(ICONDIR_SIZE + 3)).toBe(0);
    expect(ico.readUInt16LE(ICONDIR_SIZE + 4)).toBe(1);
    expect(ico.readUInt16LE(ICONDIR_SIZE + 6)).toBe(32);
  });

  it('bytesInRes/imageOffset이 정확해 해당 위치에서 PNG가 시작된다', () => {
    const pngs = [fakePng(100), fakePng(200), fakePng(300)];
    const ico = encodeIco([
      { size: 16, png: pngs[0] },
      { size: 32, png: pngs[1] },
      { size: 48, png: pngs[2] },
    ]);
    let expectedOffset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * 3;
    pngs.forEach((png, i) => {
      const at = ICONDIR_SIZE + i * ICONDIRENTRY_SIZE;
      expect(ico.readUInt32LE(at + 8)).toBe(png.length);
      expect(ico.readUInt32LE(at + 12)).toBe(expectedOffset);
      expect(ico.subarray(expectedOffset, expectedOffset + 8)).toEqual(PNG_SIG);
      expectedOffset += png.length;
    });
    expect(ico.length).toBe(expectedOffset);
  });

  it('256px는 width/height 바이트에 0으로 기록한다 (ICO 스펙)', () => {
    const ico = encodeIco([{ size: 256, png: fakePng(100) }]);
    expect(ico.readUInt8(ICONDIR_SIZE)).toBe(0);
    expect(ico.readUInt8(ICONDIR_SIZE + 1)).toBe(0);
  });

  it('빈 배열이면 던진다', () => {
    expect(() => encodeIco([])).toThrow(/최소 1개/);
  });

  it('PNG 시그니처가 아닌 버퍼면 던진다', () => {
    expect(() => encodeIco([{ size: 48, png: Buffer.alloc(100) }])).toThrow(/PNG가 아닙니다/);
  });

  it('size가 1~256 범위를 벗어나면 던진다', () => {
    expect(() => encodeIco([{ size: 257, png: fakePng(100) }])).toThrow(/1~256/);
    expect(() => encodeIco([{ size: 0, png: fakePng(100) }])).toThrow(/1~256/);
  });

  it('isPng은 시그니처로만 판정한다', () => {
    expect(isPng(fakePng(20))).toBe(true);
    expect(isPng(Buffer.alloc(20))).toBe(false);
    expect(isPng(Buffer.alloc(3))).toBe(false);
  });
});
