# 게시글 상세 공유 UX 통일 (네이티브 공유 시트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시글 상세의 공유하기 버튼을 AI 키캡 결과 공유와 동일한 UX(navigator.share 네이티브 시트 → 클립보드 복사 폴백)로 통일한다.

**Architecture:** 공유 로직을 `src/lib/share.ts`의 `shareOrCopyLink` 유틸 하나로 추출하고, `FigurineCreator`(기존 로직 이관)와 게시글 상세 페이지(모달 제거 후 직접 호출) 양쪽이 이 유틸을 쓴다. 에러 안내(토스트)는 유틸 내부에서 완결되어 호출부는 fire-and-forget.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vitest + @testing-library/react

**작업 위치:** 워크트리 `/Users/jys/jipsamoye-worktrees/post-share-native` (브랜치 `feature/post-share-native`, origin/main 기준). 모든 명령은 이 디렉터리에서 실행.

## Global Constraints

- 토스트 문구는 기존과 동일하게 유지: 성공 `링크가 복사됐어요!`, 실패 `링크 복사에 실패했어요.`
- 키캡 공유 제목 `AI 키캡 피규어 — 집사모여` 변경 금지 (기존 테스트가 검증함).
- `any` 사용 금지, 컴포넌트에서 직접 fetch 금지 (CLAUDE.md).
- 커밋 전 반드시 해당 테스트 통과. push 전 `npx next build` 통과 (Generating static pages 단계까지).
- 커밋 메시지 말미에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: 공용 공유 유틸 `shareOrCopyLink`

**Files:**
- Create: `src/lib/share.ts`
- Test: `tests/lib/share.test.ts`

**Interfaces:**
- Consumes: `showToast(message: string)` from `@/components/common/Toast` (기존).
- Produces: `shareOrCopyLink(options: { title: string; url: string }): Promise<void>` — Task 2·3이 import.

- [ ] **Step 1: Write the failing test**

`tests/lib/share.test.ts` 전체 내용:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shareOrCopyLink } from '@/lib/share';

const { toastMock } = vi.hoisted(() => ({ toastMock: { showToast: vi.fn() } }));
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));

function setNavigatorProp(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { writable: true, configurable: true, value });
}

describe('shareOrCopyLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorProp('share', undefined);
    setNavigatorProp('clipboard', undefined);
  });

  it('navigator.share 지원 시 title·url로 네이티브 공유 시트를 연다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('share', share);

    await shareOrCopyLink({ title: '제목 — 집사모여', url: 'https://jipsamoye.com/posts/7' });

    expect(share).toHaveBeenCalledWith({ title: '제목 — 집사모여', url: 'https://jipsamoye.com/posts/7' });
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('공유 시트를 닫아 reject(AbortError)돼도 토스트 없이 조용히 끝난다', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError'));
    setNavigatorProp('share', share);

    await expect(
      shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' }),
    ).resolves.toBeUndefined();
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('navigator.share 미지원 시 클립보드에 url을 복사하고 성공 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('clipboard', { writeText });

    await shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' });

    expect(writeText).toHaveBeenCalledWith('https://jipsamoye.com/posts/7');
    expect(toastMock.showToast).toHaveBeenCalledWith('링크가 복사됐어요!');
  });

  it('클립보드 복사 실패 시 실패 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setNavigatorProp('clipboard', { writeText });

    await shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' });

    expect(toastMock.showToast).toHaveBeenCalledWith('링크 복사에 실패했어요.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/lib/share.test.ts`
Expected: FAIL — `Cannot find module '@/lib/share'` (또는 동등한 resolve 에러)

- [ ] **Step 3: Write minimal implementation**

`src/lib/share.ts` 전체 내용:

```ts
import { showToast } from '@/components/common/Toast';

/**
 * 네이티브 공유 시트(navigator.share) 우선, 미지원 브라우저는 클립보드 복사 폴백.
 * 안내 토스트까지 내부에서 처리하므로 호출부는 fire-and-forget으로 쓴다.
 */
export async function shareOrCopyLink({ title, url }: { title: string; url: string }): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      // 공유 시트를 닫은 경우(AbortError) — 안내 불필요
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showToast('링크가 복사됐어요!');
  } catch {
    showToast('링크 복사에 실패했어요.');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/lib/share.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/jys/jipsamoye-worktrees/post-share-native
git add src/lib/share.ts tests/lib/share.test.ts
git commit -m "feat(share): 네이티브 공유 시트 + 클립보드 폴백 공용 유틸 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: FigurineCreator를 공용 유틸로 리팩터링 (동작 보존)

**Files:**
- Modify: `src/components/domain/FigurineCreator.tsx:130-149` (`handleShare`)
- Test: `tests/components/FigurineCreator.share.test.tsx` (기존 파일, 수정 없음 — 통과 확인용)

**Interfaces:**
- Consumes: `shareOrCopyLink({ title, url })` from `@/lib/share` (Task 1), `buildFigurineShareUrl(resultImageUrl, origin)` from `@/lib/figurineShare` (기존).
- Produces: 없음 (동작 불변 리팩터링).

- [ ] **Step 1: 기존 테스트가 현재 통과하는지 먼저 확인 (베이스라인)**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/components/FigurineCreator.share.test.tsx`
Expected: PASS

- [ ] **Step 2: `handleShare` 교체**

`src/components/domain/FigurineCreator.tsx` 상단 import에 추가:

```ts
import { shareOrCopyLink } from '@/lib/share';
```

기존 `handleShare`(130~149행)를 아래로 교체:

```ts
  const handleShare = async () => {
    if (!job?.resultImageUrl) return;
    const shareUrl = buildFigurineShareUrl(job.resultImageUrl, window.location.origin);
    await shareOrCopyLink({ title: 'AI 키캡 피규어 — 집사모여', url: shareUrl });
  };
```

이때 `showToast` import가 `FigurineCreator.tsx`의 다른 곳에서 여전히 쓰이는지 확인하고, 안 쓰이면 import에서 제거한다 (쓰이면 유지).

- [ ] **Step 3: 기존 테스트 그대로 통과 확인 (동작 보존)**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/components/FigurineCreator.share.test.tsx tests/components/FigurineCreator.test.tsx`
Expected: PASS — 테스트 파일 수정 없이 통과해야 리팩터링 성공. (기존 테스트는 `@/components/common/Toast`를 모킹하므로 유틸 내부의 showToast 호출도 동일하게 잡힌다.)

- [ ] **Step 4: Commit**

```bash
cd /Users/jys/jipsamoye-worktrees/post-share-native
git add src/components/domain/FigurineCreator.tsx
git commit -m "refactor(figurine): 공유 로직을 shareOrCopyLink 공용 유틸로 이관

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 게시글 상세 공유 모달 제거 + 네이티브 공유 연결

**Files:**
- Modify: `src/app/posts/[id]/page.tsx`
- Test: `tests/app/postDetailShare.test.tsx` (신규)

**Interfaces:**
- Consumes: `shareOrCopyLink({ title, url })` from `@/lib/share` (Task 1).
- Produces: 없음 (최종 소비자).

- [ ] **Step 1: Write the failing test**

`tests/app/postDetailShare.test.tsx` 전체 내용:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PetPost, User } from '@/types/api';

const { routerMock, apiMock, authMock, shareMock, toastMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  shareMock: { shareOrCopyLink: vi.fn() },
  toastMock: { showToast: vi.fn(), showLoginRequiredToast: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useOpenDm', () => ({ useOpenDm: () => vi.fn() }));
vi.mock('@/lib/share', () => shareMock);
vi.mock('@/components/common/Toast', () => toastMock);
vi.mock('@/components/common/Avatar', () => ({ default: () => <div /> }));
vi.mock('@/components/common/DetailImage', () => ({
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));
vi.mock('@/components/domain/PostCard', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/CommentSection', () => ({ default: () => <div /> }));

import PostDetailPage from '@/app/posts/[id]/page';

const post: PetPost = {
  id: 7,
  title: '우리집 고양이',
  content: '자랑합니다',
  imageUrls: ['https://images.jipsamoye.com/posts/7/1.png'],
  likeCount: 3,
  commentCount: 0,
  nickname: '집사',
  profileImageUrl: null,
  createdAt: '2026-07-23T10:00:00',
  updatedAt: '2026-07-23T10:00:00',
  isLiked: false,
  aiGenerated: false,
};

describe('게시글 상세 — 공유하기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/api/posts/7') return Promise.resolve({ data: post });
      return Promise.resolve({ data: { content: [] } });
    });
  });

  async function renderPage() {
    render(
      <Suspense fallback={null}>
        <PostDetailPage params={Promise.resolve({ id: '7' })} />
      </Suspense>,
    );
    return screen.findByText('공유하기');
  }

  it('공유하기 클릭 시 모달 없이 바로 shareOrCopyLink를 게시글 제목·현재 URL로 호출한다', async () => {
    const shareButton = await renderPage();
    fireEvent.click(shareButton);

    await waitFor(() =>
      expect(shareMock.shareOrCopyLink).toHaveBeenCalledWith({
        title: '우리집 고양이 — 집사모여',
        url: window.location.href,
      }),
    );
    expect(screen.queryByText('집사모여의 게시글을 공유해보세요!')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/app/postDetailShare.test.tsx`
Expected: FAIL — 현재 구현은 클릭 시 공유 모달을 열기 때문에 `shareOrCopyLink`가 호출되지 않음.

- [ ] **Step 3: 페이지 수정**

`src/app/posts/[id]/page.tsx`에서:

1. import 정리 — 아래 두 줄 삭제 (Modal·LinkIcon은 공유 모달에서만 사용):
```ts
import Modal from '@/components/common/Modal';
import { LinkIcon } from '@/components/layout/icons';
```
   추가:
```ts
import { shareOrCopyLink } from '@/lib/share';
```

2. state 삭제 (31행):
```ts
const [showShareModal, setShowShareModal] = useState(false);
```

3. `handleCopyLink` 함수 전체 삭제 (89~96행).

4. `PostActions`의 `onShare` 교체:
```tsx
      <PostActions
        likeCount={post.likeCount}
        liked={liked}
        onLike={handleLike}
        onShare={() => {
          void shareOrCopyLink({ title: `${post.title} — 집사모여`, url: window.location.href });
        }}
      />
```

5. 파일 하단 `{/* 공유 모달 */}` 주석부터 `</Modal>`까지의 공유 모달 JSX 블록 전체 삭제.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx vitest run tests/app/postDetailShare.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/jys/jipsamoye-worktrees/post-share-native
git add 'src/app/posts/[id]/page.tsx' tests/app/postDetailShare.test.tsx
git commit -m "feat(post): 게시글 상세 공유를 네이티브 공유 시트로 통일 (모달 제거)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 전체 검증 (전체 테스트 + production 빌드)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npm test`
Expected: 전부 PASS (기존 스위트 회귀 없음)

- [ ] **Step 2: Production 빌드**

Run: `cd /Users/jys/jipsamoye-worktrees/post-share-native && npx next build`
Expected: "Generating static pages" 단계까지 성공, exit 0

- [ ] **Step 3: 실패 시** 원인 수정 후 Step 1부터 재실행. 수정 커밋은 해당 Task 커밋에 fixup하지 말고 별도 fix 커밋으로 남긴다.
