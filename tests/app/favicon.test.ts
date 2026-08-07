import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
const layout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf-8');

const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;

/**
 * 파비콘은 브라우저 탭에 뜨는 브랜드 아이콘이다. 발바닥 이모지(🐾)는
 * 뭉개져 보인다는 피드백으로 '집사모여' 글씨 파비콘으로 교체됐다.
 * 발바닥이 다시 살아나지 않도록 회귀 방지.
 */
describe('favicon — 발바닥 대신 집사모여 글씨', () => {
  it('favicon.svg에 발바닥 이모지(🐾)가 없다', () => {
    expect(svg).not.toContain('🐾');
  });

  it('favicon.svg에 브랜드명 네 글자(집사/모여)가 모두 들어간다', () => {
    expect(svg).toContain('집사');
    expect(svg).toContain('모여');
  });

  it('배경색이 메인 브랜드 컬러(#ff734c)다 — 기본 amber(#f59e0b)로 되돌아가지 않는다', () => {
    // globals.css의 --color-primary / --color-amber-500 와 동일한 코랄색
    expect(svg.toLowerCase()).toContain('#ff734c');
    expect(svg.toLowerCase()).not.toContain('#f59e0b');
  });

  it('레거시 발바닥 경로(src/app/favicon.ico)가 부활하지 않는다', () => {
    // .ico는 public/에 둔다. src/app/에 두면 Next.js 파일 컨벤션이
    // 링크 태그를 중복 주입하고 레거시 경로가 되살아난 것처럼 보인다.
    expect(existsSync(path.join(root, 'src/app/favicon.ico'))).toBe(false);
  });
});

/**
 * 구글 파비콘 크롤러는 래스터 아이콘(특히 /favicon.ico)을 선호한다.
 * SVG만 있으면 검색결과에 옛 아이콘이 남을 수 있어 .ico를 함께 서빙한다.
 * 자산은 `npm run favicons`로 굽고 커밋된다.
 */
describe('favicon — 구글 검색결과용 래스터 자산', () => {
  const icoPath = path.join(root, 'public/favicon.ico');
  const applePath = path.join(root, 'public/apple-touch-icon.png');

  it('public/favicon.ico가 존재하고 ICO 매직넘버를 갖는다', () => {
    expect(existsSync(icoPath)).toBe(true);
    const ico = readFileSync(icoPath);
    expect([...ico.subarray(0, 4)]).toEqual([0x00, 0x00, 0x01, 0x00]);
  });

  it('favicon.ico가 16·32·48 멀티사이즈다 — 구글이 참조하는 건 48', () => {
    const ico = readFileSync(icoPath);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) =>
      ico.readUInt8(ICONDIR_SIZE + i * ICONDIRENTRY_SIZE)
    );
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
  });

  it('favicon.ico의 각 엔트리가 실제 PNG를 가리킨다', () => {
    const ico = readFileSync(icoPath);
    const count = ico.readUInt16LE(4);
    for (let i = 0; i < count; i += 1) {
      const at = ICONDIR_SIZE + i * ICONDIRENTRY_SIZE;
      const bytes = ico.readUInt32LE(at + 8);
      const offset = ico.readUInt32LE(at + 12);
      expect(offset + bytes).toBeLessThanOrEqual(ico.length);
      expect([...ico.subarray(offset, offset + 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it('public/apple-touch-icon.png가 존재하고 180x180 PNG다', () => {
    expect(existsSync(applePath)).toBe(true);
    const png = readFileSync(applePath);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // IHDR: 8바이트 시그니처 + 4바이트 길이 + 4바이트 타입 다음이 width/height
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});

/**
 * .ico를 먼저 선언해 구글이 확실히 집게 하고, .svg를 뒤에 남겨
 * 모던 브라우저 탭에서는 계속 벡터가 쓰이게 한다. 둘 다 필요하다.
 */
describe('favicon — layout 메타데이터', () => {
  it('layout이 /favicon.ico와 /favicon.svg를 둘 다 참조한다', () => {
    expect(layout).toContain('/favicon.ico');
    expect(layout).toContain('/favicon.svg');
  });

  it('구글이 참조하는 .ico를 .svg보다 먼저 선언한다', () => {
    expect(layout.indexOf('/favicon.ico')).toBeLessThan(layout.indexOf('/favicon.svg'));
  });

  it('layout이 apple-touch-icon을 참조한다', () => {
    expect(layout).toContain('/apple-touch-icon.png');
  });
});
