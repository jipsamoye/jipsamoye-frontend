# 재연결 재동기화 확장 — 오픈채팅 + DM 방 목록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 브랜치가 커버하지 못한 두 영역 — 오픈채팅(`/chat`)과 DM 방 목록 — 에 WebSocket 재연결 시 REST 재동기화를 추가한다.

**Architecture:** 브랜치에 이미 있는 `wsService.onReconnect(handler): () => void`(재연결일 때만, 채널 재구독 완료 후 발화)를 그대로 재사용한다 — **websocket.ts는 수정하지 않는다.** 오픈채팅은 병합 로직을 순수 함수(`src/lib/chatMessages.ts`)로 추출해 단위 테스트하고 페이지는 얇게 배선(소스 텍스트 테스트로 가드), DM 방 목록은 `useDmRooms`에 `refreshRooms(openRoomId)`를 추가하고 페이지가 `selectedRoomIdRef`로 등록한다(기존 `applyRoomUpdate` 컨벤션과 동일).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Vitest + @testing-library/react.

## Global Constraints

- 브랜치: `feature/ws-reconnect-hardening` (worktree `.claude/worktrees/ws-reconnect-hardening`)에 추가 커밋. **push·머지 금지** — 사용자 결정 대기.
- 테스트 없이 커밋 불가. 각 태스크는 실패 테스트 → 실패 확인 → 구현 → 통과 → 커밋.
- `any` 사용 금지. 테스트 it() 설명은 한국어.
- `src/lib/websocket.ts` 수정 금지 (기존 `onReconnect` 재사용만).
- 오픈채팅 재조회 api.get 호출은 기존과 동일한 **단일 라인** 형태 `api.get<{ messages: ChatMessage[]; hasMore: boolean }>('/api/chat/messages?size=30', { silent: true })` 를 유지해야 함 — `tests/app/chat-silent.test.ts:12`의 regex(`api\.get<[^>]*>\([^)]*\/api\/chat\/messages[^)]*\)`)가 매칭하고 `silent: true`를 검증하는 형태.
- 백엔드 채팅 API 계약은 `size` + `beforeId`뿐 — `afterId` 같은 파라미터를 발명하지 말 것.
- 마지막 태스크에서 `npm test` 전체 + `npx next build` "Generating static pages" 통과 확인.

## 파일 구조 (전체 변경 대상)

| 파일 | 작업 |
|------|------|
| `src/lib/chatMessages.ts` | Task 1 신규 — 순수 병합 함수 |
| `tests/lib/chatMessages.test.ts` | Task 1 신규 |
| `src/app/chat/page.tsx` | Task 2 수정 — onReconnect 배선 effect 1개 추가 |
| `tests/app/chat-reconnect.test.ts` | Task 2 신규 — 소스 텍스트 테스트 |
| `src/hooks/useDmRooms.ts` | Task 3 수정 — `refreshRooms` 추가 |
| `tests/hooks/useDmRooms.test.ts` | Task 3 확장 |
| `src/app/dm/page.tsx` | Task 4 수정 — onReconnect 배선 effect 1개 추가 |
| `tests/app/dmPage.reconnectRooms.test.tsx` | Task 4 신규 — 렌더 테스트 |

베이스라인: 현재 브랜치 HEAD `d220062`, 735 tests 전부 통과.

---

### Task 1: `mergeChatMessages` — 오픈채팅 재연결 병합 순수 함수

**Files:**
- Create: `src/lib/chatMessages.ts`
- Test: `tests/lib/chatMessages.test.ts` (신규)

**Interfaces:**
- Consumes: `ChatMessage` 타입 (`src/types/api.ts:260-266` — `{ id: number; senderNickname: string; senderProfileImageUrl: string | null; content: string; createdAt: string }`)
- Produces: `mergeChatMessages(prev: ChatMessage[], fetched: ChatMessage[]): { messages: ChatMessage[]; replaced: boolean }` — Task 2가 이 시그니처를 그대로 사용.

**배경:** 채팅 서버 id는 단조 증가하고, prev는 절단 시점까지 연속이다. 최신 30개 스냅샷이 prev와 **겹치면** 없는 것만 뒤에 붙이면 순서가 보장된다. **겹침이 전혀 없으면** 30개 초과 유실(갭) — 이때 append하면 타임라인에 구멍이 생기므로 초기 로드와 동일하게 통째 교체한다(`replaced: true` → 호출부가 hasMore도 리셋). 채팅엔 clientMessageId가 없어 낙관적 에코 치환은 불필요.

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/lib/chatMessages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeChatMessages } from '@/lib/chatMessages';
import type { ChatMessage } from '@/types/api';

const makeMsg = (id: number, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderNickname: '집사',
  senderProfileImageUrl: null,
  content: `메시지 ${id}`,
  createdAt: '2026-08-03T10:00:00',
  ...overrides,
});

describe('mergeChatMessages — 재연결 스냅샷 병합', () => {
  it('겹치는 스냅샷이면 기존에 없는 메시지만 id 오름차순으로 뒤에 병합한다', () => {
    const prev = [makeMsg(1), makeMsg(2)];
    const fetched = [makeMsg(2), makeMsg(3), makeMsg(4)];

    const { messages, replaced } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(replaced).toBe(false);
  });

  it('이미 있는 id는 중복 추가하지 않는다 (WS가 재조회보다 먼저 도착한 메시지)', () => {
    const prev = [makeMsg(1), makeMsg(2), makeMsg(3)];
    const fetched = [makeMsg(2), makeMsg(3)];

    const { messages } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('겹치지 않는 스냅샷이면 통째로 교체하고 replaced=true를 반환한다 (30개 초과 유실 갭)', () => {
    const prev = [makeMsg(1), makeMsg(2)];
    const fetched = [makeMsg(50), makeMsg(51)];

    const { messages, replaced } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([50, 51]);
    expect(replaced).toBe(true);
  });

  it('prev가 비어 있으면 스냅샷으로 교체한다', () => {
    const { messages, replaced } = mergeChatMessages([], [makeMsg(1), makeMsg(2)]);

    expect(messages.map((m) => m.id)).toEqual([1, 2]);
    expect(replaced).toBe(true);
  });

  it('fetched가 비어 있으면 prev를 그대로 유지하고 replaced=false', () => {
    const prev = [makeMsg(1)];

    const { messages, replaced } = mergeChatMessages(prev, []);

    expect(messages).toBe(prev);
    expect(replaced).toBe(false);
  });

  it('내림차순으로 내려온 스냅샷도 id 오름차순으로 정렬해 병합한다', () => {
    const prev = [makeMsg(1)];
    const fetched = [makeMsg(3), makeMsg(1), makeMsg(2)];

    const { messages } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/chatMessages.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chatMessages'` 계열 에러

- [ ] **Step 3: 구현**

Create `src/lib/chatMessages.ts`:

```ts
import type { ChatMessage } from '@/types/api';

interface MergeChatMessagesResult {
  messages: ChatMessage[];
  /** 스냅샷으로 통째 교체됐는지 — true면 호출부에서 hasMore도 스냅샷 기준으로 갱신 필요 */
  replaced: boolean;
}

/**
 * 재연결 시 최신 스냅샷(fetched)을 기존 목록(prev)에 병합.
 * - 겹치는 id가 있으면(정상 케이스): 없는 것만 id 오름차순으로 뒤에 append
 * - 겹침이 전혀 없으면(스냅샷 크기 초과 유실 갭): 타임라인 구멍 대신 스냅샷으로 통째 교체
 * - prev가 비면 교체, fetched가 비면 prev 유지
 * 서버 id는 단조 증가, prev는 절단 시점까지 연속이므로 append 순서가 보장된다.
 */
export function mergeChatMessages(
  prev: ChatMessage[],
  fetched: ChatMessage[]
): MergeChatMessagesResult {
  if (fetched.length === 0) return { messages: prev, replaced: false };

  const sorted = [...fetched].sort((a, b) => a.id - b.id);
  if (prev.length === 0) return { messages: sorted, replaced: true };

  const prevIds = new Set(prev.map((m) => m.id));
  if (!sorted.some((m) => prevIds.has(m.id))) {
    return { messages: sorted, replaced: true };
  }

  const fresh = sorted.filter((m) => !prevIds.has(m.id));
  return { messages: [...prev, ...fresh], replaced: false };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/lib/chatMessages.test.ts`
Expected: 6개 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/chatMessages.ts tests/lib/chatMessages.test.ts
git commit -m "feat(chat): 재연결 병합 유틸 mergeChatMessages 추가

겹침 있으면 id 병합, 겹침 없으면(30개 초과 유실 갭) 스냅샷으로 교체.
오픈채팅 재연결 재동기화(후속 커밋)에서 사용."
```

---

### Task 2: 오픈채팅 페이지 재연결 배선

**Files:**
- Modify: `src/app/chat/page.tsx`
- Create: `tests/app/chat-reconnect.test.ts` (소스 텍스트 테스트)

**Interfaces:**
- Consumes: `mergeChatMessages` (Task 1), `wsService.onReconnect(handler: () => void): () => void` (기존), 페이지의 기존 `messagesRef`(`src/app/chat/page.tsx:46-49`) / `setMessages` / `setHasMore`
- Produces: 없음 (페이지 내부 동작)

**배경:** chat 페이지는 의도적으로 렌더 테스트하지 않는다(`tests/app/chat-source.test.ts:5-7` 주석 — WS/AuthProvider 의존이 무거움). 기존 관례대로 배선은 소스 텍스트 테스트로 가드하고, 로직은 Task 1의 단위 테스트가 담당. `messagesRef`는 이미 있는 미러 ref라 함수형 업데이터 밖에서도 최신 목록을 읽을 수 있다(`replaced` 분기 처리용).

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/app/chat-reconnect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// chat 페이지는 WS/AuthProvider 의존이 무거워 렌더 테스트 대신 소스 검증으로
// 회귀를 방지한다(동일 관례: chat-source.test.ts). 병합 로직 자체는
// tests/lib/chatMessages.test.ts 에서 단위 테스트로 검증한다.
describe('chat 페이지 — 재연결 재동기화 배선', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/app/chat/page.tsx'),
    'utf-8'
  );

  it('wsService.onReconnect를 등록하고 해제 함수를 cleanup으로 반환한다', () => {
    expect(source).toMatch(/wsService\.onReconnect\(/);
    const afterRegistration = source.slice(source.indexOf('wsService.onReconnect('));
    expect(afterRegistration).toMatch(/return unsubscribe/);
  });

  it('재조회 결과를 mergeChatMessages(messagesRef.current, ...)로 병합한다', () => {
    expect(source).toMatch(/import \{ mergeChatMessages \} from '@\/lib\/chatMessages'/);
    expect(source).toMatch(/mergeChatMessages\(messagesRef\.current/);
  });

  it('통째 교체(replaced)일 때만 hasMore를 갱신한다', () => {
    expect(source).toMatch(/if \(replaced\) setHasMore/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/app/chat-reconnect.test.ts`
Expected: 3개 전부 FAIL (`onReconnect` 미등록)

- [ ] **Step 3: 구현**

`src/app/chat/page.tsx` 수정:

(a) import 추가 (기존 `import { wsService } ...` 아래):

```ts
import { mergeChatMessages } from '@/lib/chatMessages';
```

(b) "채팅 채널 수신" effect(86~112행) **바로 아래**에 새 effect 추가:

```ts
  // 재연결 시 끊김 동안 놓친 메시지 재동기화 (최신 페이지 재조회 + id 병합)
  useEffect(() => {
    const unsubscribe = wsService.onReconnect(() => {
      api.get<{ messages: ChatMessage[]; hasMore: boolean }>('/api/chat/messages?size=30', { silent: true })
        .then((res) => {
          const { messages: merged, replaced } = mergeChatMessages(messagesRef.current, res.data?.messages ?? []);
          setMessages(merged);
          // 통째 교체(갭) 시에만 hasMore도 스냅샷 기준으로 리셋
          if (replaced) setHasMore(res.data?.hasMore ?? false);
        })
        .catch(() => {
          // 재조회 실패 — 다음 재연결 때 재시도
        });
    });
    return unsubscribe;
  }, []);
```

주의: `api.get<...>(...)` 호출은 위처럼 **한 줄**이어야 한다 (chat-silent.test.ts regex 매칭 대상).

- [ ] **Step 4: 통과 + 기존 chat 테스트 회귀 확인**

Run: `npx vitest run tests/app/chat-reconnect.test.ts tests/app/chat-silent.test.ts tests/app/chat-source.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/chat/page.tsx tests/app/chat-reconnect.test.ts
git commit -m "feat(chat): 재연결 시 오픈채팅 메시지 재동기화

끊김 동안 온 메시지가 새로고침 전까지 안 보이던 문제.
onReconnect에서 최신 30개 재조회 후 mergeChatMessages로 병합."
```

---

### Task 3: `useDmRooms.refreshRooms` — 방 목록 재조회

**Files:**
- Modify: `src/hooks/useDmRooms.ts`
- Modify: `tests/hooks/useDmRooms.test.ts` (테스트 추가)

**Interfaces:**
- Consumes: 기존 `api.get<DmRoom[]>('/api/dm/rooms')`, 기존 `setRooms`
- Produces: `refreshRooms: (openRoomId: number | null) => Promise<void>` — `UseDmRoomsResult`에 추가. Task 4가 이 시그니처를 사용.

**배경:** 서버 목록이 진실이므로 통째 교체. 단, **열려 있는 방은 `unreadCount: 0` 강제** — 열린 방의 읽음 처리 GET(useDmRoom 재동기화의 `/messages` 조회가 서버에서 읽음 처리)과 이 재조회의 순서가 보장되지 않아, 순서 무관하게 옳도록 클라이언트에서 강제한다(기존 `applyRoomUpdate`의 openRoomId 규칙과 동일). 실패 시엔 마운트 로드(`[]` 리셋)와 달리 기존 목록 유지.

- [ ] **Step 1: 실패 테스트 작성**

`tests/hooks/useDmRooms.test.ts`의 `describe('useDmRooms', ...)` 안 마지막에 추가:

```ts
  // ─── 재연결 재동기화 ─────────────────────────────────────────────────────

  it('refreshRooms: GET /api/dm/rooms 재조회로 목록을 서버 스냅샷으로 교체한다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([makeRoom({ roomId: 1, lastMessage: '이전' })]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    apiMock.get.mockResolvedValueOnce(
      successRes([
        makeRoom({ roomId: 2, lastMessage: '새 방' }),
        makeRoom({ roomId: 1, lastMessage: '갱신됨' }),
      ])
    );
    await act(() => result.current.refreshRooms(null));

    expect(result.current.rooms.map((r) => r.roomId)).toEqual([2, 1]);
    expect(result.current.rooms[1].lastMessage).toBe('갱신됨');
  });

  it('refreshRooms: 열려 있는 방(openRoomId)의 unreadCount는 0으로 강제한다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    apiMock.get.mockResolvedValueOnce(
      successRes([makeRoom({ roomId: 1, unreadCount: 5 }), makeRoom({ roomId: 2, unreadCount: 3 })])
    );
    await act(() => result.current.refreshRooms(1));

    expect(result.current.rooms.find((r) => r.roomId === 1)?.unreadCount).toBe(0);
    expect(result.current.rooms.find((r) => r.roomId === 2)?.unreadCount).toBe(3);
  });

  it('refreshRooms: 재조회 실패 시 기존 목록을 유지한다', async () => {
    apiMock.get.mockResolvedValueOnce(successRes([makeRoom({ roomId: 1 })]));
    const { result } = renderHook(() => useDmRooms('집사'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    apiMock.get.mockRejectedValueOnce(new Error('network'));
    await act(() => result.current.refreshRooms(null));

    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].roomId).toBe(1);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/hooks/useDmRooms.test.ts`
Expected: 신규 3개 FAIL (`refreshRooms is not a function`), 기존 9개 PASS

- [ ] **Step 3: 구현**

`src/hooks/useDmRooms.ts` 수정:

(a) `UseDmRoomsResult` interface에 추가 (`applyRoomUpdate` 위):

```ts
  /**
   * 재연결 시 방 목록을 서버 스냅샷으로 재동기화.
   * @param openRoomId 현재 열려 있는 방 id — 일치하면 unread를 0으로 강제(읽음 흐름 레이스 방지)
   */
  refreshRooms: (openRoomId: number | null) => Promise<void>;
```

(b) `applyRoomUpdate` 정의 아래에 추가:

```ts
  /**
   * 재연결 시 방 목록 재동기화 — 서버 스냅샷으로 통째 교체.
   * 열려 있는 방은 unreadCount 0 강제(applyRoomUpdate와 동일 규칙 —
   * 열린 방의 읽음 처리 GET과의 순서 레이스를 순서 무관하게 방어).
   * 실패 시 기존 목록 유지(마운트 로드와 달리 빈 배열 리셋 없음).
   */
  const refreshRooms = useCallback(async (openRoomId: number | null) => {
    try {
      const res = await api.get<DmRoom[]>('/api/dm/rooms');
      const fetched = res.data ?? [];
      setRooms(
        fetched.map((r) => (r.roomId === openRoomId ? { ...r, unreadCount: 0 } : r))
      );
    } catch {
      // 재조회 실패 — 기존 목록 유지, 다음 재연결 때 재시도
    }
  }, []);
```

(c) return 객체에 `refreshRooms,` 추가.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/hooks/useDmRooms.test.ts`
Expected: 12개 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useDmRooms.ts tests/hooks/useDmRooms.test.ts
git commit -m "feat(dm): useDmRooms에 재연결용 refreshRooms 추가

서버 스냅샷으로 목록 교체하되 열려 있는 방은 unread 0 강제
(열린 방 읽음 처리 GET과의 레이스를 순서 무관하게 방어)."
```

---

### Task 4: DM 페이지 재연결 배선 + 렌더 테스트

**Files:**
- Modify: `src/app/dm/page.tsx`
- Create: `tests/app/dmPage.reconnectRooms.test.tsx`

**Interfaces:**
- Consumes: `refreshRooms(openRoomId: number | null): Promise<void>` (Task 3), `wsService.onReconnect` (기존), 페이지의 기존 `selectedRoomIdRef`(`src/app/dm/page.tsx:96-99`)
- Produces: 없음

**배경:** openRoomId(=`selectedRoomId`)는 페이지 레벨 상태이므로 페이지가 등록한다 — 기존 `dm-rooms` 구독 effect(102~111행)와 같은 패턴. 핸들러 안에서는 stale closure 방지용 `selectedRoomIdRef.current`를 읽는다(기존 컨벤션). 참고: 방이 열려 있으면 `useDmRoom`의 재연결 effect도 별도로 onReconnect를 등록하므로, 테스트 헬퍼는 등록된 **모든** 핸들러를 캡처해 전부 발화시켜야 한다.

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/app/dmPage.reconnectRooms.test.tsx` (목 골격은 `tests/app/dmPage.openConversation.test.tsx`와 동일 — 그 파일의 1~47행 vi.hoisted/vi.mock 블록, `successRes`/`makePageRes`/`sampleUser` 헬퍼를 그대로 복사):

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { DmRoom, User } from '@/types/api';

// ─── vi.hoisted: 가변 모킹 값들 (dmPage.openConversation.test.tsx와 동일 골격) ──
const { apiMock, wsMock, authMock, searchParamsRef, replaceMock, routerRef } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return {
    apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    wsMock: {
      on: vi.fn(() => () => {}),
      onDmRoom: vi.fn(() => () => {}),
      onReconnect: vi.fn(() => () => {}),
      send: vi.fn(() => true),
      isConnected: vi.fn(() => true),
    },
    authMock: { user: null as User | null, loading: false },
    searchParamsRef: { current: new URLSearchParams('') },
    replaceMock,
    // router는 안정적인 동일 참조여야 한다(딥링크 effect 무한 재실행 방지)
    routerRef: { current: { replace: replaceMock } },
  };
});

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => authMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => routerRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock('@/components/common/Avatar', () => ({
  default: ({ alt }: { alt?: string }) => <div data-testid="avatar">{alt}</div>,
}));
vi.mock('@/components/common/Thumbnail', () => ({
  default: () => <div data-testid="thumbnail" />,
}));
vi.mock('@/components/common/Modal', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

import DmPage from '@/app/dm/page';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });
const makePageRes = (items: unknown[], hasNext = false) =>
  successRes({
    content: items,
    totalPages: 1,
    totalElements: items.length,
    currentPage: 0,
    size: 50,
    hasNext,
  });

const sampleUser: User = {
  nickname: '나',
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
  isFollowing: false,
} as unknown as User;

const makeRoom = (overrides: Partial<DmRoom> = {}): DmRoom => ({
  roomId: 42,
  otherUserNickname: '상대방',
  otherUserProfileImageUrl: null,
  lastMessage: '안녕',
  lastMessageAt: '2026-08-03T10:00:00',
  unreadCount: 0,
  ...overrides,
});

/**
 * wsService.onReconnect로 등록된 핸들러를 전부 캡처.
 * 방이 열려 있으면 useDmRoom의 재연결 effect도 등록하므로 여러 개일 수 있다 —
 * 재연결 시뮬레이션은 전부 발화시킨다.
 */
function captureReconnectHandlers(): { fire: () => void; off: ReturnType<typeof vi.fn> } {
  const handlers: Array<() => void> = [];
  const off = vi.fn();
  wsMock.onReconnect.mockImplementation((handler: () => void) => {
    handlers.push(handler);
    return off;
  });
  return { fire: () => handlers.forEach((h) => h()), off };
}

describe('DM 페이지 — 재연결 시 방 목록 재동기화', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    wsMock.on.mockReset();
    wsMock.onDmRoom.mockReset();
    wsMock.onReconnect.mockReset();
    wsMock.send.mockReset();
    wsMock.on.mockReturnValue(() => {});
    wsMock.onDmRoom.mockReturnValue(() => {});
    wsMock.onReconnect.mockReturnValue(() => {});
    wsMock.send.mockReturnValue(true);
    replaceMock.mockReset();
    authMock.user = sampleUser;
    authMock.loading = false;
    searchParamsRef.current = new URLSearchParams('');
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([])); // 방 목록은 빈 배열로 시작
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('재연결 시 GET /api/dm/rooms를 재조회해 목록을 갱신한다', async () => {
    const { fire } = captureReconnectHandlers();
    render(<DmPage />);
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/api/dm/rooms'));
    expect(screen.queryByText('상대방')).not.toBeInTheDocument();

    // 끊김 사이 새 방이 생긴 상황 — 재조회 스냅샷에 방 1개
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom()]));
    });
    act(() => fire());

    await waitFor(() => expect(screen.getByText('상대방')).toBeInTheDocument());
  });

  it('열려 있는 방은 재조회 스냅샷에 unreadCount가 있어도 배지를 표시하지 않는다', async () => {
    const { fire } = captureReconnectHandlers();
    // 딥링크로 방 42를 연 상태로 시작
    searchParamsRef.current = new URLSearchParams('room=42&nick=상대방');
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom({ roomId: 42, unreadCount: 0 })]));
    });
    render(<DmPage />);
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/api/dm/rooms'));

    // 재조회 스냅샷은 열린 방의 unread를 3으로 보고하지만, 열려 있으므로 0 강제 → 배지 없음
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(successRes([makeRoom({ roomId: 42, unreadCount: 3 })]));
    });
    act(() => fire());

    await waitFor(() =>
      expect(apiMock.get.mock.calls.filter((c) => c[0] === '/api/dm/rooms').length).toBeGreaterThan(1)
    );
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('언마운트 시 onReconnect 등록을 해제한다', async () => {
    const { off } = captureReconnectHandlers();
    const { unmount } = render(<DmPage />);
    await waitFor(() => expect(wsMock.onReconnect).toHaveBeenCalled());

    unmount();

    expect(off).toHaveBeenCalled();
  });

  it('미로그인 상태에서는 onReconnect를 등록하지 않는다', () => {
    authMock.user = null;
    render(<DmPage />);

    expect(wsMock.onReconnect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/app/dmPage.reconnectRooms.test.tsx`
Expected: "미로그인" 제외 3개 FAIL (`onReconnect` 미등록 — fire해도 재조회 없음). "미로그인" 테스트는 구현 전에도 통과할 수 있음 — 회귀 방지용 유지.

- [ ] **Step 3: 구현**

`src/app/dm/page.tsx` 수정:

(a) 66행 destructure에 `refreshRooms` 추가:

```ts
  const { rooms, setRooms, resetUnread, updateLastMessage, applyServerLastMessage, applyRoomUpdate, refreshRooms } =
    useDmRooms(user?.nickname ?? null);
```

(b) 기존 "사용자별 DM 방 채널 구독" effect(102~111행) 바로 아래에 추가:

```ts
  // ─── 재연결 시 방 목록 재동기화 (끊김 동안의 새 방/배지 반영) ─────────────
  useEffect(() => {
    if (!user) return;
    const unsubscribe = wsService.onReconnect(() => {
      refreshRooms(selectedRoomIdRef.current);
    });
    return unsubscribe;
  }, [user, refreshRooms]);
```

- [ ] **Step 4: 통과 + 기존 DM 테스트 회귀 확인**

Run: `npx vitest run tests/app/dmPage.reconnectRooms.test.tsx tests/app/dmPage.openConversation.test.tsx tests/hooks/useDmRooms.test.ts tests/hooks/useDmRoom.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/dm/page.tsx tests/app/dmPage.reconnectRooms.test.tsx
git commit -m "feat(dm): 재연결 시 방 목록 재동기화 와이어링

끊김 동안 생긴 새 방·안읽음 배지가 새로고침 전까지 반영 안 되던 문제.
페이지가 onReconnect에서 refreshRooms(selectedRoomIdRef.current) 호출."
```

---

### Task 5: 최종 검증 — 전체 테스트 + production 빌드

**Files:** 없음 (검증만. 실패 시 원인 파일 수정)

**Interfaces:**
- Consumes: Task 1~4의 전체 변경
- Produces: 검증 완료된 브랜치 (push·머지는 하지 않음)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전체 PASS (기존 735 + 신규 ~16)

- [ ] **Step 2: lint**

Run: `npx eslint src/lib/chatMessages.ts src/app/chat/page.tsx src/hooks/useDmRooms.ts src/app/dm/page.tsx tests/lib/chatMessages.test.ts tests/app/chat-reconnect.test.ts tests/hooks/useDmRooms.test.ts tests/app/dmPage.reconnectRooms.test.tsx`
Expected: 에러 0, 경고 0 (경고도 수정 대상)

- [ ] **Step 3: production 빌드**

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과, exit 0

- [ ] **Step 4: 실패 시 수정 후 재검증 + 커밋**

빌드/lint 실패 시 원인을 수정하고 Step 1~3을 다시 통과시킨 뒤:

```bash
git add -A
git commit -m "fix: 재동기화 확장 빌드/lint 수정"
```

(실패가 없으면 이 스텝은 스킵. **push는 하지 않는다.**)

---

## Self-Review 결과

- **스펙 커버리지:** 오픈채팅 재동기화 → Task 1+2, DM 방 목록 재동기화 → Task 3+4, 검증 → Task 5. 승인된 계획(/Users/jys/.claude/plans/dapper-crafting-map.md)의 모든 항목 매핑됨.
- **타입 일관성:** `mergeChatMessages(prev, fetched): { messages, replaced }` — Task 1 정의·Task 2 사용 일치. `refreshRooms(openRoomId: number | null): Promise<void>` — Task 3 정의·Task 4 사용 일치.
- **알려진 수용 한계:** 30개 초과 유실 시 통째 교체로 스크롤 점프 가능(beforeId로 복구), 끊김 동안 PROFILE_UPDATED 이벤트 미재생(외형만), 연속 재연결 시 GET 중복(병합 멱등이라 무해).
