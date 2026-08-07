# 구글 검색결과 파비콘 교체 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `public/favicon.svg`를 래스터로 구워 `public/favicon.ico`(16/32/48)와 `public/apple-touch-icon.png`(180×180)를 만들고, `layout.tsx` 메타데이터에 연결해 구글 파비콘 크롤러가 현재 브랜드 아이콘을 수집할 수 있게 한다.

**Architecture:** 순수 함수 3개(ICO 인코더 / SVG 변형 / 글자 커버리지 검증)를 `scripts/lib/`에 두고 각각 단위 테스트한다. `scripts/generate-favicons.mjs`가 puppeteer로 SVG를 렌더해 이 순수 함수들을 조합, `public/`에 자산을 굽는다. 자산은 git에 커밋되므로 CI/Vercel은 스크립트를 실행하지 않는다.

**Tech Stack:** Node 24 (ESM `.mjs`), puppeteer ^24.42.0 (기존 devDependency), vitest ^3.2.4, Next.js 16.2.3 Metadata API

## Context

구글에서 `jipsamoye.com`을 검색하면 결과 옆 아이콘이 커밋 `2bfb238` 이전의 **옛날 🐾 발바닥**으로 나온다. 브라우저 탭은 코랄색 "집사모여" 글씨가 정상 표시된다. 사용자는 **탭 아이콘이 정답이고 구글 쪽을 거기에 맞춘다**고 확정했다.

실측 결과 `https://www.jipsamoye.com/favicon.ico`는 **404**이고, 서빙되는 HTML `<head>`에는 `<link rel="icon" href="/favicon.svg"/>` 하나뿐이다.

> **원인 진단의 정확한 수위(중요 — 사용자 보고 시 이 표현을 쓸 것):**
> 핸드오프 문서는 "구글이 `/favicon.ico`를 우선 조회하는데 404라서 못 가져간다"고 단정했지만, 구글 Search Central은 ICO/PNG/GIF/JPEG/**SVG**를 모두 지원 형식으로 명시한다. 즉 SVG만 있어도 원리상 수집은 가능하다. 지배적 원인은 **재크롤링 지연**일 가능성이 크다.
> 그래도 `/favicon.ico` 404는 명백한 구멍이고 표준 관행 이탈이므로 메우는 게 맞다. 다만 이 작업은 **"원인 제거"가 아니라 "수집 확률을 높이는 조치"** 로 설명해야 한다.

부수 효과로, 현재 SVG는 `<text>` + 시스템 한글 폰트에 의존해 폰트 없는 렌더링 환경에서 두부(□□)로 깨지는데, 래스터로 구워두면 크롤러 쪽에서는 이 문제가 사라진다.

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다.

- **새 npm 의존성 추가 금지.** puppeteer는 이미 devDependency(`^24.42.0`)에 있다. ICO 인코딩은 순수 Node로 직접 구현한다.
- **범위는 `favicon.ico` + `apple-touch-icon.png` 까지.** `manifest.webmanifest`, `icon-192.png`, `icon-512.png`는 **하지 않는다**(PWA 아님, YAGNI로 사용자와 합의됨).
- **아이콘 디자인을 바꾸지 않는다.** 4글자("집사"/"모여") 그대로 래스터화한다. 16px에서 뭉개질 수 있음은 사용자에게 이미 고지됐고 **"실물 확인 후 결정"** 으로 정해졌다 — **사전에 재디자인하지 말 것.**
- **`public/favicon.svg`는 수정 금지.** 탭에서는 계속 벡터가 쓰여야 한다.
- **`.ico`는 반드시 `public/`에.** `src/app/favicon.ico`를 만들면 Next.js 파일 컨벤션이 링크 태그를 중복 주입하고, 레거시 발바닥 경로가 부활한 것처럼 보인다.
- **`any` 사용 금지** (CLAUDE.md).
- **테스트 없이 커밋 금지** (CLAUDE.md). 각 태스크는 자체 테스트 사이클로 끝난다.
- **push 전 `npx next build`가 "Generating static pages"까지 통과해야 한다** (CLAUDE.md).
- 브랜치는 `feature/*` → main PR. **이 레포에 develop 브랜치는 없다.**
- 작업 브랜치: `worktree-feature+favicon-google-serp` (워크트리 `.claude/worktrees/feature+favicon-google-serp`).

### 실측 기준값 (계획 수립 중 이 워크트리에서 직접 측정)

| 항목 | 값 |
|---|---|
| 렌더 흰색(글자) 픽셀 비율 | 16px 25.8% / 32px 20.5% / 48px 22.0% / 180px 22.4% |
| PNG 크기 | 16px 618B / 32px 771B / 48px 1359B / 180px 3551B |
| `rx` 제거 후 180px 불투명 픽셀 | 32400 = 180×180 (**full-bleed 확인**) |
| `document.fonts.check()` | **가짜 폰트명에도 `true` 반환 — 폰트 가드로 쓸 수 없음** |
| baseline 테스트 | 85 files / 748 tests 전부 통과 |
| puppeteer Chrome | `win64-147.0.7727.57` 캐시 존재, 재다운로드 불필요 |

---

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/lib/ico.mjs` (생성) | PNG 버퍼 배열 → ICO 바이너리. 순수 함수, I/O 없음 |
| `scripts/lib/svg-variants.mjs` (생성) | apple-touch-icon용 SVG 변형(`rx` 제거). 순수 함수 |
| `scripts/lib/glyph-coverage.mjs` (생성) | 렌더 픽셀 통계로 글자 누락 감지. 순수 함수 |
| `scripts/generate-favicons.mjs` (생성) | puppeteer 렌더 + 위 3개 조합 + 파일 쓰기. 유일한 부수효과 지점 |
| `public/favicon.ico` (생성, 바이너리) | 16/32/48 멀티사이즈 산출물 |
| `public/apple-touch-icon.png` (생성, 바이너리) | 180×180 산출물 |
| `src/app/layout.tsx` (수정, 16-18행) | `icons` 메타데이터 확장 |
| `package.json` (수정, scripts) | `"favicons"` 실행 스크립트 |
| `tests/scripts/ico.test.ts` (생성) | ICO 인코더 단위 테스트 |
| `tests/scripts/svg-variants.test.ts` (생성) | SVG 변형 단위 테스트 |
| `tests/scripts/glyph-coverage.test.ts` (생성) | 커버리지 가드 단위 테스트 |
| `tests/app/favicon.test.ts` (수정) | 회귀 방지 + 산출물/메타데이터 검증 |
| `.gitignore` (수정) | `.claude/worktrees/` 무시 |

**참고:** `tsconfig.json`의 `exclude`에 `"tests"`가 있어서 테스트에서 `.mjs`를 import해도 `npx next build`의 타입체크에 영향이 없다. `include`에도 `**/*.mjs`가 없어 `scripts/`는 타입체크 대상이 아니다.

---

### Task 1: ICO 인코더

**Files:**
- Create: `scripts/lib/ico.mjs`
- Test: `tests/scripts/ico.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `isPng(buf: Buffer): boolean`
  - `encodeIco(images: { size: number, png: Buffer }[]): Buffer`
  - 상수 `ICONDIR_SIZE = 6`, `ICONDIRENTRY_SIZE = 16`

ICO 바이너리 레이아웃 (전부 리틀엔디언):

```
ICONDIR      6바이트     reserved=0(u16), type=1(u16), count=N(u16)
ICONDIRENTRY 16바이트×N  width(u8), height(u8), colorCount=0(u8), reserved=0(u8),
                        planes=1(u16), bitCount=32(u16),
                        bytesInRes(u32), imageOffset(u32)
PNG 블롭 N개             첫 블롭 offset = 6 + 16*N
```

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scripts/ico.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/scripts/ico.test.ts`
Expected: FAIL — `Failed to load ../../scripts/lib/ico.mjs` (파일 없음)

- [ ] **Step 3: 최소 구현 작성**

`scripts/lib/ico.mjs`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/scripts/ico.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/ico.mjs tests/scripts/ico.test.ts
git commit -m "feat(favicon): 의존성 없는 PNG-in-ICO 인코더 추가"
```

---

### Task 2: SVG 변형 + 글자 커버리지 가드

**Files:**
- Create: `scripts/lib/svg-variants.mjs`
- Create: `scripts/lib/glyph-coverage.mjs`
- Test: `tests/scripts/svg-variants.test.ts`
- Test: `tests/scripts/glyph-coverage.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `toAppleTouchSvg(svg: string): string`
  - `assertGlyphCoverage({ size: number, opaque: number, white: number }): number` — 비율 반환, 벗어나면 throw
  - 상수 `MIN_GLYPH_RATIO = 0.10`, `MAX_GLYPH_RATIO = 0.40`

**왜 필요한가:**

1. `toAppleTouchSvg` — 원본 SVG는 `rx="22"` 둥근 모서리를 가진다. 그대로 180px로 구우면 모서리가 투명해지는데, iOS는 홈 화면 아이콘에 **자체 마스크를 한 번 더** 씌운다. 이중 라운딩 + 모서리 비침이 생기므로 apple-touch-icon만 `rx`를 빼고 꽉 찬 사각형으로 굽는다. (실측: `rx` 제거 시 180×180 = 32400px 전부 불투명)
2. `assertGlyphCoverage` — 한글 폰트가 없는 환경에서 구우면 글자가 사라지거나 두부(□)가 된다. `document.fonts.check()`는 **가짜 폰트명에도 `true`를 반환해 가드로 쓸 수 없음이 실측으로 확인됐다.** 대신 렌더 결과의 흰색(글자색) 픽셀 비율을 본다. 실측 정상값은 20.5~25.8%이므로 10~40% 밖이면 실패시킨다.
   > 정직하게 적어둘 한계: 이 가드는 "글자가 아예 안 그려짐"과 "전부 흰색"은 잡지만, **두부(□□)를 100% 잡아내지는 못한다.** 최종 방어선은 산출물이 git에 커밋되어 `git diff`로 사람이 변화를 보게 되는 것이다.

- [ ] **Step 1: 실패하는 테스트 작성 (2개 파일)**

`tests/scripts/svg-variants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error - .mjs 스크립트 헬퍼에는 타입 선언이 없다
import { toAppleTouchSvg } from '../../scripts/lib/svg-variants.mjs';

const root = path.resolve(__dirname, '../..');
const original = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');

describe('toAppleTouchSvg — iOS 이중 라운딩 방지', () => {
  it('rx 속성을 제거해 꽉 찬 사각형으로 만든다', () => {
    expect(original).toContain('rx=');
    expect(toAppleTouchSvg(original)).not.toContain('rx=');
  });

  it('브랜드 요소(색·글자)는 그대로 보존한다', () => {
    const result = toAppleTouchSvg(original);
    expect(result.toLowerCase()).toContain('#ff734c');
    expect(result).toContain('집사');
    expect(result).toContain('모여');
    expect(result).toContain('<svg');
  });

  it('rx가 없는 입력에는 멱등이다', () => {
    const once = toAppleTouchSvg(original);
    expect(toAppleTouchSvg(once)).toBe(once);
  });

  it('원본 문자열을 변형하지 않는다', () => {
    const before = original;
    toAppleTouchSvg(original);
    expect(original).toBe(before);
  });
});
```

`tests/scripts/glyph-coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
// @ts-expect-error - .mjs 스크립트 헬퍼에는 타입 선언이 없다
import { assertGlyphCoverage, MIN_GLYPH_RATIO, MAX_GLYPH_RATIO } from '../../scripts/lib/glyph-coverage.mjs';

describe('assertGlyphCoverage — 한글 글자 누락 감지', () => {
  // 이 워크트리에서 실제로 측정한 값
  it.each([
    [16, 252, 65],
    [32, 992, 203],
    [48, 2236, 492],
    [180, 32400, 7249],
  ])('정상 렌더(%ipx)는 통과한다', (size, opaque, white) => {
    const ratio = assertGlyphCoverage({ size, opaque, white });
    expect(ratio).toBeGreaterThan(MIN_GLYPH_RATIO);
    expect(ratio).toBeLessThan(MAX_GLYPH_RATIO);
  });

  it('글자가 하나도 안 그려지면 던진다', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 2236, white: 0 })).toThrow(/한글 폰트/);
  });

  it('전부 흰색이면 던진다 (배경이 안 그려진 경우)', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 2236, white: 2236 })).toThrow(/한글 폰트/);
  });

  it('전부 투명하면 별도 메시지로 던진다', () => {
    expect(() => assertGlyphCoverage({ size: 48, opaque: 0, white: 0 })).toThrow(/전부 투명/);
  });

  it('에러 메시지에 크기와 실제 비율을 담는다', () => {
    expect(() => assertGlyphCoverage({ size: 32, opaque: 1000, white: 10 })).toThrow(/32px.*1\.0%/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/scripts/svg-variants.test.ts tests/scripts/glyph-coverage.test.ts`
Expected: FAIL — 두 모듈 모두 로드 실패

- [ ] **Step 3: 최소 구현 작성 (2개 파일)**

`scripts/lib/svg-variants.mjs`:

```js
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
```

`scripts/lib/glyph-coverage.mjs`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/scripts/svg-variants.test.ts tests/scripts/glyph-coverage.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/svg-variants.mjs scripts/lib/glyph-coverage.mjs tests/scripts/svg-variants.test.ts tests/scripts/glyph-coverage.test.ts
git commit -m "feat(favicon): apple-touch SVG 변형·글자 커버리지 가드 추가"
```

---

### Task 3: 생성 스크립트 + 자산 굽기

**Files:**
- Create: `scripts/generate-favicons.mjs`
- Create (바이너리 산출물): `public/favicon.ico`, `public/apple-touch-icon.png`
- Modify: `package.json` (scripts 블록)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `encodeIco` (Task 1), `toAppleTouchSvg` / `assertGlyphCoverage` (Task 2)
- Produces: `npm run favicons` 명령과 `public/favicon.ico`, `public/apple-touch-icon.png` 두 파일. Task 4의 테스트가 이 파일들의 존재를 전제한다.

> **이 태스크만 puppeteer를 쓴다.** 순수 함수는 Task 1·2에서 이미 단위 테스트했으므로, 여기서는 실제로 구운 산출물을 Task 4의 테스트가 검증하는 구조다.

- [ ] **Step 1: 생성 스크립트 작성**

`scripts/generate-favicons.mjs`:

```js
#!/usr/bin/env node
/**
 * public/favicon.svg 를 래스터로 구워 파비콘 자산을 생성한다.
 *
 *   npm run favicons
 *
 * 산출물:
 *   public/favicon.ico          16/32/48 멀티사이즈 (PNG-in-ICO)
 *   public/apple-touch-icon.png 180x180, 모서리 라운딩 없음
 *
 * ⚠️ 실행 환경 제약
 * 헤드리스 크롬의 "시스템에 설치된 한글 폰트"로 <text>를 렌더한다.
 * 한글 폰트가 없는 환경(대부분의 리눅스 CI 컨테이너)에서 실행하면
 * 글자가 두부(□□)로 깨진다. Windows(Malgun Gothic) 또는
 * macOS(Apple SD Gothic Neo)에서만 실행할 것.
 *
 * 산출물은 git에 커밋되므로 CI/Vercel은 이 스크립트를 실행하지 않는다.
 * favicon.svg 를 고쳤을 때만 로컬에서 다시 구우면 된다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { encodeIco } from './lib/ico.mjs';
import { toAppleTouchSvg } from './lib/svg-variants.mjs';
import { assertGlyphCoverage } from './lib/glyph-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;

/**
 * 브라우저 컨텍스트에서 실행된다 (puppeteer가 직렬화해서 주입).
 * 실제로 저장될 PNG 바이트를 다시 디코드해서 재므로, 측정 대상과
 * 산출물이 항상 일치한다.
 */
async function measurePixels(dataUrl, size) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('PNG 디코드 실패'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  let opaque = 0;
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) continue;
    opaque += 1;
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
  }
  return { opaque, white };
}

async function renderPng(page, svg, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}` +
      `svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: 'load' }
  );
  const png = await page.screenshot({ type: 'png', omitBackground: true });
  const stats = await page.evaluate(measurePixels, `data:image/png;base64,${png.toString('base64')}`, size);
  const ratio = assertGlyphCoverage({ size, ...stats });
  console.log(`  ${String(size).padStart(3)}px  ${String(png.length).padStart(5)}B  글자 ${(ratio * 100).toFixed(1)}%`);
  return png;
}

const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();

  console.log('favicon.ico');
  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, png: await renderPng(page, svg, size) });
  }
  writeFileSync(path.join(root, 'public/favicon.ico'), encodeIco(icoImages));

  console.log('apple-touch-icon.png');
  const applePng = await renderPng(page, toAppleTouchSvg(svg), APPLE_SIZE);
  writeFileSync(path.join(root, 'public/apple-touch-icon.png'), applePng);

  console.log(`\n✓ public/favicon.ico (${ICO_SIZES.join('/')}px)`);
  console.log(`✓ public/apple-touch-icon.png (${APPLE_SIZE}x${APPLE_SIZE})`);
} finally {
  await browser.close();
}
```

- [ ] **Step 2: `package.json`에 실행 스크립트 추가**

`scripts` 블록의 `"lint"` 다음 줄에 추가:

```json
    "lint": "eslint",
    "favicons": "node scripts/generate-favicons.mjs",
    "test": "vitest run",
```

- [ ] **Step 3: 스크립트 실행해서 자산 생성**

Run: `npm run favicons`
Expected: 아래와 유사한 출력, 에러 없음. 글자 비율이 모두 10~40% 범위.

```
favicon.ico
   16px    618B  글자 25.8%
   32px    771B  글자 20.5%
   48px   1359B  글자 22.0%
apple-touch-icon.png
  180px   3551B  글자 22.4%

✓ public/favicon.ico (16/32/48px)
✓ public/apple-touch-icon.png (180x180)
```

- [ ] **Step 4: 산출물이 실제로 생겼는지 확인**

Run:
```bash
ls -l public/favicon.ico public/apple-touch-icon.png
node -e "const b=require('fs').readFileSync('public/favicon.ico'); console.log('magic', [...b.subarray(0,4)], 'count', b.readUInt16LE(4))"
```
Expected: 두 파일 존재. `magic [ 0, 0, 1, 0 ] count 3`

- [ ] **Step 5: `.gitignore`에 워크트리 디렉터리 추가**

`.gitignore` 맨 아래 `.superpowers/` 다음에 추가한다. 메인 체크아웃에서 `git add .` 할 때 워크트리 전체가 딸려 들어가는 사고를 막는다.

```
.superpowers/
.claude/worktrees/
```

- [ ] **Step 6: 회귀 없는지 전체 테스트**

Run: `npm test`
Expected: PASS — Task 4 이전이므로 `tests/app/favicon.test.ts`의 기존 5개 케이스도 아직 전부 통과해야 한다 (아직 `layout.tsx`를 안 건드렸으므로).

- [ ] **Step 7: 커밋**

```bash
git add scripts/generate-favicons.mjs package.json .gitignore public/favicon.ico public/apple-touch-icon.png
git commit -m "feat(favicon): puppeteer 래스터 생성 스크립트 + ico/apple-touch 자산 추가"
```

---

### Task 4: layout 메타데이터 연결 + 테스트 갱신

**Files:**
- Modify: `src/app/layout.tsx:16-18`
- Modify: `tests/app/favicon.test.ts`

**Interfaces:**
- Consumes: Task 3이 만든 `public/favicon.ico`, `public/apple-touch-icon.png`
- Produces: 없음 (최종 소비 지점)

**선언 순서가 중요하다.** `.ico`를 먼저 선언해 구글 크롤러가 확실히 집게 하고, `.svg`를 뒤에 남겨 모던 브라우저 탭에서는 계속 벡터가 쓰이게 한다.

**기존 테스트 1개가 깨진다:** `tests/app/favicon.test.ts:35`의 `expect(layout).toContain("icon: '/favicon.svg'")`는 배열 형태로 바꾸면 실패한다. 또 `favicon.test.ts:30`의 케이스명 `'레거시 발바닥 favicon.ico가 제거되어 SVG 하나로 통일됐다'`는 단언 자체는 계속 통과하지만 **`public/favicon.ico`를 추가한 시점부터 "SVG 하나로 통일"이 사실이 아니다.** 이름을 실제 의도(레거시 경로 부활 방지)에 맞게 고친다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/app/favicon.test.ts`를 아래 내용으로 **전체 교체**한다. 기존 회귀 방지 4개(🐾 부재 / 집사·모여 / `#ff734c` / `src/app/favicon.ico` 부재)는 그대로 살아있다.

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/app/favicon.test.ts`
Expected: FAIL — "layout 메타데이터" describe의 3개 케이스가 실패(`/favicon.ico`, `/apple-touch-icon.png` 미참조). "래스터 자산" describe는 Task 3 덕분에 이미 통과.

- [ ] **Step 3: `src/app/layout.tsx` 수정**

16-18행의 `icons` 블록을 교체한다:

```ts
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/app/favicon.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/layout.tsx tests/app/favicon.test.ts
git commit -m "feat(favicon): layout에 ico/apple-touch 아이콘 메타데이터 연결"
```

---

### Task 5: 전체 검증

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1~4 전부
- Produces: 사용자 보고에 쓸 검증 결과

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: PASS. baseline 대비 테스트 파일 +4(`tests/scripts/` 3개는 신규, `tests/app/favicon.test.ts`는 5→11 케이스), 실패 0.

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 신규 파일에 대한 에러 없음.

- [ ] **Step 3: production 빌드 (CLAUDE.md 필수 게이트)**

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과, exit 0.

- [ ] **Step 4: 생성된 `<head>` 태그가 실제로 맞는지 확인**

Run:
```bash
npx next build && npx next start -p 3111 &
# 서버가 뜬 뒤
curl -s http://localhost:3111/ | grep -o '<link[^>]*icon[^>]*>'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/favicon.ico
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/apple-touch-icon.png
```
Expected: `rel="icon"` 링크가 `/favicon.ico`(48x48) → `/favicon.svg` 순서로, `rel="apple-touch-icon"`가 `/apple-touch-icon.png`로 나온다. 두 자산 모두 **200**.

- [ ] **Step 5: 재실행 안정성 확인**

Run: `npm run favicons && git status --porcelain public/`
Expected: 스크립트가 다시 통과. `public/` 산출물에 diff가 없거나, 있어도 PNG 인코딩 노이즈 수준. **diff가 크면 렌더가 불안정하다는 뜻이므로 보고할 것.**

- [ ] **Step 6: 산출물 실물 확인 (사용자 결정 대기 항목)**

`public/favicon.ico`에서 16/32/48을 꺼내 눈으로 본다. 스펙상 **여기서 재디자인하지 말고 사용자에게 실물을 보여주고 판단을 받는다.**

Run:
```bash
node -e "
const fs=require('fs');const b=fs.readFileSync('public/favicon.ico');
const n=b.readUInt16LE(4);
for(let i=0;i<n;i++){const at=6+i*16;const s=b.readUInt8(at)||256;
const len=b.readUInt32LE(at+8);const off=b.readUInt32LE(at+12);
fs.writeFileSync('/tmp/favicon-'+s+'.png', b.subarray(off,off+len));
console.log('/tmp/favicon-'+s+'.png');}
"
```
(Windows Git Bash에서는 `/tmp` 대신 스크래치패드 경로를 쓸 것.)

그다음 각 PNG를 Read 툴로 열어 육안 확인한다.

- [ ] **Step 7: 최종 커밋 (없으면 생략)**

검증 중 수정이 있었다면:
```bash
git add -A && git commit -m "chore(favicon): 검증 반영"
```

---

## Verification

구현 완료 판정 기준:

1. `npm test` — 전부 통과 (baseline 748 + 신규 약 29 케이스)
2. `npm run lint` — 신규 파일 에러 0
3. `npx next build` — "Generating static pages"까지 통과
4. `npx next start` 후 `/favicon.ico`, `/apple-touch-icon.png` 둘 다 **200**
5. 서빙 HTML `<head>`에 `.ico`(먼저) → `.svg`(나중) → `apple-touch-icon` 링크 존재
6. `npm run favicons` 재실행이 안정적
7. 16/32/48 실물을 사용자에게 제시

**이 계획은 main에 머지하지 않는다.** 워크트리 브랜치에서 완료 후 사용자에게 보고하고, 머지 여부는 사용자가 결정한다.

## 배포 이후 — 사용자 수동 작업 (코드 아님)

1. `curl -I https://www.jipsamoye.com/favicon.ico` → **200** 확인
2. Google Search Console → URL 검사 → `https://www.jipsamoye.com/` 색인 요청

### 반드시 사용자에게 미리 말해둘 것

**코드를 고쳐 배포해도 구글 검색결과는 즉시 안 바뀐다.** 구글이 파비콘을 재크롤링할 때까지 **수일~수주** 걸리며 우리가 제어할 수 없다. 게다가 위 Context에 적었듯 이 작업은 원인 제거가 아니라 **수집 확률을 높이는 조치**다. 배포 직후 검색해보고 "안 고쳐졌다"고 오해하지 않도록 먼저 안내한다.
