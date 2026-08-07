import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

  // 16px 프레임은 일부러 뺐다. 한글 4글자를 16px로 직접 렌더하면 판독 불가한
  // 얼룩이 된다. 구글은 48을, 2× 디스플레이 브라우저는 32를 쓰고, 16이 필요한
  // 소비자는 32/48을 다운스케일하는데 그쪽이 직접 렌더보다 낫다.
  it('favicon.ico가 32·48 멀티사이즈다 — 구글이 참조하는 건 48, 16은 의도적으로 뺐다', () => {
    const ico = readFileSync(icoPath);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) =>
      ico.readUInt8(ICONDIR_SIZE + i * ICONDIRENTRY_SIZE)
    );
    expect(sizes.sort((a, b) => a - b)).toEqual([32, 48]);
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
 * public/favicon.ico·apple-touch-icon.png는 `npm run favicons`로
 * public/favicon.svg를 래스터화해 커밋해둔 산출물이다. CI는 이 스크립트를
 * 실행하지 않으므로, 누군가 favicon.svg만 고치고 favicons를 다시 굽지
 * 않으면 위 자산 검증 테스트들은 여전히 통과하면서도(파일이 존재하고
 * 형식이 유효하니까) 탭 아이콘(.svg)과 구글 SERP/Safari 아이콘(.ico/.png)이
 * 조용히 서로 달라진다 — 이 브랜치가 고치려던 바로 그 종류의 버그다.
 * favicon.svg의 해시를 고정해 그 드리프트를 잡는다.
 */
describe('favicon — SVG/래스터 드리프트 감지', () => {
  it('favicon.svg가 바뀌면 실패한다 — npm run favicons로 자산을 다시 굽고 이 해시를 갱신할 것', () => {
    // Windows core.autocrlf=true에서 checkout 시 LF→CRLF로 변환되므로,
    // 플랫폼별 개행 문자 차이에 상관없이 동일한 해시를 유지하려면
    // 해시 전에 CRLF→LF로 정규화해야 한다.
    // (정규화 없으면 Windows에선 CRLF 해시, Linux/macOS에선 LF 해시로 달라져서
    //  CI에서 0 드리프트임에도 불구하고 거짓 양성 실패가 난다)
    const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
    const normalized = svg.replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(normalized).digest('hex');
    expect(hash).toBe('3ee0defe56601ac60647abf81c682ca32d604b2535401570a2bf3b10140b52d8');
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
