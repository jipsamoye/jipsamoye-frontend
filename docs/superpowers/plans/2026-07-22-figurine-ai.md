# AI 키캡 피규어 생성 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반려동물 사진을 올리면 AI가 아티산 키캡 피규어 이미지로 변환하고, 버튼 한 번으로 자랑 피드에 자동 게시하는 `/figurines/new` 화면을 만든다.

**Architecture:** 업로드는 기존 presigned 흐름을 재사용하는 `uploadPostImage` 헬퍼로, 생성·폴링·게시는 `useFigurineJob` 훅(상태 머신: idle→creating→generating→completed→posting→posted / failed)으로 분리한다. UI는 단일 클라이언트 컴포넌트 `FigurineCreator`가 훅의 phase에 따라 4개 화면(선택/생성 중/완료/실패)을 렌더한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind, Vitest + @testing-library/react (jsdom, fake timers)

**스펙:** `docs/superpowers/specs/2026-07-22-figurine-ai-api-handoff.md` (백엔드 API 계약)

**주의 — 이전 작업과의 관계:** 메인 체크아웃에 미커밋된 6월 figurine 작업이 있으나 **이전 API 계약**(`/api/figurine/jobs`, `originalImageUrl`, `DONE`, link 방식, quota) 기준이므로 코드로 가져오지 않는다. 이 계획은 2026-07-22 확정 스펙만 따른다. `uploadImage.ts`는 계약과 무관하여 동일하게 재작성한다.

**브랜치:** 워크트리 브랜치 `worktree-frontend-work`에서 작업. PR 직전 `git branch -m feature/figurine-ai-v2` 등으로 정리(메인 체크아웃이 `feature/figurine-ai`를 점유 중이므로 동일 이름 사용 불가).

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/types/api.ts` (수정) | `FigurineStatus`, `FigurineJob`, `FigurineCreateRequest`, `FigurinePostResponse` 타입 추가 |
| `src/lib/uploadImage.ts` (생성) | 단일 이미지 업로드 헬퍼: compress → presigned → S3 PUT → imageUrl |
| `src/hooks/useFigurineJob.ts` (생성) | 생성 요청 + 2.5초 폴링 + 자동 게시 상태 머신 |
| `src/components/domain/FigurineCreator.tsx` (생성) | 화면 전체: 사진 선택→생성→결과→게시 |
| `src/app/figurines/new/page.tsx` (생성) | 라우트 래퍼 (`posts/new`와 동일 패턴) |
| `src/components/layout/icons.tsx` (수정) | `SparklesIcon` 추가 (모바일 드로어용) |
| `src/components/layout/Header.tsx` (수정) | 데스크톱 진입 버튼 "AI 키캡 🧸" |
| `src/components/layout/MobileDrawer.tsx` (수정) | 모바일 진입 메뉴 (requiresAuth) |
| `tests/lib/uploadImage.test.ts` (생성) | 업로드 헬퍼 테스트 |
| `tests/hooks/useFigurineJob.test.ts` (생성) | 훅 테스트 (fake timers) |
| `tests/components/FigurineCreator.test.tsx` (생성) | 컴포넌트 테스트 (훅 모킹) |
| `tests/components/Header.figurineEntry.test.tsx` (생성) | 헤더 진입 버튼 테스트 |
| `tests/components/MobileDrawer.test.tsx` (수정) | 드로어 메뉴 테스트 확장 |

---

### Task 1: API 타입 정의 + 스펙 문서 커밋

**Files:**
- Modify: `src/types/api.ts` (`DmRoomEvent` 타입 정의 뒤, `RankingPageResponse` 앞에 삽입)
- Create: `docs/superpowers/specs/2026-07-22-figurine-ai-api-handoff.md` (메인 체크아웃에서 복사)

- [x] **Step 1: 스펙 문서를 워크트리로 복사**

```bash
cp /Users/jys/jipsamoye.frontend/docs/superpowers/specs/2026-07-22-figurine-ai-api-handoff.md docs/superpowers/specs/
```

- [x] **Step 2: 타입 추가**

`src/types/api.ts`의 `DmRoomEvent` 정의와 `RankingPageResponse` 정의 사이에 추가:

```ts
// AI 키캡 피규어 생성 상태 (GET /api/figurines/{jobId})
export type FigurineStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// AI 키캡 피규어 잡 (POST /api/figurines, GET /api/figurines/{jobId} 응답 data)
export interface FigurineJob {
  jobId: number;
  status: FigurineStatus;
  resultImageUrl: string | null;
  failReason: string | null;
  petPostId: number | null;
}

// 생성 요청 (POST /api/figurines)
export interface FigurineCreateRequest {
  sourceImageUrl: string;
}

// 자동 게시 응답 (POST /api/figurines/{jobId}/post)
export interface FigurinePostResponse {
  petPostId: number;
}
```

- [x] **Step 3: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (기존 코드는 새 타입을 아직 사용하지 않음)

- [x] **Step 4: Commit**

```bash
git add src/types/api.ts docs/superpowers/specs/2026-07-22-figurine-ai-api-handoff.md
git commit -m "feat(figurine): AI 키캡 피규어 API 타입 + 백엔드 계약 문서 추가"
```

---

### Task 2: uploadPostImage 헬퍼 (TDD)

**Files:**
- Create: `src/lib/uploadImage.ts`
- Test: `tests/lib/uploadImage.test.ts`

PostEditor의 `uploadSingleImage` 로직과 동일한 흐름을 재사용 가능한 함수로 추출한 것. 압축 결과가 fast path로 원본(JPEG/PNG)일 수 있어 ext/Content-Type을 실제 타입에 맞춰야 한다(S3 메타/바이트 불일치 방지).

- [x] **Step 1: 실패하는 테스트 작성** — `tests/lib/uploadImage.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { apiMock, compressMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  compressMock: { compressImage: vi.fn(), extFromMimeType: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/imageCompress', () => compressMock);

import { uploadPostImage } from '@/lib/uploadImage';

const file = new File(['raw'], 'cat.jpg', { type: 'image/jpeg' });
const compressed = new File(['zip'], 'cat.webp', { type: 'image/webp' });

describe('uploadPostImage', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    compressMock.compressImage.mockReset();
    compressMock.extFromMimeType.mockReset();

    compressMock.compressImage.mockResolvedValue(compressed);
    compressMock.extFromMimeType.mockReturnValue('webp');
    apiMock.post.mockResolvedValue({
      status: 200, code: 'SUCCESS', message: '',
      data: { presignedUrl: 'https://s3/presigned', imageUrl: 'https://cdn/posts/1/a.webp' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('압축 → presigned 발급 → S3 PUT 순서로 진행하고 imageUrl을 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const url = await uploadPostImage(file);

    expect(compressMock.compressImage).toHaveBeenCalledWith(file, 'post');
    expect(apiMock.post).toHaveBeenCalledWith('/api/images/presigned-url', {
      dirName: 'posts',
      ext: 'webp',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://s3/presigned', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: compressed,
    });
    expect(url).toBe('https://cdn/posts/1/a.webp');
  });

  it('압축 결과 타입 기준으로 ext를 정한다 (fast path 원본 JPEG 통과 시 jpg)', async () => {
    const passthrough = new File(['raw'], 'cat.jpg', { type: 'image/jpeg' });
    compressMock.compressImage.mockResolvedValue(passthrough);
    compressMock.extFromMimeType.mockReturnValue('jpg');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    await uploadPostImage(file);

    expect(compressMock.extFromMimeType).toHaveBeenCalledWith('image/jpeg');
    expect(apiMock.post).toHaveBeenCalledWith('/api/images/presigned-url', {
      dirName: 'posts',
      ext: 'jpg',
    });
  });

  it('S3 PUT 실패 시 상태코드를 담아 에러를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(uploadPostImage(file)).rejects.toThrow('S3 업로드 실패 (403)');
  });

  it('presigned 발급 실패 시 에러를 그대로 전파하고 S3 PUT을 시도하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    apiMock.post.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: '', data: null });

    await expect(uploadPostImage(file)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/uploadImage.test.ts`
Expected: FAIL — `Cannot find module '@/lib/uploadImage'` 류의 에러

- [x] **Step 3: 구현** — `src/lib/uploadImage.ts`

```ts
import { api } from '@/lib/api';
import { compressImage, extFromMimeType } from '@/lib/imageCompress';
import type { PresignedUrlResponse } from '@/types/api';

/**
 * 단일 이미지 업로드 헬퍼 (PostEditor.uploadSingleImage 패턴).
 *
 * 흐름: compress('post') → POST /api/images/presigned-url → S3 PUT → imageUrl 반환.
 * - 압축 결과가 fast path로 원본(JPEG/PNG)일 수 있어, ext/Content-Type을 실제
 *   타입에 맞춰야 S3 메타와 바이트가 일치(메타/바이트 불일치 방지). 따라서 직렬 호출.
 * - presigned 발급은 api 래퍼(credentials include)로, S3 PUT은 fetch로 직접.
 *
 * @returns 업로드된 이미지의 CDN/S3 URL
 * @throws presigned 발급 또는 S3 PUT 실패 시 (401은 api 래퍼가 전역 처리 후 throw)
 */
export async function uploadPostImage(file: File): Promise<string> {
  const compressed = await compressImage(file, 'post');

  const res = await api.post<PresignedUrlResponse>('/api/images/presigned-url', {
    dirName: 'posts',
    ext: extFromMimeType(compressed.type),
  });

  const putRes = await fetch(res.data.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.type },
    body: compressed,
  });

  if (!putRes.ok) {
    throw new Error(`S3 업로드 실패 (${putRes.status})`);
  }

  return res.data.imageUrl;
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/lib/uploadImage.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Commit**

```bash
git add src/lib/uploadImage.ts tests/lib/uploadImage.test.ts
git commit -m "feat(figurine): 단일 이미지 업로드 헬퍼 uploadPostImage 추가"
```

---

### Task 3: useFigurineJob 훅 — 생성 + 폴링 (TDD)

**Files:**
- Create: `src/hooks/useFigurineJob.ts`
- Test: `tests/hooks/useFigurineJob.test.ts`

핵심 설계 (이전 세대 훅에서 검증된 원칙 유지):
- **setTimeout 재귀** (setInterval 금지) — 응답이 늦어도 중첩 호출이 쌓이지 않음
- 서버가 5분 초과 작업을 자동 FAILED 처리 → 클라이언트는 **6분(144회) 백스톱**만 유지 (네트워크 단절로 FAILED를 못 받는 경우 대비)
- 일시 네트워크 오류는 백스톱 한도까지 재시도, 401은 api 래퍼가 전역 처리하므로 폴링만 중단
- unmount 시 `cancelledRef` + `clearTimeout`으로 setState 방지

- [x] **Step 1: 실패하는 테스트 작성** — `tests/hooks/useFigurineJob.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FigurineJob } from '@/types/api';

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  toastMock: { showToast: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/common/Toast', () => toastMock);

import { useFigurineJob, POLL_INTERVAL_MS, MAX_POLLS } from '@/hooks/useFigurineJob';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makeJob = (overrides: Partial<FigurineJob> = {}): FigurineJob => ({
  jobId: 1,
  status: 'PENDING',
  resultImageUrl: null,
  failReason: null,
  petPostId: null,
  ...overrides,
});

describe('useFigurineJob — 생성/폴링', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    toastMock.showToast.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start: POST /api/figurines 성공 시 phase=generating, job 저장', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());

    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/figurines', {
      sourceImageUrl: 'https://cdn/posts/1/a.webp',
    });
    expect(result.current.phase).toBe('generating');
    expect(result.current.job?.jobId).toBe(1);
  });

  it('start 실패(400): 토스트 안내 후 phase=idle 복귀', async () => {
    apiMock.post.mockRejectedValueOnce({
      status: 400, code: 'BAD_REQUEST', message: '본인이 업로드한 이미지만 사용할 수 있어요', data: null,
    });
    const { result } = renderHook(() => useFigurineJob());

    await act(async () => {
      await result.current.start('https://evil/img.jpg');
    });

    expect(toastMock.showToast).toHaveBeenCalledWith('본인이 업로드한 이미지만 사용할 수 있어요');
    expect(result.current.phase).toBe('idle');
  });

  it('폴링: 2.5초 간격으로 GET, PROCESSING이면 계속, COMPLETED면 phase=completed', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    apiMock.get.mockResolvedValueOnce(successRes(makeJob({ status: 'PROCESSING' })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/figurines/1', { silent: true });
    expect(result.current.phase).toBe('generating');
    expect(result.current.job?.status).toBe('PROCESSING');

    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'COMPLETED', resultImageUrl: 'https://cdn/results/1.png' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.phase).toBe('completed');
    expect(result.current.job?.resultImageUrl).toBe('https://cdn/results/1.png');

    // 종료 후 추가 폴링 없음
    const callsAfterDone = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAfterDone);
  });

  it('폴링: FAILED 수신 시 phase=failed + failReason 노출', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'FAILED', failReason: '이미지 생성에 실패했어요' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.errorMessage).toBe('이미지 생성에 실패했어요');
  });

  it('일시 네트워크 오류는 계속 재시도하고, 백스톱 초과 시 phase=failed(타임아웃 안내)', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_POLLS);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.errorMessage).toContain('너무 오래');
    expect(apiMock.get).toHaveBeenCalledTimes(MAX_POLLS);
  });

  it('unmount 시 폴링이 멈춘다', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockResolvedValue(successRes(makeJob({ status: 'PROCESSING' })));
    const { result, unmount } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    unmount();
    const callsAtUnmount = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAtUnmount);
  });

  it('reset: 폴링 중단 + job/phase 초기화', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockResolvedValue(successRes(makeJob({ status: 'PROCESSING' })));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.job).toBeNull();

    const callsAtReset = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAtReset);
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/hooks/useFigurineJob.test.ts`
Expected: FAIL — `Cannot find module '@/hooks/useFigurineJob'`

- [x] **Step 3: 구현** — `src/hooks/useFigurineJob.ts` (publish는 Task 4에서 추가)

```ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { showToast } from '@/components/common/Toast';
import type { ApiResponse, FigurineJob } from '@/types/api';

export const POLL_INTERVAL_MS = 2_500;
// 서버가 5분 초과 작업을 자동 FAILED 처리 → 클라이언트는 네트워크 단절 대비 6분 백스톱만 유지
export const MAX_POLLS = 144; // 2.5초 × 144 = 360초

/**
 * 화면 상태 머신.
 * - `idle`: 시작 전(또는 생성 요청 실패로 복귀)
 * - `creating`: POST /api/figurines 진행 중
 * - `generating`: PENDING/PROCESSING — 2.5초 간격 폴링 중
 * - `completed`: COMPLETED — resultImageUrl 표시 + 게시 가능
 * - `failed`: FAILED 수신 또는 클라이언트 백스톱 초과
 * - `posting`: POST /{jobId}/post 진행 중 (Task 4)
 * - `posted`: 게시 완료 — petPostId 확보 (Task 4)
 */
export type FigurinePhase =
  | 'idle'
  | 'creating'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'posting'
  | 'posted';

interface UseFigurineJobResult {
  job: FigurineJob | null;
  phase: FigurinePhase;
  /** phase=failed일 때 사용자 안내문 (서버 failReason 우선) */
  errorMessage: string | null;
  /** 업로드 완료된 sourceImageUrl로 생성 요청 + 폴링 시작 */
  start: (sourceImageUrl: string) => Promise<void>;
  /** 전체 초기화 (다시 시도) */
  reset: () => void;
}

const TIMEOUT_MESSAGE = '생성이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.';
const DEFAULT_FAIL_MESSAGE = '이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.';

/**
 * AI 키캡 피규어 잡 훅.
 *
 * 핵심 설계:
 * - **setTimeout 재귀**(setInterval 금지) — 응답이 늦어도 중첩 호출이 쌓이지 않음.
 * - **일시 네트워크 오류 내성**: 폴링 GET이 실패해도 백스톱 한도까지 계속 재시도.
 * - **401은 전파**: api 래퍼가 unauthorizedHandler 호출 + throw → 폴링 중단(전역 처리).
 * - **unmount cleanup**: cancelled 플래그 + clearTimeout. 언마운트 후 setState 금지.
 */
export function useFigurineJob(): UseFigurineJobResult {
  const [job, setJob] = useState<FigurineJob | null>(null);
  const [phase, setPhase] = useState<FigurinePhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // poll 자신을 재귀 setTimeout에서 참조해야 하므로 ref로 stale 클로저를 끊는다.
  const pollRef = useRef<(jobId: number) => void>(() => {});

  const scheduleNext = useCallback((jobId: number) => {
    timerRef.current = setTimeout(() => pollRef.current(jobId), POLL_INTERVAL_MS);
  }, []);

  const failByTimeout = useCallback(() => {
    setPhase('failed');
    setErrorMessage(TIMEOUT_MESSAGE);
  }, []);

  const poll = useCallback(async (jobId: number) => {
    if (cancelledRef.current) return;

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.get<FigurineJob>(`/api/figurines/${jobId}`, { silent: true });
    } catch (err) {
      if (cancelledRef.current) return;
      if ((err as ApiResponse<null>)?.status === 401) {
        clearTimer();
        return;
      }
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        failByTimeout();
        clearTimer();
        return;
      }
      scheduleNext(jobId);
      return;
    }

    if (cancelledRef.current) return;

    const next = res.data;
    setJob(next);

    if (next.status === 'COMPLETED') {
      setPhase('completed');
      clearTimer();
      return;
    }
    if (next.status === 'FAILED') {
      setPhase('failed');
      setErrorMessage(next.failReason ?? DEFAULT_FAIL_MESSAGE);
      clearTimer();
      return;
    }

    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLLS) {
      failByTimeout();
      clearTimer();
      return;
    }
    scheduleNext(jobId);
  }, [clearTimer, scheduleNext, failByTimeout]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const start = useCallback(async (sourceImageUrl: string) => {
    cancelledRef.current = false;
    clearTimer();
    pollCountRef.current = 0;
    setErrorMessage(null);
    setPhase('creating');

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.post<FigurineJob>('/api/figurines', { sourceImageUrl });
    } catch (err) {
      if (cancelledRef.current) return;
      // 401은 api 래퍼가 이미 토스트+전역 처리. 그 외에만 사유 안내.
      if ((err as ApiResponse<null>)?.status !== 401) {
        showToast((err as ApiResponse<null>)?.message || '생성 요청에 실패했어요');
      }
      setPhase('idle');
      return;
    }

    if (cancelledRef.current) return;
    setJob(res.data);
    setPhase('generating');
    scheduleNext(res.data.jobId);
  }, [clearTimer, scheduleNext]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    pollCountRef.current = 0;
    setJob(null);
    setPhase('idle');
    setErrorMessage(null);
  }, [clearTimer]);

  // unmount cleanup: 진행 중 폴링 무력화 + 타이머 해제.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);

  return { job, phase, errorMessage, start, reset };
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/hooks/useFigurineJob.test.ts`
Expected: PASS (7 tests)

- [x] **Step 5: Commit**

```bash
git add src/hooks/useFigurineJob.ts tests/hooks/useFigurineJob.test.ts
git commit -m "feat(figurine): 생성 요청 + 상태 폴링 훅 useFigurineJob 추가"
```

---

### Task 4: useFigurineJob 훅 — 자동 게시 publish (TDD)

**Files:**
- Modify: `src/hooks/useFigurineJob.ts`
- Test: `tests/hooks/useFigurineJob.test.ts` (describe 블록 추가)

- [x] **Step 1: 실패하는 테스트 추가** — `tests/hooks/useFigurineJob.test.ts` 파일 끝에 추가

```ts
describe('useFigurineJob — 게시(publish)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    toastMock.showToast.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 헬퍼: completed 상태까지 진행시킨 훅 반환
  async function renderCompleted() {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const rendered = renderHook(() => useFigurineJob());
    await act(async () => {
      await rendered.result.current.start('https://cdn/posts/1/a.webp');
    });
    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'COMPLETED', resultImageUrl: 'https://cdn/results/1.png' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(rendered.result.current.phase).toBe('completed');
    apiMock.post.mockReset();
    apiMock.get.mockReset();
    return rendered;
  }

  it('성공: POST /{jobId}/post → phase=posted, petPostId 반환', async () => {
    const { result } = await renderCompleted();
    apiMock.post.mockResolvedValueOnce({ status: 201, code: 'SUCCESS', message: '', data: { petPostId: 77 } });

    let petPostId: number | null = null;
    await act(async () => {
      petPostId = await result.current.publish();
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/figurines/1/post');
    expect(petPostId).toBe(77);
    expect(result.current.phase).toBe('posted');
    expect(result.current.job?.petPostId).toBe(77);
  });

  it('409 FIGURINE_ALREADY_POSTED: GET으로 petPostId 복원 후 posted 처리', async () => {
    const { result } = await renderCompleted();
    apiMock.post.mockRejectedValueOnce({
      status: 409, code: 'FIGURINE_ALREADY_POSTED', message: '이미 게시된 작품이에요', data: null,
    });
    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'COMPLETED', resultImageUrl: 'https://cdn/results/1.png', petPostId: 77 }))
    );

    let petPostId: number | null = null;
    await act(async () => {
      petPostId = await result.current.publish();
    });

    expect(petPostId).toBe(77);
    expect(result.current.phase).toBe('posted');
  });

  it('일반 실패(5xx): 토스트 안내 후 phase=completed로 복귀, null 반환', async () => {
    const { result } = await renderCompleted();
    apiMock.post.mockRejectedValueOnce({
      status: 500, code: 'INTERNAL_ERROR', message: '잠시 후 다시 시도해 주세요', data: null,
    });

    let petPostId: number | null = null;
    await act(async () => {
      petPostId = await result.current.publish();
    });

    expect(petPostId).toBeNull();
    expect(toastMock.showToast).toHaveBeenCalledWith('잠시 후 다시 시도해 주세요');
    expect(result.current.phase).toBe('completed');
  });

  it('완료 전(phase!==completed)에는 아무 요청도 보내지 않는다', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });
    apiMock.post.mockReset();

    let petPostId: number | null = null;
    await act(async () => {
      petPostId = await result.current.publish();
    });

    expect(petPostId).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/hooks/useFigurineJob.test.ts`
Expected: FAIL — `result.current.publish is not a function`

- [x] **Step 3: 구현** — `src/hooks/useFigurineJob.ts` 수정

(1) import에 `FigurinePostResponse` 추가:

```ts
import type { ApiResponse, FigurineJob, FigurinePostResponse } from '@/types/api';
```

(2) `UseFigurineJobResult` 인터페이스에 필드 추가 (`start` 아래):

```ts
  /**
   * COMPLETED 상태에서 자랑 피드 자동 게시. 성공/이미 게시(409 복원) 시 petPostId,
   * 실패 시 null 반환(completed로 복귀해 재시도 가능).
   */
  publish: () => Promise<number | null>;
```

(3) `reset` 정의 위에 `publish` 구현 추가:

```ts
  const publish = useCallback(async (): Promise<number | null> => {
    if (!job || phase !== 'completed') return null;
    setPhase('posting');

    try {
      const res = await api.post<FigurinePostResponse>(`/api/figurines/${job.jobId}/post`);
      const petPostId = res.data.petPostId;
      if (cancelledRef.current) return petPostId;
      setJob((prev) => (prev ? { ...prev, petPostId } : prev));
      setPhase('posted');
      return petPostId;
    } catch (err) {
      if (cancelledRef.current) return null;

      // 이미 게시된 잡(409) — GET으로 petPostId를 복원해 게시 완료로 수렴
      if ((err as ApiResponse<null>)?.code === 'FIGURINE_ALREADY_POSTED') {
        try {
          const res = await api.get<FigurineJob>(`/api/figurines/${job.jobId}`, { silent: true });
          if (!cancelledRef.current && res.data.petPostId != null) {
            setJob(res.data);
            setPhase('posted');
            return res.data.petPostId;
          }
        } catch {
          // 복원 실패 — 아래 공통 복귀 처리로 진행
        }
      }

      if (!cancelledRef.current) {
        if ((err as ApiResponse<null>)?.status !== 401) {
          showToast((err as ApiResponse<null>)?.message || '게시에 실패했어요');
        }
        setPhase('completed'); // 버튼 재활성화 — 재시도 가능
      }
      return null;
    }
  }, [job, phase]);
```

(4) return 문 갱신:

```ts
  return { job, phase, errorMessage, start, publish, reset };
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/hooks/useFigurineJob.test.ts`
Expected: PASS (11 tests)

- [x] **Step 5: Commit**

```bash
git add src/hooks/useFigurineJob.ts tests/hooks/useFigurineJob.test.ts
git commit -m "feat(figurine): 자랑 피드 자동 게시 publish 추가 (409 복원 포함)"
```

---

### Task 5: FigurineCreator 컴포넌트 (TDD)

**Files:**
- Create: `src/components/domain/FigurineCreator.tsx`
- Test: `tests/components/FigurineCreator.test.tsx`

훅을 모킹해 phase별 렌더링과 상호작용만 검증한다 (폴링 로직은 Task 3/4에서 이미 검증).

- [x] **Step 1: 실패하는 테스트 작성** — `tests/components/FigurineCreator.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { FigurineJob, User } from '@/types/api';
import type { FigurinePhase } from '@/hooks/useFigurineJob';

const { hookState, routerMock, authMock, uploadMock, toastMock } = vi.hoisted(() => ({
  hookState: {
    job: null as FigurineJob | null,
    phase: 'idle' as FigurinePhase,
    errorMessage: null as string | null,
    start: vi.fn(),
    publish: vi.fn(),
    reset: vi.fn(),
  },
  routerMock: { push: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  uploadMock: { uploadPostImage: vi.fn() },
  toastMock: { showToast: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useFigurineJob', () => ({ useFigurineJob: () => hookState }));
vi.mock('@/lib/uploadImage', () => uploadMock);
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));

import FigurineCreator from '@/components/domain/FigurineCreator';

const sampleUser = { nickname: '집사' } as unknown as User;

const completedJob = (overrides: Partial<FigurineJob> = {}): FigurineJob => ({
  jobId: 1,
  status: 'COMPLETED',
  resultImageUrl: 'https://cdn/results/1.png',
  failReason: null,
  petPostId: null,
  ...overrides,
});

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('파일 입력을 찾지 못했습니다');
  fireEvent.change(input, { target: { files: [file] } });
}

describe('FigurineCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.job = null;
    hookState.phase = 'idle';
    hookState.errorMessage = null;
    authMock.user = sampleUser;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true, configurable: true, value: vi.fn(() => 'blob:preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true, configurable: true, value: vi.fn(),
    });
  });

  it('idle: 파일 미선택 시 생성 버튼이 비활성화된다', () => {
    render(<FigurineCreator />);
    expect(screen.getByText('키캡 피규어 만들기')).toBeDisabled();
  });

  it('유효한 파일 선택 시 미리보기가 뜨고 생성 버튼이 활성화된다', () => {
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    expect(screen.getByAltText('선택한 사진 미리보기')).toBeInTheDocument();
    expect(screen.getByText('키캡 피규어 만들기')).toBeEnabled();
  });

  it('허용되지 않은 확장자는 토스트 안내 후 무시한다', () => {
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.gif', { type: 'image/gif' }));

    expect(toastMock.showToast).toHaveBeenCalledWith('jpg, jpeg, png, webp 이미지만 올릴 수 있어요');
    expect(screen.queryByAltText('선택한 사진 미리보기')).not.toBeInTheDocument();
    expect(screen.getByText('키캡 피규어 만들기')).toBeDisabled();
  });

  it('생성 클릭: 업로드 후 반환된 URL로 start를 호출한다', async () => {
    uploadMock.uploadPostImage.mockResolvedValueOnce('https://cdn/posts/1/a.webp');
    const { container } = render(<FigurineCreator />);
    const file = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
    selectFile(container, file);

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      expect(uploadMock.uploadPostImage).toHaveBeenCalledWith(file);
      expect(hookState.start).toHaveBeenCalledWith('https://cdn/posts/1/a.webp');
    });
  });

  it('업로드 실패 시 토스트 안내 (start 미호출)', async () => {
    uploadMock.uploadPostImage.mockRejectedValueOnce(new Error('S3 업로드 실패 (500)'));
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      expect(toastMock.showToast).toHaveBeenCalledWith('사진 업로드에 실패했어요. 다시 시도해 주세요.');
    });
    expect(hookState.start).not.toHaveBeenCalled();
  });

  it('generating: 진행 안내 문구를 렌더한다', () => {
    hookState.phase = 'generating';
    render(<FigurineCreator />);
    expect(screen.getByText('키캡 피규어를 만들고 있어요…')).toBeInTheDocument();
  });

  it('completed: 결과 이미지 + 게시/다시 만들기 버튼을 렌더한다', () => {
    hookState.phase = 'completed';
    hookState.job = completedJob();
    render(<FigurineCreator />);

    expect(screen.getByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
    expect(screen.getByText('자랑 피드에 게시하기')).toBeEnabled();
    expect(screen.getByText('다른 사진으로 다시 만들기')).toBeEnabled();
  });

  it('게시 클릭: publish 성공 시 게시글로 이동한다', async () => {
    hookState.phase = 'completed';
    hookState.job = completedJob();
    hookState.publish.mockResolvedValueOnce(77);
    render(<FigurineCreator />);

    fireEvent.click(screen.getByText('자랑 피드에 게시하기'));

    await waitFor(() => {
      expect(hookState.publish).toHaveBeenCalled();
      expect(routerMock.push).toHaveBeenCalledWith('/posts/77');
    });
  });

  it('posting: 게시 버튼이 "게시 중…"으로 비활성화된다', () => {
    hookState.phase = 'posting';
    hookState.job = completedJob();
    render(<FigurineCreator />);

    expect(screen.getByText('게시 중…')).toBeDisabled();
  });

  it('failed: errorMessage와 다시 시도 버튼을 렌더하고, 클릭 시 reset을 호출한다', () => {
    hookState.phase = 'failed';
    hookState.errorMessage = '이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.';
    render(<FigurineCreator />);

    expect(screen.getByText('이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('다른 사진으로 다시 시도'));
    expect(hookState.reset).toHaveBeenCalled();
  });

  it('비로그인 상태에서 생성 클릭 시 로그인 안내 토스트 (업로드 미시도)', () => {
    authMock.user = null;
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    expect(toastMock.showToast).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    expect(uploadMock.uploadPostImage).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/components/FigurineCreator.test.tsx`
Expected: FAIL — `Cannot find module '@/components/domain/FigurineCreator'`

- [x] **Step 3: 구현** — `src/components/domain/FigurineCreator.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useFigurineJob } from '@/hooks/useFigurineJob';
import { uploadPostImage } from '@/lib/uploadImage';
import { showToast } from '@/components/common/Toast';
import DetailImage from '@/components/common/DetailImage';
import { ALLOWED_IMAGE_EXTS, POST_CONFIG } from '@/lib/constants';
import type { ApiResponse } from '@/types/api';

const PRIMARY_BUTTON =
  'w-full px-6 py-3 bg-amber-500 text-white rounded-xl text-base font-medium hover:bg-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const OUTLINE_BUTTON =
  'w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-base font-medium hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

export default function FigurineCreator() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { job, phase, errorMessage, start, publish, reset } = useFigurineJob();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // objectURL 누수 방지
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      showToast('jpg, jpeg, png, webp 이미지만 올릴 수 있어요');
      e.target.value = '';
      return;
    }
    if (selected.size > POST_CONFIG.MAX_IMAGE_SIZE) {
      showToast('10MB 이하 이미지만 올릴 수 있어요');
      e.target.value = '';
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleGenerate = async () => {
    if (!file || uploading) return;
    if (!user) {
      showToast('로그인하고 이용해 주세요');
      return;
    }
    setUploading(true);
    try {
      const sourceImageUrl = await uploadPostImage(file);
      await start(sourceImageUrl);
    } catch (err) {
      // 401은 api 래퍼가 전역 처리(토스트+모달)하므로 중복 안내 금지
      if ((err as ApiResponse<null>)?.status !== 401) {
        showToast('사진 업로드에 실패했어요. 다시 시도해 주세요.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    const petPostId = await publish();
    if (petPostId != null) {
      router.push(`/posts/${petPostId}`);
    }
  };

  const handleRetry = () => {
    reset();
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const busy = uploading || phase === 'creating';

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">AI 키캡 피규어</h1>
      <p className="mt-2 text-sm text-gray-600">
        우리 애 사진을 올리면 아티산 키캡 위 미니 피규어로 만들어 드려요.
      </p>

      {(phase === 'idle' || phase === 'creating') && (
        <section className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="사진 선택"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center w-full aspect-square max-h-96 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors overflow-hidden"
          >
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */
              <img src={previewUrl} alt="선택한 사진 미리보기" className="w-full h-full object-contain" />
            ) : (
              <span>사진을 선택해 주세요</span>
            )}
          </button>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            disabled={!file || busy}
            onClick={handleGenerate}
          >
            {busy ? '요청 중…' : '키캡 피규어 만들기'}
          </button>
        </section>
      )}

      {phase === 'generating' && (
        <section className="flex flex-col items-center mt-10 text-center">
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */
            <img src={previewUrl} alt="원본 사진" className="w-40 h-40 rounded-2xl object-cover opacity-60" />
          )}
          <div
            className="mt-6 w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-base font-medium text-gray-900">키캡 피규어를 만들고 있어요…</p>
          <p className="mt-1 text-sm text-gray-500">
            보통 1분 안에 완성돼요. 이 화면을 벗어나면 진행 상황을 볼 수 없어요.
          </p>
        </section>
      )}

      {(phase === 'completed' || phase === 'posting' || phase === 'posted') && job?.resultImageUrl && (
        <section className="mt-6">
          <DetailImage
            src={job.resultImageUrl}
            alt="완성된 AI 키캡 피규어"
            loading="eager"
            className="w-full rounded-2xl"
          />
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            disabled={phase !== 'completed'}
            onClick={handlePublish}
          >
            {phase === 'posting' ? '게시 중…' : phase === 'posted' ? '게시 완료' : '자랑 피드에 게시하기'}
          </button>
          <button
            type="button"
            className={`${OUTLINE_BUTTON} mt-2`}
            disabled={phase !== 'completed'}
            onClick={handleRetry}
          >
            다른 사진으로 다시 만들기
          </button>
        </section>
      )}

      {phase === 'failed' && (
        <section className="flex flex-col items-center mt-10 text-center">
          <p className="text-base font-medium text-gray-900">앗, 생성에 실패했어요</p>
          <p className="mt-1 text-sm text-gray-500">{errorMessage}</p>
          <button type="button" className={`${PRIMARY_BUTTON} mt-6 max-w-xs`} onClick={handleRetry}>
            다른 사진으로 다시 시도
          </button>
        </section>
      )}
    </main>
  );
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/components/FigurineCreator.test.tsx`
Expected: PASS (11 tests)

- [x] **Step 5: Commit**

```bash
git add src/components/domain/FigurineCreator.tsx tests/components/FigurineCreator.test.tsx
git commit -m "feat(figurine): FigurineCreator 화면 컴포넌트 추가 (선택→생성→게시)"
```

---

### Task 6: /figurines/new 라우트

**Files:**
- Create: `src/app/figurines/new/page.tsx`

- [x] **Step 1: 페이지 생성** (`posts/new/page.tsx`와 동일 패턴)

```tsx
'use client';

import FigurineCreator from '@/components/domain/FigurineCreator';

export default function NewFigurinePage() {
  return <FigurineCreator />;
}
```

- [x] **Step 2: production 빌드 확인** (CLAUDE.md 필수 — prerender 단계까지 통과해야 함)

Run: `npx next build`
Expected: "Generating static pages" 단계 통과, `/figurines/new` 라우트가 출력 목록에 표시

- [x] **Step 3: Commit**

```bash
git add src/app/figurines/new/page.tsx
git commit -m "feat(figurine): /figurines/new 라우트 추가"
```

---

### Task 7: 진입점 — Header(데스크톱) + MobileDrawer(모바일)

**Files:**
- Modify: `src/components/layout/icons.tsx` (파일 끝에 아이콘 추가)
- Modify: `src/components/layout/Header.tsx:77` (자랑하기 Link 앞)
- Modify: `src/components/layout/MobileDrawer.tsx:17-23` (navItems)
- Create: `tests/components/Header.figurineEntry.test.tsx`
- Modify: `tests/components/MobileDrawer.test.tsx`

- [x] **Step 1: 실패하는 테스트 작성 (Header)** — `tests/components/Header.figurineEntry.test.tsx`

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Header from '@/components/layout/Header';

// Header가 의존하는 프로바이더 훅 / 네비게이션 목킹 (Header.notificationPanel.test.tsx와 동일)
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/providers/NavigationGuard', () => ({
  useNavigationGuard: () => ({ guardedPush: vi.fn() }),
}));
vi.mock('@/components/providers/HomeRefreshProvider', () => ({
  useHomeRefresh: () => ({ refreshHome: vi.fn() }),
}));
vi.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    fetchNotifications: vi.fn(),
  }),
}));

describe('Header AI 키캡 진입 버튼', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('로그인 상태에서 /figurines/new 링크를 렌더한다', () => {
    const { container } = render(<Header isLoggedIn nickname="tester" profileImageUrl={null} />);
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('비로그인 상태에서는 렌더하지 않는다', () => {
    const { container } = render(<Header />);
    expect(container.querySelector('a[href="/figurines/new"]')).toBeNull();
  });
});
```

- [x] **Step 2: 실패하는 테스트 추가 (MobileDrawer)** — `tests/components/MobileDrawer.test.tsx`

(1) 기존 `vi.mock('@/components/layout/icons', ...)` 블록에 한 줄 추가:

```tsx
vi.mock('@/components/layout/icons', () => ({
  HomeIcon: () => <svg />,
  TrophyIcon: () => <svg />,
  NoteIcon: () => <svg />,
  OpenChatIcon: () => <svg />,
  PaperAirplaneIcon: () => <svg />,
  SparklesIcon: () => <svg />,
}));
```

(2) describe 블록 끝에 테스트 추가:

```tsx
  it('로그인 상태에서만 AI 키캡 메뉴를 렌더한다', () => {
    authMock.user = sampleUser;
    const { container } = render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('AI 키캡 만들기')).toBeInTheDocument();
    expect(container.querySelector('a[href="/figurines/new"]')).not.toBeNull();
  });

  it('비로그인 상태에서는 AI 키캡 메뉴를 렌더하지 않는다', () => {
    authMock.user = null;
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('AI 키캡 만들기')).not.toBeInTheDocument();
  });
```

- [x] **Step 3: 실패 확인**

Run: `npx vitest run tests/components/Header.figurineEntry.test.tsx tests/components/MobileDrawer.test.tsx`
Expected: FAIL — Header 링크 없음, `AI 키캡 만들기` 미렌더

- [x] **Step 4: SparklesIcon 추가** — `src/components/layout/icons.tsx` 파일 끝에 추가 (heroicons sparkles)

```tsx
export function SparklesIcon({ filled = false }: IconProps = {}) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258a2.625 2.625 0 0 0-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}
```

- [x] **Step 5: Header 수정** — `src/components/layout/Header.tsx`의 `{isLoggedIn ? (<>` 바로 아래, 기존 자랑하기/글쓰기 `<Link>` 앞에 추가:

```tsx
              <Link
                href="/figurines/new"
                className="hidden lg:flex items-center px-4 py-2 border border-amber-400 text-amber-600 rounded-xl text-base font-medium hover:bg-amber-50 transition-all duration-200"
              >
                AI 키캡 🧸
              </Link>
```

- [x] **Step 6: MobileDrawer 수정** — `src/components/layout/MobileDrawer.tsx`

(1) import에 `SparklesIcon` 추가:

```tsx
import { HomeIcon, TrophyIcon, NoteIcon, OpenChatIcon, PaperAirplaneIcon, SparklesIcon } from './icons';
```

(2) `navItems` 배열의 DM 항목 뒤에 추가:

```tsx
  { label: 'AI 키캡 만들기', href: '/figurines/new', icon: (f) => <SparklesIcon filled={f} />, requiresAuth: true },
```

- [x] **Step 7: 통과 확인**

Run: `npx vitest run tests/components/Header.figurineEntry.test.tsx tests/components/MobileDrawer.test.tsx`
Expected: PASS (Header 2 tests + MobileDrawer 5 tests)

- [x] **Step 8: Commit**

```bash
git add src/components/layout/icons.tsx src/components/layout/Header.tsx src/components/layout/MobileDrawer.tsx tests/components/Header.figurineEntry.test.tsx tests/components/MobileDrawer.test.tsx
git commit -m "feat(figurine): 헤더/모바일 드로어에 AI 키캡 진입점 추가"
```

---

### Task 8: 최종 검증

- [x] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 기존 507개 + 신규 약 30개 전부 통과, 실패 0

- [x] **Step 2: 린트**

Run: `npx eslint src/ tests/`
Expected: 에러 0 (blob 미리보기 `<img>`는 eslint-disable 주석으로 처리됨)

- [x] **Step 3: production 빌드 (push 전 필수)**

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과

- [x] **Step 4: 수동 확인 항목 정리 후 사용자 보고**

백엔드 `feature/figurine-ai` 브랜치가 아직 미머지/미배포 상태이므로, 사용자에게 다음을 안내:
1. 백엔드에 머지/배포 요청 필요 (스펙 문서 헤더 참고)
2. 배포 후 실제 연동 확인: 사진 업로드 → 생성(수십 초) → 게시 → `/posts/{id}` 이동
3. push는 사용자 확인 후 진행 (CLAUDE.md: push 후 Vercel 배포 확인까지)

---

## 스펙 커버리지 체크리스트

| 스펙 요구사항 | 구현 위치 |
|---------------|-----------|
| presigned 업로드 (dirName=posts) | Task 2 `uploadPostImage` |
| POST /api/figurines → jobId | Task 3 `start` |
| 2~3초 간격 폴링 | Task 3 (2.5초) |
| PENDING/PROCESSING → 로딩 UI | Task 3 phase=generating, Task 5 |
| COMPLETED → resultImageUrl + 게시 버튼 | Task 3/5 |
| FAILED → failReason + 다시 시도 | Task 3/5 |
| 서버 5분 자동 FAILED (무한 폴링 방지) | Task 3 — FAILED 수신 시 중단 + 6분 클라이언트 백스톱 |
| POST /{jobId}/post → petPostId, 게시글 이동 | Task 4/5 |
| 1회만 게시 — 버튼 비활성 + 409 방어 | Task 5 (disabled) + Task 4 (409 복원) |
| 400 BAD_REQUEST (타인 이미지) 안내 | Task 3 — 서버 message 토스트 |
| 별도 버튼/화면 진입 | Task 6/7 |
| 사용량 무제한 하드코딩 금지 | 해당 UI 없음 — 서버 에러 message 그대로 노출하므로 추후 제한 도입 시에도 동작 |

## 트레이드오프 / 의도적으로 뺀 것

- **새로고침/재진입 시 잡 복원 없음** (이전 세대의 sessionStorage 방식 제거): 스펙상 "게시하지 않고 이탈해도 무방"이며, 생성이 수십 초로 짧아 복잡도 대비 가치가 낮음. 대신 생성 중 화면에 "화면을 벗어나면 진행 상황을 볼 수 없어요" 안내 문구를 표시. 필요해지면 별도 기능으로 추가.
- **NavigationGuard(이탈 방지 confirm) 미적용**: 생성 자체는 서버에서 계속 진행되고 결과가 서버에 남으므로 이탈이 파괴적이지 않음.
- **결과 이미지는 DetailImage 재사용**: 1024×1024 PNG 원본이 커도 Lambda 리사이즈 URL(800) 우선 + 원본 fallback을 공짜로 얻음.
