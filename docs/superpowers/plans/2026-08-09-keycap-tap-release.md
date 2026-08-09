# 키캡 탭 릴리즈 애니메이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 맥북 탭 투 클릭·모바일 빠른 탭처럼 pointerdown→pointerup이 수 ms 간격으로 와도 키캡의 눌림→복귀가 항상 보이게 한다 (현재는 소리만 나고 시각 효과 없음).

**Architecture:** 근본 원인은 스쿼시가 CSS transition으로만 구동된다는 것 — 탭에서는 down/up 사이에 렌더 프레임이 없어 트랜지션이 아예 생성되지 않는다. 해법은 `pressUp`마다 "눌린 transform → 원위치" **키프레임 애니메이션**을 1회 재생하는 것(애니메이션은 재계산 이력과 무관하게 0% 키프레임에서 시작). 긴 누름에서는 0%가 현재 스쿼시 값과 동일해 기존 촉감과 시각적으로 무차별. 연타 재시작을 위해 내용이 같은 키프레임 2개를 이름 교대로 쓴다.

**Tech Stack:** Next.js 15 + Tailwind v4 (임의값 `animate-[...]`), Vitest + RTL(jsdom). 새 의존성 없음.

**설계 리뷰 결정 (Opus 검토 에이전트, 재논의 금지):**
- "최소 눌림 시간 보장(타이머)" 안은 기각 — AV 동기 결함(up음과 시각 복귀 최대 120ms+ 어긋남), 연타 병합, 타이머 위험 4종
- 릴리즈 키프레임 0% 값은 현재 스쿼시 값 그대로 — **오버슛·duration 조정 등 느낌 튜닝 금지** (사용자가 이전 느낌 변경을 revert한 이력)
- `pointercancel`(스크롤)로 끝난 누름은 릴리즈를 재생하지 않는다 (잔류 시각 효과 0)
- 키프레임 이름 교대(`keycapRelease`/`keycapReleaseAlt`)로 연타 시 결정적 재시작

## Global Constraints

- 테스트 없이 커밋 불가 — TDD (Red→Green 증거)
- push 전 `npx next build` "Generating static pages"까지 통과 (CLAUDE.md)
- `any` 사용 금지, 새 npm 의존성 금지
- 소리 타이밍 절대 불변 — down음은 pointerdown 즉시, up음은 pointerup 즉시 (이 계획은 시각만 바꾼다)
- `isDown` 시맨틱 불변 — 기존 테스트(pointerup 직후 `scale-y-[0.9]` 제거 등)는 수정 없이 통과해야 함
- reduced-motion: 릴리즈 애니메이션 없음(소리는 유지) — CSS `motion-safe:` + JS 가드 이중
- 릴리즈 duration `150ms`, 이징 `cubic-bezier(0.2,0.8,0.3,1)` (스쿼시와 동일 곡선)

---

### Task 1: 릴리즈 키프레임 2개 + CSS 가드 테스트

**Files:**
- Modify: `src/app/globals.css` (`@keyframes keycapNudge` 블록 뒤, 214행 부근 — `keycapRipple` 앞)
- Test: `tests/app/keycap-css.test.ts` (기존 describe 안에 케이스 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `@keyframes keycapRelease`, `@keyframes keycapReleaseAlt` — Task 2의 `animate-[keycapRelease_150ms_...]`/`animate-[keycapReleaseAlt_150ms_...]` 클래스가 이 이름에 의존. Tailwind 임의값 애니메이션은 키프레임이 없어도 빌드가 통과하므로 이 가드 테스트가 유일한 회귀 방어다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/app/keycap-css.test.ts`의 describe 블록 안(기존 keycapRipple 케이스 뒤)에 추가:

```ts
  // 이름 교대 재시작용 쌍둥이 키프레임 — 내용이 갈라지면 연타 시 두 번째 릴리즈만 모양이 달라진다
  const keyframeBody = (name: string) => {
    const m = css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
    return (m?.[1] ?? '').trim();
  };

  it('keycapRelease — 0%가 스쿼시 값(scaleY .9, scaleX 1.04), 100%가 원위치', () => {
    const body = keyframeBody('keycapRelease');
    expect(body).toContain('scaleY(0.9)');
    expect(body).toContain('scaleX(1.04)');
    expect(body).toContain('scaleY(1)');
  });

  it('keycapReleaseAlt — keycapRelease와 내용이 동일하다 (연타 교대 재시작용)', () => {
    const alt = keyframeBody('keycapReleaseAlt');
    expect(alt).not.toBe('');
    expect(alt).toBe(keyframeBody('keycapRelease'));
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/app/keycap-css.test.ts`
Expected: FAIL (2건 — 키프레임 없음)

- [ ] **Step 3: globals.css에 키프레임 추가** — `@keyframes keycapNudge` 블록 바로 아래:

```css
/* 키캡 누르기 — 뗄 때 재생하는 릴리즈. 탭처럼 짧은 누름에서는 down/up 사이에 렌더
   프레임이 없어 트랜지션이 아예 생성되지 않으므로, 키프레임으로 "눌림→복귀"를 보장한다.
   내용이 같은 키프레임이 두 개인 이유: 연타 시 animation-name을 교대해 확실히 재시작. */
@keyframes keycapRelease {
  0%   { transform: scaleY(0.9) scaleX(1.04); }
  100% { transform: scaleY(1) scaleX(1); }
}

@keyframes keycapReleaseAlt {
  0%   { transform: scaleY(0.9) scaleX(1.04); }
  100% { transform: scaleY(1) scaleX(1); }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/app/keycap-css.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/globals.css tests/app/keycap-css.test.ts
git commit -m "feat(keycap): 릴리즈 키프레임 2종 추가 — 탭에서도 눌림이 보이게 할 기반"
```

---

### Task 2: PressableKeycap 릴리즈 배선

**Files:**
- Modify: `src/components/domain/PressableKeycap.tsx` (상태 ~32행, `pressUp` 76-82행, 스쿼시 래퍼 127-131행)
- Test: `tests/components/PressableKeycap.test.tsx` (파일 끝 describe 안에 케이스 추가)

**Interfaces:**
- Consumes: Task 1의 키프레임 이름 `keycapRelease`/`keycapReleaseAlt` (정확히 이 철자)
- Produces: 없음 (말단). 기존 `isDown`·`demoPressing`·`pressUp(cancelled)` 시맨틱은 변경 금지

**주의:** `'keycapRelease'`는 `'keycapReleaseAlt'`의 부분 문자열이다 — 단언·분기에서 구분이 필요하면 `keycapRelease_150ms`/`keycapReleaseAlt_150ms`(클래스) 또는 완전 일치 비교(`animationName`)를 쓸 것.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/components/PressableKeycap.test.tsx`의 describe 마지막에 추가:

```tsx
  it('탭(즉시 down→up)에도 릴리즈 애니메이션이 재생돼 눌림→복귀가 보인다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    // 트랜지션은 렌더 프레임이 없으면 생성되지 않으므로 키프레임으로 보장
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapRelease' });
    expect(squashTarget().className).not.toContain('keycapRelease');
  });

  it('pointercancel로 끝난 누름은 릴리즈를 재생하지 않는다 (스크롤 잔류 방지)', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerCancel(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
  });

  it('pointerleave·blur·Space 종료도 릴리즈를 재생한다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerLeave(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapRelease' });

    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.blur(keyButton());
    expect(squashTarget().className).toContain('keycapReleaseAlt_150ms');
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapReleaseAlt' });

    fireEvent.keyDown(keyButton(), { key: ' ' });
    fireEvent.keyUp(keyButton(), { key: ' ' });
    expect(squashTarget().className).toContain('keycapRelease_150ms');
  });

  it('연타: 릴리즈 진행 중 다음 탭은 다른 키프레임 이름으로 재시작된다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');

    // 애니메이션이 끝나기 전 두 번째 탭 — down 동안은 릴리즈가 꺼지고(스쿼시가 우선),
    fireEvent.pointerDown(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
    // up에서 다른 이름으로 재생 → 같은 프레임에 갈아끼워져도 브라우저가 확실히 재시작
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapReleaseAlt_150ms');
  });

  it('animationEnd 분기: keycapNudge가 끝나도 릴리즈 상태를 건드리지 않는다', () => {
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).toContain('keycapRelease_150ms');
    // 다른 애니메이션의 end가 릴리즈를 끄면 안 된다
    fireEvent.animationEnd(squashTarget(), { animationName: 'keycapNudge' });
    expect(squashTarget().className).toContain('keycapRelease_150ms');
  });

  it('reduced-motion: 릴리즈 클래스가 붙지 않고 소리는 그대로 난다', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderKeycap();
    fireEvent.pointerDown(keyButton());
    fireEvent.pointerUp(keyButton());
    expect(squashTarget().className).not.toContain('keycapRelease');
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'up');
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/components/PressableKeycap.test.tsx`
Expected: FAIL (신규 6건 실패, 기존 케이스는 전부 통과 유지)

- [ ] **Step 3: 구현** — `src/components/domain/PressableKeycap.tsx`에 다음 네 곳 수정:

(1) 상태 추가 — `demoPressing` 선언(32행) 아래:

```tsx
  // 뗄 때 재생하는 릴리즈 애니메이션 카운터. 0이면 없음, 홀짝으로 키프레임 이름을 교대해
  // 연타 시에도 확실히 재시작시킨다. 탭처럼 짧은 누름에서는 트랜지션이 생성되지 않기 때문.
  const [releaseTick, setReleaseTick] = useState(0);
```

(2) `pressUp` — `markPressed` 줄 아래에 추가 (pressDown은 건드리지 않는다 — tick을 리셋하면 홀짝 교대가 깨진다):

```tsx
    // 시각 릴리즈 — cancelled(스크롤)면 재생하지 않고, reduced-motion이면
    // 애니메이션이 실행되지 않아 animationend가 안 와 상태가 갇히므로 JS에서도 가드
    if (!cancelled && !reducedMotion) setReleaseTick((n) => n + 1);
```

(3) `onAnimationEnd`(128행) — animationName 분기로 교체:

```tsx
            onAnimationEnd={(e) => {
              if (e.animationName === 'keycapNudge') setDemoPressing(false);
              else if (e.animationName === 'keycapRelease' || e.animationName === 'keycapReleaseAlt')
                setReleaseTick(0);
            }}
```

(4) 스쿼시 래퍼 클래스(129-131행) — 마지막 `${demoPressing ? ... : ''}` 부분을 삼항 체인으로 교체 (같은 요소에 `animate-[...]`가 둘 붙으면 animation 단축 선언이 충돌하므로 배타 처리, 눌린 동안(`isDown`)은 릴리즈를 끄고 스쿼시 transform이 우선):

```tsx
            } ${
              demoPressing
                ? 'motion-safe:animate-[keycapNudge_380ms_cubic-bezier(0.2,0.8,0.3,1)]'
                : !isDown && releaseTick > 0
                  ? releaseTick % 2
                    ? 'motion-safe:animate-[keycapRelease_150ms_cubic-bezier(0.2,0.8,0.3,1)]'
                    : 'motion-safe:animate-[keycapReleaseAlt_150ms_cubic-bezier(0.2,0.8,0.3,1)]'
                  : ''
            }`}
```

- [ ] **Step 4: 신규 + 기존 키캡 테스트 전부 통과 확인**

Run: `npx vitest run tests/components/PressableKeycap.test.tsx tests/components/PressableKeycap.nudge.test.tsx`
Expected: PASS 전부 — 기존 단언(pointerup 직후 `scale-y-[0.9]` 제거, cancel 미기록, blur 해제 등)이 수정 없이 통과해야 isDown 시맨틱 보존이 증명된다. 하나라도 기존 케이스가 깨지면 구현이 시맨틱을 침범한 것.

- [ ] **Step 5: 커밋**

```bash
git add src/components/domain/PressableKeycap.tsx tests/components/PressableKeycap.test.tsx
git commit -m "fix(keycap): 뗄 때 릴리즈 키프레임 재생 — 탭 투 클릭·빠른 탭에서도 눌림이 보이게"
```

---

### Task 3: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 스위트 + 타입 체크**

Run: `npx vitest run` → 기대: 전부 PASS (베이스라인 841 + 신규 8)
Run: `npx tsc --noEmit` → 기대: 무출력

- [ ] **Step 2: 프로덕션 빌드**

Run: `npx next build`
Expected: "Generating static pages"까지 통과

- [ ] **Step 3: 브라우저 실측 (탭 재현)**

```bash
npx next dev -p 3100
```

Chrome에서 `http://localhost:3100/figurines/share?img=https%3A%2F%2Fimages.jipsamoye.com%2Fposts%2F176%2F3b95b6bc-6fc8-48bf-b35f-1c5ec7a5fcb8.png` 열고, DevTools 콘솔에서 탭 투 클릭을 재현(같은 태스크에서 down→up 연속 발화):

```js
const b = document.querySelector('button[aria-label="키캡 누르기"]');
const t = b.querySelector('div'); // 스쿼시 래퍼
b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
t.className.includes('keycapRelease'); // → true 여야 함
```

추가로 `getComputedStyle(t).animationName`이 `keycapRelease`(또는 Alt)로 잡히는지, 눈으로 이미지가 눌렸다 올라오는 게 보이는지 확인. jsdom은 페인트가 없어 단위 테스트로는 "실제로 보이는가"를 증명할 수 없으므로 이 실측이 필수다.

- [ ] **Step 4: 서버 정리**

dev 서버 종료 (`lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`).
머지 후 사용자 실기기 확인 항목으로 남길 것: 맥북 탭 투 클릭, iOS 빠른 탭, 게시글 상세 이미지 위 스크롤(릴리즈 잔류 없음).

---

## Self-Review 결과

- **설계 커버리지:** 승인 설계의 4개 변경(키프레임 2개·releaseTick·animationEnd 분기·클래스 체인) 모두 태스크에 반영. cancel 미재생·reduced-motion 이중 가드·이름 교대 재시작·isDown 시맨틱 보존 전부 테스트로 잠김
- **설계 대비 수정 1건:** 승인 설계의 "pressDown에서 tick을 0으로 리셋"은 홀짝 교대를 깨는 결함(항상 0→1이 되어 같은 이름만 재생)이라, "pressDown은 tick을 건드리지 않고 클래스 조건에 `!isDown`을 넣어 눌린 동안만 끈다"로 정정했다. 시각 결과는 동일하고 교대가 실제로 동작한다
- **타입 일관성:** `releaseTick: number`, `pressUp(cancelled = false)` 시그니처 불변, 키프레임 이름 철자 3곳(CSS·클래스·animationName 분기) 일치 확인
