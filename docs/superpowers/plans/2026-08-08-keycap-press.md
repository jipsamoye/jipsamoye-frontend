# AI 키캡 누르기 인터랙션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생성된 AI 키캡 이미지를 누르면 실제 키캡처럼 스쿼시되고 기계식 키보드 소리(7축)가 나게 한다 — 결과 화면·공유 페이지·게시글 상세 3곳.

**Architecture:** 이미지 컴포넌트를 감싸는 클라이언트 래퍼 `PressableKeycap`(children 슬롯 — `DetailImage` 폴백 보존)이 상태(축 선택·음소거·눌러본 적)를 소유하고, 소리는 모듈 싱글턴 WebAudio 엔진(`keycapSound.ts`), 데이터·localStorage는 `keycap.ts`가 담당한다. 백엔드 변경 0.

**Tech Stack:** Next.js 15 App Router + TypeScript + Tailwind CSS, WebAudio API, Vitest + React Testing Library (jsdom). 새 npm 의존성 없음.

**기획 스펙:** `docs/superpowers/specs/2026-08-08-keycap-press-handoff.md` — 확정 결정·버린 것·제약을 반드시 먼저 읽을 것. **"버린 것" 항목은 재제안 금지.**

## Global Constraints

- 테스트 없이 커밋 불가 (CLAUDE.md) — 모든 태스크는 테스트 스텝 포함
- push 전 `npx next build`가 "Generating static pages"까지 통과해야 함 (CLAUDE.md)
- `any` 사용 금지 (CLAUDE.md)
- 백엔드 변경 0 — 상태는 `localStorage`만 사용 (키: `keycap.switch` · `keycap.muted` · `keycap.pressed`)
- 공유 URL 계약(`src/lib/figurineShare.ts`) 불변 — 축 정보를 URL에 싣지 않는다
- 축 7종 순서 고정: 갈축(기본, 첫 번째) · 청축 · 적축 · 네이비 · 크림 · 제이드 · 흑축
- 소리 기본 켜짐 + 눈에 띄는 음소거 버튼. 햅틱(`navigator.vibrate`) 넣지 않음 (프로토타입에는 있었으나 제외 확정)
- `prefers-reduced-motion: reduce` → 스쿼시·자가 시연·물결·배지 둥둥 끔, **소리는 유지**
- 키보드 접근: 버튼 역할 + Space/Enter 처리 필수
- kbsim(MIT) 저작권 고지 필수: "키보드 사운드: kbsim © Thomas Lai (MIT)" — `ATTRIBUTION.md` 참조
- 새 npm 의존성 추가 금지

### 이 계획에서 확정한 구현 결정 (스펙이 위임한 부분)

1. **음원 포맷은 WAV 유지 (스펙의 "ogg 변환 권장"을 따르지 않음).**
   Safari(iOS/macOS)의 `decodeAudioData`는 Ogg Vorbis를 디코딩하지 못한다. 스펙 제약 3이 보여주듯 iOS가 핵심 타깃인데 ogg만 실으면 iOS에서 소리가 아예 안 난다. 이중 포맷(ogg+wav 폴백)은 총 140KB(축당 지연 로드 ~13KB)를 아끼자고 복잡도를 사는 꼴이라 기각. WAV는 모든 브라우저의 `decodeAudioData`가 지원한다.
2. **게시글 상세에도 축 칩바(음소거+칩)를 이미지 아래에 렌더한다.**
   스펙은 상세에서 "유도 3종 없음"만 명시했고 칩바는 언급하지 않았다. 칩을 화면에 노출하는 근거(iOS 무음 대응, 랜덤 배정 기각 사유)와 "소리 기본 켜짐이면 음소거가 항상 보여야 한다"는 접근성 요구가 상세에도 그대로 적용되므로 3곳 모두 동일하게 렌더한다. AI 키캡 자동 게시글은 이미지가 1장이라 레이아웃 훼손도 없다.
3. **박스 제이드 클립은 자산 단계에서 140ms로 트림 + 페이드아웃한다** (스펙 열린 항목 1 해소). 다른 축이 60~90ms인데 252ms는 빠른 연타에서 겹친다. 런타임 페이드 로직 대신 자산을 고치는 쪽이 코드 0줄이다. Task 1에서 트림 후 청취 검증.
4. **localStorage 값은 마운트 후 useEffect에서 읽는다** (useState 초기값 아님). `/figurines/share`가 서버 컴포넌트라 SSR 마크업과 클라이언트 첫 렌더가 일치해야 한다(hydration mismatch 방지). 유도는 "마운트 후 켜짐" 방향이라 이미 눌러본 사용자에게 배지가 깜빡 떴다 사라지는 일이 없다.

### 프로토타입에서 검증된 튜닝값 (변경 금지)

이 값들은 `prototype/mobile-nudge.html`(최종안)에서 직접 눌러보며 확정된 것이다. 이번 세션에서 실제 브라우저로 재검증했다.

| 항목 | 값 |
|---|---|
| 스쿼시 변형 | `scaleY(0.9) scaleX(1.04)`, `transform-origin: 50% 100%`(바닥 기준) |
| 스쿼시 트랜지션 | `110ms cubic-bezier(0.2, 0.8, 0.3, 1)` |
| 액자 고정 | 프레임이 `overflow: hidden` + `rounded-2xl` — 안쪽 이미지만 변형 |
| 자가 시연 | 380ms 키프레임(0% 원형 → 32% 스쿼시 → 100% 원형), 등장 0.9초·4.2초 뒤 각 1회, 소리 없음 |
| 물결 | 96px 원, 중앙 기준, `1.9s ease-out infinite`, `scale(0.45)→scale(1.9)`, opacity 0→0.95(22%)→0, 흰 테두리 3px + 안팎 1px 어두운 윤곽 |
| 배지 | `AiKeycapBadge label="눌러보기" floating`, 키캡 하단 중앙(bottom 12px) — 바깥 div가 `-translate-x-1/2` 정렬, 안쪽 배지가 둥둥 (스펙 제약 4) |
| 칩 프리뷰 | 칩 클릭 시 down 재생 → 130ms 뒤 up 재생 |
| 칩 레이아웃 | `flex-wrap`(모바일 375px에서 4+3 두 줄), 가로 스크롤 금지. 칩 높이 36px, 음소거 버튼 36×36px |
| 소리 트리거 | `pointerdown`→down음, `pointerup`/`pointerleave`/`pointercancel`(눌린 상태일 때만)→up음 |
| 터치 | `touch-action: manipulation`, tap-highlight 투명, 이미지 드래그 금지 |

## File Structure

| 파일 | 역할 |
|---|---|
| Create `public/sounds/keycap/*.wav` (14개) + `LICENSE.txt` | 정적 음원 + MIT 고지 |
| Create `src/lib/keycap.ts` | 축 7종 메타데이터 + localStorage 설정 헬퍼 (순수 로직) |
| Create `src/lib/keycapSound.ts` | WebAudio 엔진 — lazy AudioContext·버퍼 캐시·재생 |
| Modify `src/app/globals.css` | `keycapNudge`·`keycapRipple` 키프레임 추가 (badgeFloat 근처, 204행 부근) |
| Create `src/components/domain/KeycapSwitchBar.tsx` | 음소거 버튼 + 축 칩 7개 (controlled, 상태 없음) |
| Create `src/components/domain/PressableKeycap.tsx` | 누름 래퍼 (상태 소유) — children = 이미지 |
| Modify `src/components/domain/FigurineCreator.tsx:227-235` | 결과 이미지 래핑, `nudge` |
| Modify `src/app/figurines/share/page.tsx:52` | `DetailImage` 래핑, `nudge` |
| Modify `src/app/posts/[id]/page.tsx:184-198` | 첫 이미지만 래핑 (AI 키캡 글), 유도 없음 |
| Test `tests/lib/keycapAssets.test.ts` `tests/lib/keycap.test.ts` `tests/lib/keycapSound.test.ts` | lib 테스트 |
| Test `tests/app/keycap-css.test.ts` | 키프레임 존재 가드 (`tests/app/figurine-scan-css.test.ts` 패턴) |
| Test `tests/components/KeycapSwitchBar.test.tsx` `tests/components/PressableKeycap.test.tsx` `tests/components/PressableKeycap.nudge.test.tsx` | 컴포넌트 테스트 |
| Test `tests/components/FigurineCreator.keycap.test.tsx` `tests/app/figurineShare.keycap.test.tsx` `tests/app/postDetailKeycap.test.tsx` | 적용 지점 3곳 통합 테스트 |

---

### Task 1: 사운드 자산 배치 + 제이드 트림 + 라이선스 고지

**Files:**
- Create: `public/sounds/keycap/{brown,blue,red,navy,cream,jade,black}-{down,up}.wav` (14개)
- Create: `public/sounds/keycap/LICENSE.txt`
- Test: `tests/lib/keycapAssets.test.ts`

**Interfaces:**
- Consumes: `docs/superpowers/assets/keycap-press/sounds/*.wav` (mono 44.1kHz s16, 피크 −3dBFS)
- Produces: URL 규약 `/sounds/keycap/<switchId>-<down|up>.wav` — Task 2의 `keycapSoundUrl()`과 Task 3의 fetch가 이 경로에 의존

- [ ] **Step 1: 실패하는 자산 테스트 작성**

```ts
// tests/lib/keycapAssets.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'sounds', 'keycap');
const IDS = ['brown', 'blue', 'red', 'navy', 'cream', 'jade', 'black'] as const;

// mono 44.1kHz 16bit = 88,200 bytes/초. 헤더 여유 1KB.
const bytesForMs = (ms: number) => Math.ceil((88_200 * ms) / 1000) + 1024;

describe('키캡 사운드 자산', () => {
  it('7축 × down/up = WAV 14개가 존재하고 RIFF/WAVE 헤더를 가진다', () => {
    for (const id of IDS) {
      for (const dir of ['down', 'up'] as const) {
        const buf = readFileSync(path.join(DIR, `${id}-${dir}.wav`));
        expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
        expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
      }
    }
  });

  it('모든 클립이 160ms 이하다 — 제이드 252ms 원본이 트림 없이 들어오면 실패', () => {
    for (const id of IDS) {
      for (const dir of ['down', 'up'] as const) {
        const { size } = statSync(path.join(DIR, `${id}-${dir}.wav`));
        expect(size, `${id}-${dir}.wav`).toBeLessThanOrEqual(bytesForMs(160));
      }
    }
  });

  it('LICENSE.txt에 kbsim MIT 고지가 있다', () => {
    const text = readFileSync(path.join(DIR, 'LICENSE.txt'), 'utf-8');
    expect(text).toContain('kbsim');
    expect(text).toContain('Thomas Lai');
    expect(text).toContain('MIT');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/lib/keycapAssets.test.ts`
Expected: FAIL (ENOENT — 디렉터리 없음)

- [ ] **Step 3: 자산 복사 + 제이드 트림**

```bash
mkdir -p public/sounds/keycap
cp docs/superpowers/assets/keycap-press/sounds/*.wav public/sounds/keycap/
# 제이드만 140ms 트림 + 끝 35ms 페이드아웃 (스펙 열린 항목 1)
for f in jade-down jade-up; do
  ffmpeg -y -i "public/sounds/keycap/$f.wav" \
    -af "atrim=0:0.14,afade=t=out:st=0.105:d=0.035" \
    -ar 44100 -ac 1 -sample_fmt s16 "public/sounds/keycap/$f.tmp.wav"
  mv "public/sounds/keycap/$f.tmp.wav" "public/sounds/keycap/$f.wav"
done
```

- [ ] **Step 4: 트림 결과 청취 검증**

```bash
# 연타 시나리오 재현 — 잔향이 뚝 끊기는 느낌이면 afade d=0.035를 0.05까지 늘려 재생성
afplay public/sounds/keycap/jade-down.wav; afplay public/sounds/keycap/jade-down.wav
afplay public/sounds/keycap/jade-up.wav
# 비교용 원본
afplay docs/superpowers/assets/keycap-press/sounds/jade-down.wav
```
판단 기준: 트랜지언트(딸깍)가 온전히 남아 있고 끝이 자연스럽게 사라지면 통과. 확신이 없으면 원본을 유지하되(테스트의 160ms 상한을 260ms로 수정) 커밋 메시지에 사유를 남긴다.

- [ ] **Step 5: LICENSE.txt 작성**

```
키보드 사운드 출처 및 라이선스
================================

키보드 사운드: kbsim (https://github.com/tplai/kbsim) © Thomas Lai (MIT)
- brown, blue, red, navy, cream (down/up 각 1개)

MIT License

Copyright (c) Thomas Lai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

----

jade, black (down/up 각 1개): Freesound el_boss (CC0)
- https://freesound.org/people/el_boss/sounds/643558/
- https://freesound.org/people/el_boss/sounds/643559/
CC0 — 고지 의무 없음. 상세 가공 내역: 레포 docs/superpowers/assets/keycap-press/ATTRIBUTION.md
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/lib/keycapAssets.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: 커밋**

```bash
git add public/sounds/keycap tests/lib/keycapAssets.test.ts
git commit -m "feat(keycap): 축 7종 사운드 자산 배치 — 제이드 140ms 트림, kbsim MIT 고지 포함"
```

---

### Task 2: `src/lib/keycap.ts` — 축 메타데이터 + localStorage 설정

**Files:**
- Create: `src/lib/keycap.ts`
- Test: `tests/lib/keycap.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 모듈)
- Produces (이후 모든 태스크가 사용):
  - `type KeycapSwitchId = 'brown' | 'blue' | 'red' | 'navy' | 'cream' | 'jade' | 'black'`
  - `interface KeycapSwitch { id: KeycapSwitchId; label: string; dotClass: string }`
  - `KEYCAP_SWITCHES: readonly KeycapSwitch[]` (7개, brown 첫 번째)
  - `DEFAULT_SWITCH_ID: KeycapSwitchId` (= 'brown')
  - `keycapSoundUrl(id: KeycapSwitchId, dir: 'down' | 'up'): string`
  - `getStoredSwitchId(): KeycapSwitchId` / `storeSwitchId(id: KeycapSwitchId): void`
  - `getStoredMuted(): boolean` / `storeMuted(muted: boolean): void`
  - `getHasPressed(): boolean` / `markPressed(): void`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/lib/keycap.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  KEYCAP_SWITCHES, DEFAULT_SWITCH_ID, keycapSoundUrl,
  getStoredSwitchId, storeSwitchId,
  getStoredMuted, storeMuted,
  getHasPressed, markPressed,
} from '@/lib/keycap';

describe('KEYCAP_SWITCHES', () => {
  it('7종이며 갈축(brown)이 첫 번째(기본값)다', () => {
    expect(KEYCAP_SWITCHES).toHaveLength(7);
    expect(KEYCAP_SWITCHES[0].id).toBe('brown');
    expect(DEFAULT_SWITCH_ID).toBe('brown');
    expect(KEYCAP_SWITCHES.map((s) => s.id)).toEqual([
      'brown', 'blue', 'red', 'navy', 'cream', 'jade', 'black',
    ]);
  });

  it('라벨은 프로토타입 확정안(짧은 이름)이다', () => {
    expect(KEYCAP_SWITCHES.map((s) => s.label)).toEqual([
      '갈축', '청축', '적축', '네이비', '크림', '제이드', '흑축',
    ]);
  });

  it('keycapSoundUrl은 public 자산 경로를 만든다', () => {
    expect(keycapSoundUrl('brown', 'down')).toBe('/sounds/keycap/brown-down.wav');
    expect(keycapSoundUrl('jade', 'up')).toBe('/sounds/keycap/jade-up.wav');
  });
});

describe('localStorage 설정', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('축: 기본 brown, 저장·복원 roundtrip', () => {
    expect(getStoredSwitchId()).toBe('brown');
    storeSwitchId('jade');
    expect(getStoredSwitchId()).toBe('jade');
    expect(localStorage.getItem('keycap.switch')).toBe('jade');
  });

  it('저장된 축이 목록에 없는 값이면 기본값으로 폴백한다', () => {
    localStorage.setItem('keycap.switch', 'topre');
    expect(getStoredSwitchId()).toBe('brown');
  });

  it('음소거: 기본 false(소리 켜짐), 저장·복원 roundtrip', () => {
    expect(getStoredMuted()).toBe(false);
    storeMuted(true);
    expect(getStoredMuted()).toBe(true);
    storeMuted(false);
    expect(getStoredMuted()).toBe(false);
  });

  it('눌러본 적: 기본 false, markPressed 후 true', () => {
    expect(getHasPressed()).toBe(false);
    markPressed();
    expect(getHasPressed()).toBe(true);
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('localStorage가 던져도(사파리 프라이빗 등) 조용히 기본값으로 동작한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(getStoredSwitchId()).toBe('brown');
    expect(getStoredMuted()).toBe(false);
    expect(getHasPressed()).toBe(false);
    expect(() => storeSwitchId('blue')).not.toThrow();
    expect(() => storeMuted(true)).not.toThrow();
    expect(() => markPressed()).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/lib/keycap.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/keycap.ts
/**
 * AI 키캡 누르기 — 축 메타데이터와 사용자 설정(localStorage).
 * 소리 자산 출처: kbsim © Thomas Lai (MIT) + Freesound el_boss (CC0).
 * 고지 전문: public/sounds/keycap/LICENSE.txt
 */

export type KeycapSwitchId = 'brown' | 'blue' | 'red' | 'navy' | 'cream' | 'jade' | 'black';

export interface KeycapSwitch {
  id: KeycapSwitchId;
  /** 칩에 표시하는 짧은 이름 (모바일 375px에서 두 줄 4+3 배치 기준) */
  label: string;
  /** 칩 앞 색 점 — Tailwind가 정적 스캔할 수 있게 완성된 클래스 문자열로 둔다 */
  dotClass: string;
}

// 순서 고정 — 첫 번째(갈축)가 기본값이라는 기획 결정에 의존한다
export const KEYCAP_SWITCHES: readonly KeycapSwitch[] = [
  { id: 'brown', label: '갈축', dotClass: 'bg-[#a16207]' },
  { id: 'blue', label: '청축', dotClass: 'bg-[#3b82f6]' },
  { id: 'red', label: '적축', dotClass: 'bg-[#ef4444]' },
  { id: 'navy', label: '네이비', dotClass: 'bg-[#1e40af]' },
  { id: 'cream', label: '크림', dotClass: 'bg-[#eab308]' },
  { id: 'jade', label: '제이드', dotClass: 'bg-[#10b981]' },
  { id: 'black', label: '흑축', dotClass: 'bg-[#1f2937]' },
];

export const DEFAULT_SWITCH_ID: KeycapSwitchId = KEYCAP_SWITCHES[0].id;

export function keycapSoundUrl(id: KeycapSwitchId, dir: 'down' | 'up'): string {
  return `/sounds/keycap/${id}-${dir}.wav`;
}

const SWITCH_KEY = 'keycap.switch';
const MUTED_KEY = 'keycap.muted';
const PRESSED_KEY = 'keycap.pressed';

// 프라이빗 모드·저장소 차단 환경에서 기능 전체가 죽지 않게 전부 try/catch
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시 — 이번 세션 동안만 기억되는 것으로 충분
  }
}

export function getStoredSwitchId(): KeycapSwitchId {
  const stored = read(SWITCH_KEY);
  return KEYCAP_SWITCHES.some((s) => s.id === stored)
    ? (stored as KeycapSwitchId)
    : DEFAULT_SWITCH_ID;
}

export function storeSwitchId(id: KeycapSwitchId): void {
  write(SWITCH_KEY, id);
}

export function getStoredMuted(): boolean {
  return read(MUTED_KEY) === '1';
}

export function storeMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? '1' : '0');
}

export function getHasPressed(): boolean {
  return read(PRESSED_KEY) === '1';
}

export function markPressed(): void {
  write(PRESSED_KEY, '1');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/keycap.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/keycap.ts tests/lib/keycap.test.ts
git commit -m "feat(keycap): 축 7종 메타데이터 + localStorage 설정 모듈"
```

---

### Task 3: `src/lib/keycapSound.ts` — WebAudio 재생 엔진

**Files:**
- Create: `src/lib/keycapSound.ts`
- Test: `tests/lib/keycapSound.test.ts`

**Interfaces:**
- Consumes: `keycapSoundUrl`, `KeycapSwitchId` (Task 2)
- Produces:
  - `playKeycapSound(id: KeycapSwitchId, dir: 'down' | 'up'): void` — fire-and-forget. **AudioContext를 이 함수 안에서 lazy 생성** (스펙 제약 2: 사용자 제스처 핸들러 안에서 호출된다는 전제)
  - `warmKeycapSound(id: KeycapSwitchId): void` — down/up ArrayBuffer만 미리 fetch (AudioContext 생성 안 함)
  - `resetKeycapSoundForTest(): void` — 모듈 상태 초기화 (테스트 전용)
- 음소거 판단은 **호출자(컴포넌트) 책임** — 엔진은 항상 재생한다

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/lib/keycapSound.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playKeycapSound, warmKeycapSound, resetKeycapSoundForTest } from '@/lib/keycapSound';

const flush = () => new Promise((r) => setTimeout(r, 0));

const sourceMock = { buffer: null as unknown, connect: vi.fn(), start: vi.fn() };

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'suspended';
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  decodeAudioData = vi.fn(() => Promise.resolve({ duration: 0.08 } as AudioBuffer));
  createBufferSource = vi.fn(() => sourceMock);
  constructor() {
    MockAudioContext.instances.push(this);
  }
}

describe('keycapSound', () => {
  beforeEach(() => {
    resetKeycapSoundForTest();
    MockAudioContext.instances = [];
    sourceMock.connect.mockClear();
    sourceMock.start.mockClear();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    ));
  });

  it('warm은 fetch만 하고 AudioContext를 만들지 않는다 (제약 2: 제스처 전 생성 금지)', async () => {
    warmKeycapSound('brown');
    await flush();
    expect(fetch).toHaveBeenCalledWith('/sounds/keycap/brown-down.wav');
    expect(fetch).toHaveBeenCalledWith('/sounds/keycap/brown-up.wav');
    expect(MockAudioContext.instances).toHaveLength(0);
  });

  it('play는 AudioContext를 호출 즉시(동기로) 생성하고 소스를 시작한다', async () => {
    playKeycapSound('brown', 'down');
    // 제스처 핸들러의 동기 구간 안에서 생성돼야 자동재생 정책을 통과한다
    expect(MockAudioContext.instances).toHaveLength(1);
    await flush();
    expect(sourceMock.start).toHaveBeenCalledTimes(1);
  });

  it('suspended 상태면 resume을 호출한다', async () => {
    playKeycapSound('brown', 'down');
    await flush();
    expect(MockAudioContext.instances[0].resume).toHaveBeenCalled();
  });

  it('AudioContext·fetch·decode는 재호출 시 캐시를 쓴다 (각 1회)', async () => {
    playKeycapSound('brown', 'down');
    await flush();
    playKeycapSound('brown', 'down');
    await flush();
    expect(MockAudioContext.instances).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === '/sounds/keycap/brown-down.wav')).toHaveLength(1);
    expect(MockAudioContext.instances[0].decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sourceMock.start).toHaveBeenCalledTimes(2);
  });

  it('warm으로 미리 받은 버퍼를 play가 재사용한다', async () => {
    warmKeycapSound('jade');
    await flush();
    playKeycapSound('jade', 'down');
    await flush();
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === '/sounds/keycap/jade-down.wav')).toHaveLength(1);
    expect(sourceMock.start).toHaveBeenCalledTimes(1);
  });

  it('fetch 실패(404)면 조용히 무시한다 — 소리는 보조 기능', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
    expect(() => playKeycapSound('brown', 'down')).not.toThrow();
    await flush();
    expect(sourceMock.start).not.toHaveBeenCalled();
  });

  it('AudioContext 미지원 환경이면 아무 일도 하지 않는다', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playKeycapSound('brown', 'down')).not.toThrow();
    await flush();
    expect(sourceMock.start).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/lib/keycapSound.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/keycapSound.ts
import { keycapSoundUrl, type KeycapSwitchId } from './keycap';

/**
 * 키캡 소리 재생 엔진 (모듈 싱글턴).
 *
 * AudioContext는 반드시 playKeycapSound 안에서 lazy 생성한다 — 브라우저 자동재생
 * 정책상 사용자 제스처(pointerdown/keydown) 핸들러의 동기 구간에서 만들어야
 * running 상태가 되고, 페이지 로드 시 만들면 첫 소리를 놓친다 (기획 스펙 제약 2).
 * warmKeycapSound는 네트워크 fetch만 미리 해두는 용도라 AudioContext를 만들지 않는다.
 */

let ctx: AudioContext | null = null;
const rawCache = new Map<string, Promise<ArrayBuffer | null>>();
const decodedCache = new Map<string, Promise<AudioBuffer | null>>();

function fetchRaw(url: string): Promise<ArrayBuffer | null> {
  let cached = rawCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    rawCache.set(url, cached);
  }
  return cached;
}

function decodeBuffer(url: string): Promise<AudioBuffer | null> {
  let cached = decodedCache.get(url);
  if (!cached) {
    cached = fetchRaw(url)
      // decodeAudioData가 ArrayBuffer를 detach하는 브라우저가 있어 복사본을 넘긴다
      .then((raw) => (raw && ctx ? ctx.decodeAudioData(raw.slice(0)) : null))
      .catch(() => null);
    decodedCache.set(url, cached);
  }
  return cached;
}

export function warmKeycapSound(id: KeycapSwitchId): void {
  if (typeof fetch !== 'function') return;
  void fetchRaw(keycapSoundUrl(id, 'down'));
  void fetchRaw(keycapSoundUrl(id, 'up'));
}

export function playKeycapSound(id: KeycapSwitchId, dir: 'down' | 'up'): void {
  if (typeof AudioContext !== 'function') return;
  // 여기까지는 동기 — 제스처 컨텍스트 안에서 생성/resume 되어야 한다
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();

  void decodeBuffer(keycapSoundUrl(id, dir))
    .then((buffer) => {
      if (!buffer || !ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    })
    .catch(() => {
      // 소리는 보조 기능 — 어떤 실패도 화면을 깨지 않는다
    });
}

/** 테스트 전용 — 모듈 싱글턴 상태 초기화 */
export function resetKeycapSoundForTest(): void {
  ctx = null;
  rawCache.clear();
  decodedCache.clear();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/keycapSound.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/keycapSound.ts tests/lib/keycapSound.test.ts
git commit -m "feat(keycap): WebAudio 재생 엔진 — lazy AudioContext + 버퍼 캐시"
```

---

### Task 4: 키프레임 CSS + `KeycapSwitchBar` (음소거 + 축 칩)

**Files:**
- Modify: `src/app/globals.css` (badgeFloat 키프레임 뒤, 208행 부근에 추가)
- Create: `src/components/domain/KeycapSwitchBar.tsx`
- Test: `tests/app/keycap-css.test.ts`, `tests/components/KeycapSwitchBar.test.tsx`

**Interfaces:**
- Consumes: `KEYCAP_SWITCHES`, `KeycapSwitchId` (Task 2)
- Produces:
  - `interface KeycapSwitchBarProps { selectedId: KeycapSwitchId; muted: boolean; onSelect: (id: KeycapSwitchId) => void; onToggleMute: () => void }`
  - `KeycapSwitchBar` — 상태 없는 controlled 컴포넌트. Task 5의 `PressableKeycap`이 렌더한다
  - CSS `@keyframes keycapNudge`, `@keyframes keycapRipple` — Task 6이 사용

- [ ] **Step 1: 실패하는 테스트 작성 (CSS 가드 + 컴포넌트)**

```ts
// tests/app/keycap-css.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Tailwind 임의값 애니메이션(animate-[keycapNudge_...])은 키프레임이 지워져도
// 빌드가 통과한다 — 파일 수준 가드로 회귀를 막는다 (figurine-scan-css.test.ts 패턴)
const css = readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf-8');

describe('키캡 누르기 키프레임', () => {
  it('keycapNudge — 32% 지점에서 스쿼시와 동일한 변형(scaleY .9, scaleX 1.04)', () => {
    expect(css).toContain('@keyframes keycapNudge');
    const block = css.slice(css.indexOf('@keyframes keycapNudge'));
    expect(block).toContain('scaleY(0.9)');
    expect(block).toContain('scaleX(1.04)');
  });

  it('keycapRipple — scale 0.45→1.9, 정점 불투명도 0.95', () => {
    expect(css).toContain('@keyframes keycapRipple');
    const block = css.slice(css.indexOf('@keyframes keycapRipple'));
    expect(block).toContain('scale(0.45)');
    expect(block).toContain('scale(1.9)');
    expect(block).toContain('0.95');
  });
});
```

```tsx
// tests/components/KeycapSwitchBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KeycapSwitchBar from '@/components/domain/KeycapSwitchBar';

const setup = (over: Partial<Parameters<typeof KeycapSwitchBar>[0]> = {}) => {
  const props = {
    selectedId: 'brown' as const,
    muted: false,
    onSelect: vi.fn(),
    onToggleMute: vi.fn(),
    ...over,
  };
  render(<KeycapSwitchBar {...props} />);
  return props;
};

describe('KeycapSwitchBar', () => {
  it('축 칩 7개를 확정 순서·라벨로 렌더하고 선택 칩에 aria-pressed를 준다', () => {
    setup({ selectedId: 'jade' });
    const labels = ['갈축', '청축', '적축', '네이비', '크림', '제이드', '흑축'];
    const chips = labels.map((l) => screen.getByRole('button', { name: l }));
    expect(chips).toHaveLength(7);
    expect(screen.getByRole('button', { name: '제이드' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '갈축' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('칩 클릭 시 onSelect(id)를 호출한다', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    expect(onSelect).toHaveBeenCalledWith('blue');
  });

  it('칩 줄은 가로 스크롤 없이 줄바꿈한다 (flex-wrap)', () => {
    setup();
    const chipRow = screen.getByRole('button', { name: '갈축' }).parentElement as HTMLElement;
    expect(chipRow.className).toContain('flex-wrap');
    expect(chipRow.className).not.toContain('overflow-x');
  });

  it('음소거 버튼: 소리 켜짐이면 "소리 끄기" 🔊, 클릭 시 onToggleMute', () => {
    const { onToggleMute } = setup();
    const mute = screen.getByRole('button', { name: '소리 끄기' });
    expect(mute).toHaveTextContent('🔊');
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(mute);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('음소거 상태면 "소리 켜기" 🔇 + aria-pressed', () => {
    setup({ muted: true });
    const mute = screen.getByRole('button', { name: '소리 켜기' });
    expect(mute).toHaveTextContent('🔇');
    expect(mute).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/app/keycap-css.test.ts tests/components/KeycapSwitchBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: globals.css에 키프레임 추가** (badgeFloat 블록 바로 아래)

```css
/* 키캡 누르기 — 자가 시연: 스스로 한 번 눌렸다 올라온다. 스쿼시와 같은 변형·곡선 */
@keyframes keycapNudge {
  0%   { transform: scaleY(1) scaleX(1); }
  32%  { transform: scaleY(0.9) scaleX(1.04); }
  100% { transform: scaleY(1) scaleX(1); }
}

/* 키캡 누르기 — 첫 누름 전까지 중앙에서 계속 퍼지는 물결 */
@keyframes keycapRipple {
  0%   { transform: scale(0.45); opacity: 0; }
  22%  { opacity: 0.95; }
  100% { transform: scale(1.9); opacity: 0; }
}
```

- [ ] **Step 4: KeycapSwitchBar 구현**

```tsx
// src/components/domain/KeycapSwitchBar.tsx
'use client';

import { KEYCAP_SWITCHES, type KeycapSwitchId } from '@/lib/keycap';

interface KeycapSwitchBarProps {
  selectedId: KeycapSwitchId;
  muted: boolean;
  onSelect: (id: KeycapSwitchId) => void;
  onToggleMute: () => void;
}

/**
 * 축 선택 칩 + 음소거 버튼. 상태는 PressableKeycap이 소유한다.
 * 칩은 가로 스크롤 금지 — 모바일 375px에서 두 줄(4+3)로 줄바꿈 (기획 확정).
 * 소리가 기본 켜짐이므로 음소거 버튼은 항상 맨 앞에 보인다 (접근성 요구).
 */
export default function KeycapSwitchBar({ selectedId, muted, onSelect, onToggleMute }: KeycapSwitchBarProps) {
  return (
    <div className="flex items-start gap-2 mt-3.5">
      <button
        type="button"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={muted}
        onClick={onToggleMute}
        className={`flex-none w-9 h-9 rounded-[10px] border border-gray-300 bg-white text-[15px] leading-none transition-opacity ${muted ? 'opacity-45' : ''}`}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {KEYCAP_SWITCHES.map((sw) => (
          <button
            key={sw.id}
            type="button"
            aria-pressed={sw.id === selectedId}
            onClick={() => onSelect(sw.id)}
            className={`flex items-center gap-1.5 h-9 px-2.5 rounded-[10px] border text-[13px] whitespace-nowrap transition-colors ${
              sw.id === selectedId
                ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span aria-hidden className={`w-2 h-2 rounded-full ${sw.dotClass}`} />
            {sw.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/app/keycap-css.test.ts tests/components/KeycapSwitchBar.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/app/globals.css src/components/domain/KeycapSwitchBar.tsx tests/app/keycap-css.test.ts tests/components/KeycapSwitchBar.test.tsx
git commit -m "feat(keycap): 축 칩바 컴포넌트 + 자가시연·물결 키프레임"
```

---

### Task 5: `PressableKeycap` — 누름 코어 (스쿼시 · 소리 · 키보드 · 설정)

**Files:**
- Create: `src/components/domain/PressableKeycap.tsx`
- Test: `tests/components/PressableKeycap.test.tsx`

**Interfaces:**
- Consumes: Task 2 전부, `playKeycapSound`·`warmKeycapSound` (Task 3), `KeycapSwitchBar` (Task 4), `AiKeycapBadge` (기존)
- Produces:
  - `interface PressableKeycapProps { children: React.ReactNode; nudge?: boolean; className?: string }`
  - `PressableKeycap` (default export) — 적용 지점 3곳(Task 7·8·9)이 이 시그니처에 의존
  - 이 태스크에서는 `nudge` prop을 받아두되 유도 렌더링은 Task 6에서 구현

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/components/PressableKeycap.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const soundMock = vi.hoisted(() => ({
  playKeycapSound: vi.fn(),
  warmKeycapSound: vi.fn(),
}));
vi.mock('@/lib/keycapSound', () => soundMock);

import PressableKeycap from '@/components/domain/PressableKeycap';

const renderKeycap = (props: { nudge?: boolean; className?: string } = {}) =>
  render(
    <PressableKeycap {...props}>
      <img src="/result.png" alt="완성된 AI 키캡 피규어" />
    </PressableKeycap>,
  );

const keyButton = () => screen.getByRole('button', { name: '키캡 누르기' });
// 스쿼시 대상은 children을 감싼 래퍼 div
const squashTarget = () => keyButton().firstElementChild as HTMLElement;

describe('PressableKeycap — 누름 코어', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('children 이미지를 그대로 렌더하고 버튼 역할을 가진다 (DetailImage 폴백 보존 구조)', () => {
    renderKeycap();
    expect(screen.getByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
    expect(keyButton()).toBeInTheDocument();
  });

  it('pointerdown: 스쿼시 클래스 + down 소리 / pointerup: 원복 + up 소리', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');

    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).not.toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });

  it('pointerleave로 벗어나도 올라온다 — 이후 pointerup이 와도 up은 한 번만', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerLeave(keyButton());
    fireEvent.pointerUp(keyButton());
    const ups = soundMock.playKeycapSound.mock.calls.filter(([, d]) => d === 'up');
    expect(ups).toHaveLength(1);
  });

  it('키보드: Space keydown/keyup으로 누르고 뗄 수 있고, 반복 keydown은 무시한다', () => {
    renderKeycap();
    fireEvent.keyDown(keyButton(), { key: ' ' });
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    fireEvent.keyDown(keyButton(), { key: ' ', repeat: true });
    const downs = soundMock.playKeycapSound.mock.calls.filter(([, d]) => d === 'down');
    expect(downs).toHaveLength(1);
    fireEvent.keyUp(keyButton(), { key: ' ' });
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });

  it('음소거 저장 상태: 소리는 안 나지만 스쿼시는 동작한다', () => {
    localStorage.setItem('keycap.muted', '1');
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).toContain('scale-y-[0.9]');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('저장된 축(jade)을 마운트 후 반영해 재생·칩 선택에 쓴다', () => {
    localStorage.setItem('keycap.switch', 'jade');
    renderKeycap();
    expect(screen.getByRole('button', { name: '제이드' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(keyButton());
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('jade', 'down');
  });

  it('칩 클릭: 선택 저장 + warm + 프리뷰(down 즉시, 130ms 뒤 up)', () => {
    vi.useFakeTimers();
    renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '청축' }));
    expect(localStorage.getItem('keycap.switch')).toBe('blue');
    expect(soundMock.warmKeycapSound).toHaveBeenCalledWith('blue');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('blue', 'down');
    act(() => vi.advanceTimersByTime(130));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('blue', 'up');
    vi.useRealTimers();
  });

  it('음소거 토글이 localStorage에 저장되고, 음소거 중 칩 클릭은 선택만 바꾼다', () => {
    renderKeycap();
    fireEvent.click(screen.getByRole('button', { name: '소리 끄기' }));
    expect(localStorage.getItem('keycap.muted')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: '적축' }));
    expect(localStorage.getItem('keycap.switch')).toBe('red');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('첫 누름을 localStorage에 기록한다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('마운트 시 현재 축 소리를 미리 받아둔다 (warm)', () => {
    renderKeycap();
    expect(soundMock.warmKeycapSound).toHaveBeenCalledWith('brown');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/components/PressableKeycap.test.tsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현** (유도 파트는 Task 6에서 채운다 — 이 단계에서는 `nudge` prop만 받아둔다)

```tsx
// src/components/domain/PressableKeycap.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_SWITCH_ID, getStoredMuted, getStoredSwitchId, getHasPressed,
  markPressed, storeMuted, storeSwitchId, type KeycapSwitchId,
} from '@/lib/keycap';
import { playKeycapSound, warmKeycapSound } from '@/lib/keycapSound';
import KeycapSwitchBar from '@/components/domain/KeycapSwitchBar';

interface PressableKeycapProps {
  /** 키캡 이미지 — DetailImage든 img든 그대로 감싼다 (각 페이지의 폴백 로직 보존) */
  children: React.ReactNode;
  /** 유도 3종(자가 시연·물결·눌러보기 배지). 게시글 상세는 false (기획 확정) */
  nudge?: boolean;
  className?: string;
}

/**
 * AI 키캡 이미지를 실제 키캡처럼 누르게 만드는 래퍼.
 * 액자(버튼, overflow-hidden)는 고정하고 안쪽 이미지만 바닥 기준으로 스쿼시한다.
 * 소리는 pointerdown/up에 down/up 클립 재생 — AudioContext는 첫 제스처에서 lazy 생성.
 * 상태(축·음소거·눌러본 적)는 localStorage만 사용, 백엔드 변경 없음.
 */
export default function PressableKeycap({ children, nudge = false, className = '' }: PressableKeycapProps) {
  const [switchId, setSwitchId] = useState<KeycapSwitchId>(DEFAULT_SWITCH_ID);
  const [muted, setMuted] = useState(false);
  const [isDown, setIsDown] = useState(false);

  // localStorage는 마운트 후에 읽는다 — share 페이지가 서버 컴포넌트라
  // SSR 마크업과 첫 클라이언트 렌더가 일치해야 한다 (hydration mismatch 방지)
  useEffect(() => {
    const stored = getStoredSwitchId();
    setSwitchId(stored);
    setMuted(getStoredMuted());
    warmKeycapSound(stored);
  }, []);

  const pressDown = () => {
    if (isDown) return;
    setIsDown(true);
    if (!muted) playKeycapSound(switchId, 'down');
    if (!getHasPressed()) markPressed();
  };

  const pressUp = () => {
    if (!isDown) return;
    setIsDown(false);
    if (!muted) playKeycapSound(switchId, 'up');
  };

  const handleSelect = (id: KeycapSwitchId) => {
    setSwitchId(id);
    storeSwitchId(id);
    warmKeycapSound(id);
    if (!muted) {
      // 칩 프리뷰 — 실제 누름과 같은 down→up 순서 (프로토타입 튜닝값 130ms)
      playKeycapSound(id, 'down');
      window.setTimeout(() => playKeycapSound(id, 'up'), 130);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    storeMuted(next);
  };

  return (
    <div className={className}>
      <div className="relative">
        <button
          type="button"
          aria-label="키캡 누르기"
          onPointerDown={pressDown}
          onPointerUp={pressUp}
          onPointerLeave={pressUp}
          onPointerCancel={pressUp}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault(); // Space 스크롤·keyup 시점 click 발화 방지
              pressDown();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') pressUp();
          }}
          className="relative block w-full overflow-hidden rounded-2xl cursor-pointer select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {/* 액자(버튼)는 고정, 이 래퍼만 바닥 기준으로 눌린다. reduced-motion이면 스쿼시 없음(소리는 유지) */}
          <div
            className={`origin-bottom motion-safe:transition-transform motion-safe:duration-[110ms] motion-safe:ease-[cubic-bezier(0.2,0.8,0.3,1)] ${
              isDown ? 'motion-safe:scale-y-[0.9] motion-safe:scale-x-[1.04]' : ''
            }`}
          >
            {children}
          </div>
        </button>
      </div>
      <KeycapSwitchBar
        selectedId={switchId}
        muted={muted}
        onSelect={handleSelect}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/components/PressableKeycap.test.tsx tests/components/KeycapSwitchBar.test.tsx`
Expected: PASS (전부)

- [ ] **Step 5: 커밋**

```bash
git add src/components/domain/PressableKeycap.tsx tests/components/PressableKeycap.test.tsx
git commit -m "feat(keycap): PressableKeycap 누름 코어 — 스쿼시·소리·키보드·설정 저장"
```

---

### Task 6: `PressableKeycap` — 유도(넛지) 3종

**Files:**
- Modify: `src/components/domain/PressableKeycap.tsx` (Task 5 결과물에 유도 추가)
- Test: `tests/components/PressableKeycap.nudge.test.tsx`

**Interfaces:**
- Consumes: Task 5의 컴포넌트, `AiKeycapBadge`(기존, `label`·`floating` props), CSS 키프레임 (Task 4)
- Produces: `nudge` prop 완성 — 자가 시연(0.9s·4.2s) + 물결 + "눌러보기" 배지, 한 번 누르면 영구 소멸

**유도 명세 (기획 C안):**
- 자가 시연: 등장 0.9초·4.2초 뒤 각 1회 `keycapNudge` 380ms, 소리 없음
- 물결: 첫 누름까지 무한 반복
- 배지: `AiKeycapBadge label="눌러보기" floating`, 키캡 하단 중앙 — **바깥 div가 `-translate-x-1/2` 정렬, 안쪽 배지가 둥둥** (제약 4: 같은 요소에 두 transform을 걸면 안 됨)
- 한 번이라도 누르면 셋 다 영구 소멸 (`keycap.pressed`)
- `prefers-reduced-motion`: 자가 시연·물결 없음, 배지는 표시하되 둥둥은 `AiKeycapBadge`의 `motion-safe`가 알아서 끈다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/components/PressableKeycap.nudge.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const soundMock = vi.hoisted(() => ({
  playKeycapSound: vi.fn(),
  warmKeycapSound: vi.fn(),
}));
vi.mock('@/lib/keycapSound', () => soundMock);

import PressableKeycap from '@/components/domain/PressableKeycap';

// jsdom은 matchMedia 미구현 → reduced-motion 감지 스텁 (ProfileHoverCard.test.tsx 패턴)
function stubMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const renderKeycap = (nudge: boolean) =>
  render(
    <PressableKeycap nudge={nudge}>
      <img src="/result.png" alt="완성된 AI 키캡 피규어" />
    </PressableKeycap>,
  );

const keyButton = () => screen.getByRole('button', { name: '키캡 누르기' });
const squashTarget = () => keyButton().firstElementChild as HTMLElement;
const ripple = () => document.querySelector('[data-testid="keycap-ripple"]');

describe('PressableKeycap — 유도(넛지)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    stubMatchMedia(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nudge=true: 눌러보기 배지와 물결을 렌더한다', () => {
    renderKeycap(true);
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
    expect(ripple()).not.toBeNull();
  });

  it('배지: 바깥 요소가 정렬(-translate-x-1/2), 안쪽 배지가 둥둥 (제약 4)', () => {
    renderKeycap(true);
    const badge = screen.getByText('눌러보기');
    expect(badge.className).toContain('animate-[badgeFloat');
    const wrapper = badge.parentElement as HTMLElement;
    expect(wrapper.className).toContain('-translate-x-1/2');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).not.toContain('animate-');
  });

  it('nudge=false(게시글 상세): 배지·물결·자가 시연 전부 없음', () => {
    vi.useFakeTimers();
    renderKeycap(false);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(squashTarget().className).not.toContain('keycapNudge');
  });

  it('이미 눌러본 사람(keycap.pressed): 유도가 아예 안 뜬다', () => {
    localStorage.setItem('keycap.pressed', '1');
    renderKeycap(true);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
  });

  it('한 번 누르면 배지·물결이 사라지고 다시 안 뜬다', () => {
    renderKeycap(true);
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(ripple()).toBeNull();
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('자가 시연: 0.9초 뒤 keycapNudge 애니메이션, 끝나면 제거, 4.2초에 한 번 더 — 소리는 없다', () => {
    vi.useFakeTimers();
    renderKeycap(true);

    act(() => vi.advanceTimersByTime(900));
    expect(squashTarget().className).toContain('keycapNudge');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();

    fireEvent.animationEnd(squashTarget());
    expect(squashTarget().className).not.toContain('keycapNudge');

    act(() => vi.advanceTimersByTime(3300)); // 누적 4200ms
    expect(squashTarget().className).toContain('keycapNudge');
    expect(soundMock.playKeycapSound).not.toHaveBeenCalled();
  });

  it('시연 전에 누르면 남은 시연 타이머가 취소된다', () => {
    vi.useFakeTimers();
    renderKeycap(true);
    act(() => {
      fireEvent.pointerDown(keyButton());
      fireEvent.pointerUp(keyButton());
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(squashTarget().className).not.toContain('keycapNudge');
  });

  it('prefers-reduced-motion: 물결·자가 시연 없음, 배지는 표시, 소리는 유지', () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    renderKeycap(true);

    expect(ripple()).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(squashTarget().className).not.toContain('keycapNudge');
    expect(screen.getByText('눌러보기')).toBeInTheDocument();

    fireEvent.pointerDown(keyButton());
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/components/PressableKeycap.nudge.test.tsx`
Expected: FAIL (배지·물결 미구현)

- [ ] **Step 3: 유도 구현** — Task 5의 파일에 다음을 추가

state·effect 추가 (기존 마운트 effect를 대체):

```tsx
import AiKeycapBadge from '@/components/common/AiKeycapBadge';

// … 컴포넌트 안 …
const [nudgeActive, setNudgeActive] = useState(false);
const [reducedMotion, setReducedMotion] = useState(false);
const [demoPressing, setDemoPressing] = useState(false);

useEffect(() => {
  const stored = getStoredSwitchId();
  setSwitchId(stored);
  setMuted(getStoredMuted());
  warmKeycapSound(stored);
  // 유도는 마운트 후에만 켠다 — SSR 마크업(유도 없음)과 일치시키고,
  // 이미 눌러본 방문자에게 배지가 깜빡 떴다 사라지는 것도 막는다
  if (nudge && !getHasPressed()) setNudgeActive(true);
  if (typeof window.matchMedia === 'function') {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
}, [nudge]);

// 자가 시연 — 등장 0.9초·4.2초 뒤 각 1회 (프로토타입 튜닝값). 소리 없음(자동재생 정책상 못 냄)
useEffect(() => {
  if (!nudgeActive || reducedMotion) return;
  const timers = [900, 4200].map((ms) => window.setTimeout(() => setDemoPressing(true), ms));
  return () => timers.forEach(clearTimeout);
}, [nudgeActive, reducedMotion]);
```

`pressDown`에 유도 소멸 추가:

```tsx
const pressDown = () => {
  if (isDown) return;
  setIsDown(true);
  if (!muted) playKeycapSound(switchId, 'down');
  if (!getHasPressed()) markPressed();
  // 한 번이라도 누르면 유도 3종은 영구 소멸 (다음 방문 포함 — localStorage)
  setNudgeActive(false);
  setDemoPressing(false);
};
```

스쿼시 래퍼에 시연 애니메이션 클래스 + animationEnd:

```tsx
<div
  onAnimationEnd={() => setDemoPressing(false)}
  className={`origin-bottom motion-safe:transition-transform motion-safe:duration-[110ms] motion-safe:ease-[cubic-bezier(0.2,0.8,0.3,1)] ${
    isDown ? 'motion-safe:scale-y-[0.9] motion-safe:scale-x-[1.04]' : ''
  } ${demoPressing ? 'motion-safe:animate-[keycapNudge_380ms_cubic-bezier(0.2,0.8,0.3,1)]' : ''}`}
>
  {children}
</div>
```

버튼 안(스쿼시 래퍼 뒤)에 물결, 버튼 밖(relative div 안)에 배지:

```tsx
{/* 물결 — 첫 누름까지 계속. reduced-motion이면 정지된 원만 남으니 아예 렌더하지 않는다 */}
{nudgeActive && !reducedMotion && (
  <span
    aria-hidden
    data-testid="keycap-ripple"
    className="absolute left-1/2 top-1/2 -ml-12 -mt-12 w-24 h-24 rounded-full border-[3px] border-white/95 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.18),inset_0_0_0_1px_rgba(0,0,0,0.18)] animate-[keycapRipple_1.9s_ease-out_infinite]"
  />
)}
```

```tsx
{/* 바깥 div가 중앙 정렬, 안쪽 배지가 둥둥 — 같은 요소에 두 transform을 걸면
    badgeFloat의 translateY가 정렬 translateX를 덮어써 왼쪽으로 튕겨나간다 (제약 4) */}
{nudgeActive && (
  <div className="absolute left-1/2 bottom-3 -translate-x-1/2 pointer-events-none">
    <AiKeycapBadge label="눌러보기" floating />
  </div>
)}
```

- [ ] **Step 4: 전체 키캡 테스트 통과 확인**

Run: `npx vitest run tests/components/PressableKeycap.test.tsx tests/components/PressableKeycap.nudge.test.tsx`
Expected: PASS (전부) — Task 5 테스트가 깨지면 회귀

- [ ] **Step 5: 커밋**

```bash
git add src/components/domain/PressableKeycap.tsx tests/components/PressableKeycap.nudge.test.tsx
git commit -m "feat(keycap): 유도 3종(자가 시연·물결·배지) — 첫 누름 시 영구 소멸"
```

---

### Task 7: 결과 화면(`FigurineCreator`) 적용

**Files:**
- Modify: `src/components/domain/FigurineCreator.tsx:227-235` (결과 섹션)
- Test: `tests/components/FigurineCreator.keycap.test.tsx`

**Interfaces:**
- Consumes: `PressableKeycap` (Task 5·6)
- Produces: 없음 (말단)

- [ ] **Step 1: 실패하는 테스트 작성** (mock 세팅은 기존 `tests/components/FigurineCreator.test.tsx` 상단부와 동일 — 그 파일을 열어 hookState 패턴을 그대로 복사하고, 아래처럼 `keycapSound` mock을 추가)

```tsx
// tests/components/FigurineCreator.keycap.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FigurineJob, User } from '@/types/api';
import type { FigurinePhase } from '@/hooks/useFigurineJob';

const { hookState, routerMock, authMock, preloadMock, soundMock } = vi.hoisted(() => ({
  hookState: {
    job: null as FigurineJob | null,
    phase: 'idle' as FigurinePhase,
    errorMessage: null as string | null,
    start: vi.fn(),
    publish: vi.fn(),
    reset: vi.fn(),
  },
  routerMock: { push: vi.fn() },
  authMock: { user: { nickname: '집사' } as unknown as User, loading: false },
  preloadMock: { preloadImage: vi.fn() },
  soundMock: { playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useFigurineJob', () => ({ useFigurineJob: () => hookState }));
vi.mock('@/lib/preloadImage', () => ({ preloadImage: preloadMock.preloadImage }));
vi.mock('@/lib/keycapSound', () => soundMock);

import FigurineCreator from '@/components/domain/FigurineCreator';

describe('FigurineCreator — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    hookState.phase = 'completed';
    hookState.job = {
      jobId: 1, status: 'COMPLETED',
      resultImageUrl: 'https://cdn/results/1.png',
      failReason: null, petPostId: null,
    };
    preloadMock.preloadImage.mockResolvedValue(undefined);
  });

  it('완성 이미지가 PressableKeycap(유도 포함)으로 감싸인다', async () => {
    render(<FigurineCreator />);
    const keyButton = await screen.findByRole('button', { name: '키캡 누르기' });
    expect(keyButton).toContainElement(screen.getByAltText('완성된 AI 키캡 피규어'));
    // 결과 화면은 유도 있음 (기획 확정)
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
  });

  it('축 칩바가 이미지 아래·CTA 위에 온다 (기획 확정 순서)', async () => {
    render(<FigurineCreator />);
    const chip = await screen.findByRole('button', { name: '갈축' });
    const cta = screen.getByRole('button', { name: '자랑 피드에 게시하기' });
    // DOM 순서: 칩이 CTA보다 앞
    expect(chip.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/components/FigurineCreator.keycap.test.tsx`
Expected: FAIL (키캡 버튼 없음)

- [ ] **Step 3: FigurineCreator 수정** — 결과 섹션의 `<img>`(227~235행 부근)를 래핑

```tsx
import PressableKeycap from '@/components/domain/PressableKeycap';
```

```tsx
{(phase === 'posting' || phase === 'posted' || (phase === 'completed' && revealReady)) && job?.resultImageUrl && (
  <section className="mt-6 animate-[fadeIn_0.5s_ease-out]">
    <PressableKeycap nudge>
      {/* eslint-disable-next-line @next/next/no-img-element -- 방금 생성된 결과라 Lambda 썸네일이 없을 수 있어 원본을 직접 표시 */}
      <img
        src={job.resultImageUrl}
        alt="완성된 AI 키캡 피규어"
        decoding="async"
        className="w-full rounded-2xl"
      />
    </PressableKeycap>
    {/* 이하 버튼 3개는 그대로 — 칩바는 PressableKeycap이 이미지 바로 아래에 렌더한다 */}
```

기존 `<img>`를 감싸기만 하고 버튼들은 건드리지 않는다.

- [ ] **Step 4: 신규 + 기존 테스트 통과 확인**

Run: `npx vitest run tests/components/FigurineCreator.keycap.test.tsx tests/components/FigurineCreator.test.tsx tests/components/FigurineCreator.share.test.tsx`
Expected: PASS — 기존 FigurineCreator 테스트가 깨지면 회귀 (결과 화면 구조 검증 테스트가 있는지 확인하고, 래퍼 추가로 깨진 단순 구조 assertion은 새 구조에 맞게 갱신하되 의도가 바뀌지 않게)

- [ ] **Step 5: 커밋**

```bash
git add src/components/domain/FigurineCreator.tsx tests/components/FigurineCreator.keycap.test.tsx
git commit -m "feat(keycap): 결과 화면에 키캡 누르기 적용 — 유도 포함"
```

---

### Task 8: 공유 페이지(`/figurines/share`) 적용

**Files:**
- Modify: `src/app/figurines/share/page.tsx:52`
- Test: `tests/app/figurineShare.keycap.test.tsx`

**Interfaces:**
- Consumes: `PressableKeycap`. **share 페이지는 서버 컴포넌트** — `PressableKeycap`('use client')이 클라이언트 경계가 되고, `DetailImage`는 children 슬롯으로 넘긴다 (스펙 제약 5)
- Produces: 없음 (말단)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/app/figurineShare.keycap.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
const soundMock = vi.hoisted(() => ({ playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() }));
vi.mock('@/lib/keycapSound', () => soundMock);

import FigurineSharePage from '@/app/figurines/share/page';

const VALID_IMG = 'https://images.jipsamoye.com/posts/8/result.png';
const props = { searchParams: Promise.resolve({ img: VALID_IMG }) };

describe('공유 페이지 — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('DetailImage가 PressableKeycap(유도 포함)으로 감싸인다', async () => {
    render(await FigurineSharePage(props));
    const keyButton = screen.getByRole('button', { name: '키캡 누르기' });
    expect(keyButton).toContainElement(screen.getByAltText('AI 키캡 피규어'));
    expect(screen.getByText('눌러보기')).toBeInTheDocument();
  });

  it('DetailImage 썸네일→원본 폴백이 래핑 후에도 살아 있다 (스펙 제약 5)', async () => {
    render(await FigurineSharePage(props));
    fireEvent.error(screen.getByAltText('AI 키캡 피규어'));
    expect(screen.getByAltText('AI 키캡 피규어')).toHaveAttribute('src', VALID_IMG);
  });

  it('키캡을 누르면 소리가 나고, 칩바가 CTA("나도 만들어보기") 위에 있다', async () => {
    render(await FigurineSharePage(props));
    fireEvent.pointerDown(screen.getByRole('button', { name: '키캡 누르기' }));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');

    const chip = screen.getByRole('button', { name: '갈축' });
    const cta = screen.getByRole('link', { name: '나도 만들어보기' });
    expect(chip.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/app/figurineShare.keycap.test.tsx`
Expected: FAIL

- [ ] **Step 3: share 페이지 수정** — `DetailImage` 한 줄(52행)을 래핑

```tsx
import PressableKeycap from '@/components/domain/PressableKeycap';
```

```tsx
{/* 원본(1024 PNG, ~1.3MB) 대신 800 웹피 썸네일(~35KB) 우선 — 생성 직후 썸네일이 없으면 DetailImage가 원본으로 폴백 */}
<PressableKeycap nudge className="mt-6">
  <DetailImage src={imageUrl} alt="AI 키캡 피규어" loading="eager" className="w-full rounded-2xl" />
</PressableKeycap>
```

(`mt-6`을 래퍼로 옮기고 이미지의 나머지 클래스는 유지)

- [ ] **Step 4: 신규 + 기존 share 테스트 통과 확인**

Run: `npx vitest run tests/app/figurineShare.keycap.test.tsx tests/app/figurineShare.test.tsx`
Expected: PASS — 기존 `figurineShare.test.tsx`의 썸네일·폴백·notFound 케이스가 전부 살아 있어야 한다

- [ ] **Step 5: 커밋**

```bash
git add src/app/figurines/share/page.tsx tests/app/figurineShare.keycap.test.tsx
git commit -m "feat(keycap): 공유 페이지에 키캡 누르기 적용 — DetailImage 폴백 보존"
```

---

### Task 9: 게시글 상세(`/posts/[id]`) 적용 — 유도 없음

**Files:**
- Modify: `src/app/posts/[id]/page.tsx:184-198` (이미지 나열 블록)
- Test: `tests/app/postDetailKeycap.test.tsx`

**Interfaces:**
- Consumes: `PressableKeycap`, 기존 `isAiKeycapPost` (판별 로직 신설 금지 — 스펙: "배지가 보이는 이미지 = 눌리는 이미지")
- Produces: 없음 (말단)

- [ ] **Step 1: 실패하는 테스트 작성** (mock 패턴은 `tests/app/postDetailShare.test.tsx`를 그대로 따른다)

```tsx
// tests/app/postDetailKeycap.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { PetPost, User } from '@/types/api';

const { routerMock, apiMock, authMock, soundMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  soundMock: { playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useOpenDm', () => ({ useOpenDm: () => vi.fn() }));
vi.mock('@/lib/keycapSound', () => soundMock);
vi.mock('@/components/common/Avatar', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/PostCard', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/CommentSection', () => ({ default: () => <div /> }));

import PostDetailPage from '@/app/posts/[id]/page';

const basePost: PetPost = {
  id: 7,
  title: 'AI 키캡 자랑',
  content: '자랑합니다',
  imageUrls: [
    'https://images.jipsamoye.com/posts/7/1.png',
    'https://images.jipsamoye.com/posts/7/2.png',
  ],
  likeCount: 3,
  commentCount: 0,
  nickname: '집사',
  profileImageUrl: null,
  createdAt: '2026-08-08T10:00:00',
  updatedAt: '2026-08-08T10:00:00',
  isLiked: false,
  aiGenerated: true,
};

async function renderPage(post: PetPost) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === `/api/posts/${post.id}`) return Promise.resolve({ data: post });
    return Promise.resolve({ data: { content: [] } });
  });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PostDetailPage params={Promise.resolve({ id: String(post.id) })} />
      </Suspense>,
    );
  });
  await screen.findByText('자랑합니다');
}

describe('게시글 상세 — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('AI 키캡 글: 첫 이미지만 눌리고 두 번째는 그대로다', async () => {
    await renderPage(basePost);
    const keyButtons = screen.getAllByRole('button', { name: '키캡 누르기' });
    expect(keyButtons).toHaveLength(1);
    expect(keyButtons[0]).toContainElement(screen.getByAltText('AI 키캡 자랑 1'));
    expect(keyButtons[0]).not.toContainElement(screen.getByAltText('AI 키캡 자랑 2'));
  });

  it('누르면 소리가 난다 — 동작은 결과 화면과 동일', async () => {
    await renderPage(basePost);
    fireEvent.pointerDown(screen.getByRole('button', { name: '키캡 누르기' }));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');
  });

  it('유도는 아예 없다 — 눌러보기 배지·물결 없음, 기존 AI 키캡 배지는 유지', async () => {
    await renderPage(basePost);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(document.querySelector('[data-testid="keycap-ripple"]')).toBeNull();
    expect(screen.getByText('AI 키캡')).toBeInTheDocument();
  });

  it('일반 글(aiGenerated=false): 아무 것도 안 바뀐다', async () => {
    await renderPage({ ...basePost, id: 8, title: '우리집 고양이', aiGenerated: false });
    expect(screen.queryByRole('button', { name: '키캡 누르기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '갈축' })).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/app/postDetailKeycap.test.tsx`
Expected: FAIL

- [ ] **Step 3: 페이지 수정** — 이미지 나열 블록(184~198행)을 다음으로 교체

```tsx
import PressableKeycap from '@/components/domain/PressableKeycap';
```

```tsx
{/* 이미지 (세로 나열) — AI 키캡 글의 첫 이미지만 눌린다. 배지가 보이는 이미지 = 눌리는 이미지 */}
<div className="flex flex-col gap-2 mb-6">
  {post.imageUrls.map((url, i) => (
    <div key={i} className="relative">
      {i === 0 && isAiKeycapPost(post) ? (
        <PressableKeycap>
          <DetailImage
            src={url}
            alt={`${post.title} ${i + 1}`}
            loading="eager"
            className="w-full rounded-2xl object-cover"
          />
        </PressableKeycap>
      ) : (
        <DetailImage
          src={url}
          alt={`${post.title} ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          className="w-full rounded-2xl object-cover"
        />
      )}
      {i === 0 && isAiKeycapPost(post) && (
        <AiKeycapBadge className="absolute top-4 left-4 pointer-events-none" />
      )}
    </div>
  ))}
</div>
```

주의: 기존 배지에 `pointer-events-none`을 추가한다 — 배지가 이제 버튼 위에 떠 있으므로 그 영역의 누름을 막지 않게. `nudge`는 넘기지 않는다(기본 false — 상세는 유도 없음이 기획 확정).

- [ ] **Step 4: 신규 + 기존 상세 테스트 통과 확인**

Run: `npx vitest run tests/app/postDetailKeycap.test.tsx tests/app/postDetailShare.test.tsx tests/app/aiGenerated-forward-compat.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "src/app/posts/[id]/page.tsx" tests/app/postDetailKeycap.test.tsx
git commit -m "feat(keycap): 게시글 상세 첫 이미지에 키캡 누르기 적용 — 유도 없음"
```

---

### Task 10: 전체 검증 — 테스트 스위트 · 프로덕션 빌드 · 수동 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 스위트**

Run: `npx vitest run`
Expected: 전부 PASS — 베이스라인 776개 + 신규 (이 계획 기준 약 45개)

- [ ] **Step 2: 프로덕션 빌드** (CLAUDE.md 필수 — Vercel prerender 실패 예방)

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과. share 페이지(서버 컴포넌트 + 클라이언트 경계)가 여기서 깨질 수 있는 1순위 — 실패 시 `PressableKeycap`의 'use client' 선언과 import 경로부터 확인

- [ ] **Step 3: 수동 확인 (dev 서버)**

```bash
npm run dev
```
- `/figurines/new` → 생성 완료 화면: 자가 시연(0.9s·4.2s)·물결·눌러보기 배지 → 한 번 누르면 셋 다 소멸, 새로고침해도 안 뜸
- 축 칩 7개: 클릭 시 프리뷰(down→130ms→up), 선택 유지(새로고침 후에도), 모바일 뷰포트(375px)에서 두 줄 줄바꿈·가로 스크롤 없음
- 음소거 토글 후 누르면 스쿼시만 되고 소리 없음
- `/figurines/share?img=...` → 동일 + "나도 만들어보기" CTA가 칩 아래
- AI 키캡 게시글 상세 → 첫 이미지 눌림, 유도 없음, "AI 키캡" 배지 그대로
- 제이드 연타 → 소리 겹침이 거슬리지 않는지 (Task 1 트림 결과 최종 확인)

- [ ] **Step 4: 마무리 커밋 (수동 확인 중 수정이 있었으면)**

수정 사항이 있으면 해당 테스트와 함께 커밋. push는 사용자 확인 후 — push 시 `npx next build` 재확인, 머지 후 Vercel 배포 확인까지 (CLAUDE.md).

---

## Self-Review 결과 (계획 작성 세션에서 수행)

- **스펙 커버리지:** 확정 결정 표 15개 항목 모두 태스크에 반영 — 적용 3곳(T7·8·9), 스쿼시(T5), 축 선택·기본 갈축(T2·4), 소리 기본 켜짐+음소거(T4·5), 칩 줄바꿈(T4), 유도 C안+상세 제외(T6·9), 햅틱 제외(T5 구현에 vibrate 없음), 볼륨 그대로(T3 — gain 노드 없이 destination 직결), 공유 링크 불변(어떤 태스크도 figurineShare.ts를 건드리지 않음), 배지 재사용(T6), localStorage만(T2), 접근성 3종(T5 키보드·T6 reduced-motion·T4 음소거 가시성), kbsim 고지(T1), 제약 4 배지 정렬(T6), 제약 5 children 래퍼(T5·8)
- **열린 항목 처리:** 제이드 252ms → T1에서 트림+청취, 공유 페이지 칩 전환율 → 계획 범위 밖(배포 후 계측 — 스펙에 이미 기록됨)
- **타입 일관성:** `KeycapSwitchId`·`keycapSoundUrl`·`playKeycapSound`·`warmKeycapSound`·`PressableKeycapProps` 시그니처가 태스크 간 일치함을 재확인
- **주의:** Task 7 Step 4에서 기존 FigurineCreator 테스트 중 결과 섹션 DOM 구조를 검증하는 케이스가 래퍼 추가로 깨질 수 있다 — assertion의 의도를 보존하며 갱신할 것
