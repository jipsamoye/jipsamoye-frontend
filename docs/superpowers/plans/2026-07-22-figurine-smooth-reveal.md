# 키캡 피규어 결과 이미지 부드러운 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키캡 피규어 완성 시 결과 이미지를 프리로드 완료 후 페이드인으로 부드럽게 표시한다.

**Architecture:** `preloadImage` 유틸(신규)이 이미지 로드+디코딩을 캐시에 선행하고, `FigurineCreator`는 `phase === 'completed'`여도 프리로드가 끝날 때까지 기존 스피너를 유지하다가 결과 섹션을 페이드인 마운트한다. `useFigurineJob` 상태 머신은 변경하지 않는다.

**Tech Stack:** Next.js 15, React, Tailwind CSS v4(설정 파일 없음 — `animate-[...]` arbitrary + globals.css keyframes 관례), Vitest + Testing Library (jsdom).

## Global Constraints

- `any` 사용 금지, API 응답 타입 명시 (CLAUDE.md)
- 컴포넌트에서 직접 fetch 금지 — 이 작업은 fetch 추가 없음
- 커밋 전 반드시 테스트 통과, push 전 `npx next build` 통과 (CLAUDE.md)
- 애니메이션 관례: `@keyframes`는 `src/app/globals.css`, 사용은 `animate-[name_dur_ease]` (Toast.tsx 참고)
- 결과 이미지는 `DetailImage`(썸네일 시도) 대신 원본 URL `<img>` 직접 표시 — 방금 생성돼 Lambda 썸네일 부재 가능

---

### Task 1: `preloadImage` 유틸

**Files:**
- Create: `src/lib/preloadImage.ts`
- Test: `tests/lib/preloadImage.test.ts`

**Interfaces:**
- Produces: `preloadImage(url: string, timeoutMs?: number): Promise<void>` — 항상 resolve (성공/실패/타임아웃 무관). `PRELOAD_TIMEOUT_MS = 8_000` export.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/lib/preloadImage.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preloadImage, PRELOAD_TIMEOUT_MS } from '@/lib/preloadImage';

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  decode = vi.fn(() => Promise.resolve());
  constructor() {
    FakeImage.instances.push(this);
  }
}

const lastImage = () => FakeImage.instances[FakeImage.instances.length - 1];

describe('preloadImage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeImage.instances = [];
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('로드 + 디코딩 완료 시 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    expect(lastImage().src).toBe('https://cdn/results/1.png');
    lastImage().onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('decode 실패해도 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    lastImage().decode.mockRejectedValueOnce(new Error('decode fail'));
    lastImage().onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('로드 실패(onerror) 시에도 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    lastImage().onerror?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('onload/onerror가 안 와도 타임아웃 후 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    vi.advanceTimersByTime(PRELOAD_TIMEOUT_MS);
    await expect(p).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/lib/preloadImage.test.ts` / Expected: FAIL (`@/lib/preloadImage` 모듈 없음)

- [ ] **Step 3: 최소 구현** — `src/lib/preloadImage.ts`

```ts
export const PRELOAD_TIMEOUT_MS = 8_000;

/**
 * 이미지를 브라우저 캐시에 미리 로드한다.
 *
 * 화면 전환 트리거 용도라 실패·타임아웃에도 resolve한다 — 호출부는 완료를 기다렸다가
 * 전환만 하면 되고, 실제 표시는 <img>가 담당한다(캐시 히트 시 즉시 그려짐).
 */
export function preloadImage(url: string, timeoutMs: number = PRELOAD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    const img = new Image();
    img.onload = () => {
      // 디코딩까지 끝내야 마운트 시 페인트가 끊기지 않는다. decode 미지원/실패 시에도 전환은 진행.
      if (typeof img.decode === 'function') {
        img.decode().then(done, done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/lib/preloadImage.test.ts` / Expected: 4 passed
- [ ] **Step 5: 커밋** — `git add src/lib/preloadImage.ts tests/lib/preloadImage.test.ts && git commit -m "feat(figurine): preloadImage 유틸 추가 (로드+디코딩 선행, 항상 resolve)"`

---

### Task 2: FigurineCreator 프리로드 게이트 + 페이드인

**Files:**
- Modify: `src/components/domain/FigurineCreator.tsx`
- Modify: `src/app/globals.css` (fadeIn keyframes 추가)
- Test: `tests/components/FigurineCreator.test.tsx`

**Interfaces:**
- Consumes: `preloadImage(url: string): Promise<void>` (Task 1)
- Produces: 화면 동작 — `completed` && 프리로드 미완 → 스피너 유지; 프리로드 완료 → 결과 섹션 `animate-[fadeIn_0.5s_ease-out]` 마운트; `posting`/`posted`는 즉시 표시(이미 공개된 상태).

- [ ] **Step 1: 테스트 수정+추가** — `tests/components/FigurineCreator.test.tsx`

`vi.hoisted`에 `preloadMock: { preloadImage: vi.fn() }` 추가, mock 등록:

```ts
vi.mock('@/lib/preloadImage', () => ({ preloadImage: preloadMock.preloadImage }));
```

`beforeEach`에 `preloadMock.preloadImage.mockResolvedValue(undefined);` 추가.

기존 `completed:` 테스트를 async로 변경 (프리로드 resolve 후 표시되므로):

```ts
it('completed: 프리로드 완료 후 결과 이미지 + 게시/다시 만들기 버튼을 렌더한다', async () => {
  hookState.phase = 'completed';
  hookState.job = completedJob();
  render(<FigurineCreator />);

  expect(await screen.findByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
  expect(preloadMock.preloadImage).toHaveBeenCalledWith('https://cdn/results/1.png');
  expect(screen.getByText('자랑 피드에 게시하기')).toBeEnabled();
  expect(screen.getByText('다른 사진으로 다시 만들기')).toBeEnabled();
});
```

기존 `게시 클릭:` 테스트도 클릭 전 `await screen.findByText('자랑 피드에 게시하기')`로 변경:

```ts
it('게시 클릭: publish 성공 시 게시글로 이동한다', async () => {
  hookState.phase = 'completed';
  hookState.job = completedJob();
  hookState.publish.mockResolvedValueOnce(77);
  render(<FigurineCreator />);

  fireEvent.click(await screen.findByText('자랑 피드에 게시하기'));

  await waitFor(() => {
    expect(hookState.publish).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/posts/77');
  });
});
```

신규 테스트 2개 추가:

```ts
it('completed 직후 프리로드가 끝나기 전엔 로딩 화면을 유지한다', () => {
  preloadMock.preloadImage.mockImplementationOnce(() => new Promise<void>(() => {}));
  hookState.phase = 'completed';
  hookState.job = completedJob();
  render(<FigurineCreator />);

  expect(screen.getByText('키캡 피규어를 만들고 있어요…')).toBeInTheDocument();
  expect(screen.queryByAltText('완성된 AI 키캡 피규어')).not.toBeInTheDocument();
});

it('프리로드 완료 시 결과 화면으로 전환된다', async () => {
  let resolvePreload!: () => void;
  preloadMock.preloadImage.mockImplementationOnce(
    () => new Promise<void>((r) => { resolvePreload = r; })
  );
  hookState.phase = 'completed';
  hookState.job = completedJob();
  render(<FigurineCreator />);
  expect(screen.queryByAltText('완성된 AI 키캡 피규어')).not.toBeInTheDocument();

  resolvePreload();
  expect(await screen.findByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
  expect(screen.queryByText('키캡 피규어를 만들고 있어요…')).not.toBeInTheDocument();
});
```

`posting:`/`failed:` 등 나머지 기존 테스트는 그대로 둔다 (posting/posted 직접 렌더는 프리로드 게이트를 타지 않음).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/components/FigurineCreator.test.tsx` / Expected: 신규 2개 + 수정 2개 FAIL (프리로드 게이트 미구현)

- [ ] **Step 3: 구현**

`src/app/globals.css` 끝에 추가:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

`FigurineCreator.tsx`:
1. import 교체: `DetailImage` 제거, `import { preloadImage } from '@/lib/preloadImage';` 추가
2. 상태/이펙트 추가:

```ts
const [revealReady, setRevealReady] = useState(false);

// 결과 이미지가 캐시에 준비된 뒤에만 결과 화면으로 전환 — 빈 화면·점진 렌더 방지
useEffect(() => {
  if (phase !== 'completed' || !job?.resultImageUrl) return;
  let cancelled = false;
  preloadImage(job.resultImageUrl).then(() => {
    if (!cancelled) setRevealReady(true);
  });
  return () => {
    cancelled = true;
  };
}, [phase, job?.resultImageUrl]);

// 다시 만들기/초기화 시 다음 결과를 위해 리셋
useEffect(() => {
  if (phase === 'idle') setRevealReady(false);
}, [phase]);
```

3. 스피너 섹션 조건: `phase === 'generating'` → `phase === 'generating' || (phase === 'completed' && !revealReady)`
4. 결과 섹션 조건: `(phase === 'completed' || phase === 'posting' || phase === 'posted')` → `(phase === 'posting' || phase === 'posted' || (phase === 'completed' && revealReady))` (`&& job?.resultImageUrl` 유지)
5. 결과 섹션에 페이드인: `<section className="mt-6 animate-[fadeIn_0.5s_ease-out]">`
6. `DetailImage` → 원본 직접 표시:

```tsx
{/* eslint-disable-next-line @next/next/no-img-element -- 방금 생성된 결과라 Lambda 썸네일이 없을 수 있어 원본을 직접 표시 */}
<img
  src={job.resultImageUrl}
  alt="완성된 AI 키캡 피규어"
  decoding="async"
  className="w-full rounded-2xl"
/>
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/components/FigurineCreator.test.tsx` / Expected: 전부 PASS
- [ ] **Step 5: 커밋** — `git add -A src/components/domain/FigurineCreator.tsx src/app/globals.css tests/components/FigurineCreator.test.tsx && git commit -m "fix(figurine): 결과 이미지 프리로드 후 페이드인으로 부드럽게 표시"`

---

### Task 3: 전체 검증

- [ ] **Step 1: 전체 테스트** — Run: `npm test` / Expected: 전체 PASS (기존 543 + 신규 6)
- [ ] **Step 2: 린트** — Run: `npx next lint 2>/dev/null || npx eslint src tests` / Expected: 에러 없음
- [ ] **Step 3: 프로덕션 빌드** — Run: `npx next build` / Expected: "Generating static pages" 단계까지 통과
