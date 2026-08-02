# WS 재연결 보강 (Reconnect Hardening) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 STOMP heartbeat(25초) 도입으로 "끊김·재연결"이 정상 시나리오가 됨에 따라, 재연결 시 REST 재동기화·비정상 절단 감지·세션 만료 처리·지수 백오프·백그라운드 탭 heartbeat worker를 프론트에 추가한다.

**Architecture:** 모든 변경의 중심은 싱글턴 `wsService`(`src/lib/websocket.ts`)다. 여기에 (a) 재연결 전용 이벤트(`onReconnect`), (b) `onWebSocketClose` 핸들러(비정상 절단 시 `connected` 정리 + 연속 실패 카운트), (c) 연속 실패 임계치 도달 시 REST 세션 프로브, (d) stompjs 7.3 내장 백오프/worker 옵션을 추가한다. 소비자 측은 `NotificationProvider`와 `useDmRoom`이 `onReconnect`를 구독해 REST 재조회 + id 기준 중복 제거 병합을 수행한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `@stomp/stompjs` 7.3.0 (설치 확인됨), SockJS, Vitest + @testing-library/react.

## Global Constraints

- 브랜치: `feature/ws-reconnect-hardening` (worktree `.claude/worktrees/ws-reconnect-hardening`). **main에 머지·push 금지** — 로컬 커밋만. 사용자가 결과 보고 후 결정.
- 테스트 없이 커밋 불가 (CLAUDE.md). 각 태스크는 실패 테스트 → 구현 → 통과 → 커밋 순서.
- `any` 사용 금지. API 응답은 반드시 타입 정의해서 사용.
- 마지막 태스크에서 `npx next build`가 "Generating static pages" 단계까지 통과해야 함.
- stompjs enum 정확한 이름: `ReconnectionTimeMode.EXPONENTIAL` (`ReconnectTimeMode` 아님), `TickerStrategy.Worker` (문자열 `'worker'`는 TS 컴파일 에러 — enum import 필수).
- 클라이언트 heartbeat 값(기본 10000,10000)은 그대로 둔다 — STOMP 협상 규칙(방향별 max)에 따라 서버 광고 25000과 자동으로 25초로 협상됨. **outgoing/incoming heartbeat 옵션을 추가하지 말 것.**
- 지터(jitter)는 구현하지 않는다 (확정된 결정 — 내장 EXPONENTIAL로 충분).
- 재시도 실패 임계치: 연속 **5회**. 세션 프로브 엔드포인트: `GET /api/notifications/unread-count`.
- 테스트 it() 설명은 기존 관례대로 한국어.
- 알려진 한계(의도된 스코프 아웃, 구현하지 말 것): DM **방 목록**(`useDmRooms`)의 재연결 재조회는 핸드오프에서 제외됨. 열려 있는 방의 메시지만 재동기화한다.

## 파일 구조 (전체 변경 대상)

| 파일 | 작업 |
|------|------|
| `src/lib/websocket.ts` | Task 1~4에서 수정 (onReconnect, onWebSocketClose, 세션 프로브, 백오프/worker 옵션) |
| `tests/lib/websocket.test.ts` | Task 1에서 목 하네스 개편, Task 1~4에서 테스트 추가 |
| `src/components/providers/NotificationProvider.tsx` | Task 5에서 수정 (재연결 재조회 + id 병합) |
| `tests/providers/NotificationProvider.test.tsx` | Task 5에서 신규 생성 |
| `src/hooks/useDmRoom.ts` | Task 6에서 수정 (재연결 시 열린 방 재동기화) |
| `tests/hooks/useDmRoom.test.ts` | Task 6에서 테스트 추가 |

베이스라인 확인됨: 81 test files / 706 tests 전부 통과 (worktree에서 `npm test` 실행, 2026-08-02).

---

### Task 1: `wsService.onReconnect` — 최초 연결/재연결 구분 이벤트

**Files:**
- Modify: `src/lib/websocket.ts`
- Modify: `tests/lib/websocket.test.ts` (목 하네스 개편 + 테스트 추가)

**Interfaces:**
- Consumes: 기존 `wsService` 싱글턴 (`connect`, `disconnect`, `onConnect` 콜백 구조)
- Produces: `wsService.onReconnect(handler: () => void): () => void` — **재연결일 때만**(두 번째 이후 CONNECTED) 발화. 반환값은 해제 함수. 발화 시점은 **onConnect 내 채널 재구독이 끝난 뒤**. Task 5, 6이 이 시그니처를 그대로 사용한다.

**배경:** stompjs는 재연결 시에도 같은 `onConnect` 콜백을 부른다. 최초 연결과 재연결을 구분하는 플래그(`hasConnectedOnce`)를 두고, 재연결일 때만 등록된 핸들러들을 발화시킨다. 명시적 `disconnect()`(로그아웃 등) 후의 새 `connect()`는 다시 "최초 연결"로 취급한다.

- [ ] **Step 1: 테스트 목 하네스 개편 (뒤 태스크들이 공유할 기반)**

`tests/lib/websocket.test.ts` 상단의 목 블록(1~51행: `showToastMock`부터 `import { wsService }` 직전까지)을 아래로 **전면 교체**한다. 변경점: (1) config 타입에 `reconnectDelay`/`maxReconnectDelay`/`reconnectTimeMode`/`heartbeatStrategy`/`onWebSocketClose` 추가, (2) stompjs 목을 `importOriginal` 스프레드로 바꿔 실제 enum(`ReconnectionTimeMode`, `TickerStrategy`)을 통과시킴, (3) `@/lib/api` 목 추가(Task 3에서 사용, 지금 넣어도 무해). 기존 테스트 본문(describe/it)은 건드리지 않는다.

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const showToastMock = vi.fn();
vi.mock('@/components/common/Toast', () => ({
  showToast: (text: string) => showToastMock(text),
}));

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

interface MockClientConfig {
  webSocketFactory: () => unknown;
  reconnectDelay: number;
  maxReconnectDelay?: number;
  reconnectTimeMode?: unknown;
  heartbeatStrategy?: unknown;
  onConnect: () => void;
  onDisconnect: () => void;
  onWebSocketClose?: () => void;
  onStompError: (frame: { headers: Record<string, string> }) => void;
}

const { clientInstances, sockJsInstances } = vi.hoisted(() => ({
  clientInstances: [] as Array<{
    config: {
      webSocketFactory: () => unknown;
      reconnectDelay: number;
      maxReconnectDelay?: number;
      reconnectTimeMode?: unknown;
      heartbeatStrategy?: unknown;
      onConnect: () => void;
      onDisconnect: () => void;
      onWebSocketClose?: () => void;
      onStompError: (frame: { headers: Record<string, string> }) => void;
    };
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }>,
  sockJsInstances: [] as Array<{ url: string; options: unknown }>,
}));

vi.mock('@stomp/stompjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stomp/stompjs')>();
  return {
    ...actual,
    Client: class {
      activate = vi.fn();
      deactivate = vi.fn();
      publish = vi.fn();
      subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
      constructor(config: unknown) {
        const instance = {
          config: config as MockClientConfig,
          activate: this.activate,
          deactivate: this.deactivate,
          publish: this.publish,
          subscribe: this.subscribe,
        };
        clientInstances.push(instance as unknown as (typeof clientInstances)[number]);
      }
    },
  };
});

vi.mock('sockjs-client', () => ({
  default: class {
    constructor(url: string, _protocols: unknown, options: unknown) {
      sockJsInstances.push({ url, options });
    }
  },
}));

import { wsService } from '@/lib/websocket';
```

주의: `MockClientConfig` interface는 `vi.hoisted` 밖(파일 최상위)에 선언한다. `vi.hoisted` 내부의 배열 타입 리터럴은 hoisting 제약 때문에 interface를 참조할 수 없어 위처럼 인라인으로 중복 기술한다.

기존 `beforeEach`에 `apiMock` 리셋을 추가한다:

```ts
  beforeEach(() => {
    wsService.disconnect();
    clientInstances.length = 0;
    sockJsInstances.length = 0;
    showToastMock.mockClear();
    apiMock.get.mockReset();
  });
```

- [ ] **Step 2: 하네스 개편 후 기존 테스트 전부 통과 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 기존 15개 테스트 전부 PASS (하네스 개편이 회귀를 만들지 않았는지 확인)

- [ ] **Step 3: onReconnect 실패 테스트 작성**

`tests/lib/websocket.test.ts`의 최상위 `describe('wsService', ...)` 안에 추가:

```ts
  describe('onReconnect — 재연결 전용 이벤트', () => {
    it('최초 연결(첫 onConnect) 시에는 발화하지 않는다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);

      clientInstances[0].config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('재연결(두 번째 onConnect) 시 1회 발화한다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);
      const client = clientInstances[0];

      client.config.onConnect();
      client.config.onDisconnect();
      client.config.onConnect();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('재연결 발화 시점은 채널 재구독이 끝난 뒤다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      let subscribedAtFire: string[] = [];
      wsService.onReconnect(() => {
        subscribedAtFire = client.subscribe.mock.calls.map((call) => call[0] as string);
      });

      client.config.onConnect();
      client.config.onDisconnect();
      client.subscribe.mockClear();
      client.config.onConnect();

      expect(subscribedAtFire).toContain('/user/sub/notifications');
      expect(subscribedAtFire).toContain('/user/sub/dm/rooms');
    });

    it('명시적 disconnect 후 새 connect의 첫 onConnect는 최초 연결로 취급한다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);
      clientInstances[0].config.onConnect();

      wsService.disconnect();
      wsService.connect('테스터');
      clientInstances[1].config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('해제 함수 호출 후에는 발화하지 않는다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      const off = wsService.onReconnect(handler);
      const client = clientInstances[0];

      client.config.onConnect();
      off();
      client.config.onDisconnect();
      client.config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 신규 5개 FAIL — `wsService.onReconnect is not a function`

- [ ] **Step 5: 구현**

`src/lib/websocket.ts` 수정:

(a) 필드 추가 — `private authRejected = false;`(19행) 아래:

```ts
  /** 최초 연결과 재연결 구분 — 명시적 disconnect 시 리셋 */
  private hasConnectedOnce = false;
  private reconnectHandlers: Set<() => void> = new Set();
```

(b) `onConnect` 콜백(39~49행) — `pendingDmRooms` 재구독 forEach **뒤**에 추가:

```ts
        // 재연결이면(최초 연결 제외) 재구독 완료 후 재동기화 이벤트 발화
        if (this.hasConnectedOnce) {
          this.reconnectHandlers.forEach((handler) => handler());
        }
        this.hasConnectedOnce = true;
```

(c) `disconnect()`(126행) — `this.connected = false;` 아래에 추가:

```ts
    this.hasConnectedOnce = false;
```

(주의: `reconnectHandlers`는 `disconnect()`에서 비우지 않는다 — `channelHandlers`와 동일하게 소비자 컴포넌트가 해제 함수로 직접 관리.)

(d) public 메서드 추가 — `on()` 메서드 아래:

```ts
  /**
   * 재연결(두 번째 이후 CONNECTED) 시에만 발화하는 이벤트 등록.
   * 발화 시점은 채널 재구독 완료 후 — 핸들러에서 REST 재동기화를 수행해도
   * 이후 WS 수신과 병합 가능. 반환값은 해제 함수.
   */
  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 전체 PASS (기존 15 + 신규 5)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/websocket.ts tests/lib/websocket.test.ts
git commit -m "feat(ws): 재연결 전용 onReconnect 이벤트 추가

최초 연결/재연결을 hasConnectedOnce 플래그로 구분하고,
재연결 시 채널 재구독 완료 후 등록된 핸들러를 발화한다.
알림·DM REST 재동기화(후속 커밋)의 기반."
```

---

### Task 2: `onWebSocketClose` — 비정상 절단 시 connected 플래그 정리

**Files:**
- Modify: `src/lib/websocket.ts`
- Modify: `tests/lib/websocket.test.ts`

**Interfaces:**
- Consumes: Task 1의 목 하네스 (`config.onWebSocketClose?: () => void` 타입 이미 준비됨)
- Produces: `Client` config에 `onWebSocketClose` 콜백 — `connected = false` + `subscriptions.clear()`. Task 3이 같은 핸들러에 실패 카운트를 추가한다.

**배경:** stompjs `onDisconnect`는 정상 종료(DISCONNECT 프레임)에만 발화한다. heartbeat 강제 종료·네트워크 순단 같은 비정상 절단 시 `connected`가 `true`로 남아 `send()`가 죽은 연결에 `true`를 반환(DM 전송 실패가 성공처럼 보임)하고, `subscribeDmRoomNow()`가 죽은 client에 subscribe를 시도한다. `onWebSocketClose`는 소켓이 닫힐 때마다(정상/비정상 모두) 발화하므로 여기서 정리한다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/websocket.test.ts`에 추가:

```ts
  describe('onWebSocketClose — 비정상 절단 정리', () => {
    it('비정상 절단(onWebSocketClose) 시 connected=false → send가 false를 반환한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();
      expect(wsService.send('/pub/dm/send', { roomId: 1, content: '안녕' })).toBe(true);

      client.config.onWebSocketClose?.();

      expect(wsService.isConnected()).toBe(false);
      expect(wsService.send('/pub/dm/send', { roomId: 1, content: '안녕' })).toBe(false);
    });

    it('비정상 절단 후 재연결(onConnect) 시 DM 방이 재구독된다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();
      wsService.onDmRoom(42, vi.fn());

      client.config.onWebSocketClose?.();
      client.subscribe.mockClear();
      client.config.onConnect();

      const destinations = client.subscribe.mock.calls.map((call) => call[0] as string);
      expect(destinations).toContain('/sub/dm/room/42');
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 신규 2개 FAIL — `onWebSocketClose`가 config에 없어 옵셔널 체이닝으로 no-op → `send`가 여전히 `true` / 첫 번째 테스트의 `isConnected()` assertion 실패

- [ ] **Step 3: 구현**

`src/lib/websocket.ts`의 Client config에서 `onDisconnect` 콜백 아래에 추가:

```ts
      onWebSocketClose: () => {
        // onDisconnect는 정상 종료(DISCONNECT 프레임)에만 발화 —
        // heartbeat 강제 종료·네트워크 순단 등 모든 소켓 절단은 여기서 정리
        this.connected = false;
        this.subscriptions.clear();
      },
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/websocket.ts tests/lib/websocket.test.ts
git commit -m "fix(ws): 비정상 절단 시 connected 플래그 정리 (onWebSocketClose)

heartbeat 강제 종료·네트워크 순단은 onDisconnect가 발화하지 않아
connected=true가 남고, send()가 죽은 연결에 true를 반환하던 문제 수정."
```

---

### Task 3: 세션 만료(핸드셰이크 403) 감지 — 연속 실패 카운트 + REST 프로브

**Files:**
- Modify: `src/lib/websocket.ts`
- Modify: `tests/lib/websocket.test.ts`

**Interfaces:**
- Consumes: Task 2의 `onWebSocketClose` 핸들러, Task 1 하네스의 `apiMock`, `src/lib/api.ts`의 `api.get<T>(endpoint, { silent: true })` — 401 시 `{ status: 401, code: 'UNAUTHORIZED', ... }` throw, 4xx/5xx는 `status` 포함 객체 throw
- Produces: 없음 (내부 동작) — 연속 5회 실패 시 프로브, 만료 확정 시 기존 `authRejected` 경로와 동일한 토스트

**배경:** 서버 세션(2h) 만료 시 SockJS 핸드셰이크가 403으로 거부된다. STOMP 프레임 이전 단계라 `onStompError`에 안 걸리고 조용히 영원히 재시도한다. "CONNECTED에 한 번도 도달 못 한 연속 실패"를 `onWebSocketClose`에서 세고 `onConnect`에서 리셋, 임계치(5회) 도달 시: (1) `deactivate()`로 재시도 중단 → (2) `GET /api/notifications/unread-count` 프로브(silent — api.ts의 401 토스트 중복 방지) → (3) 401/403이면 만료 확정: `authRejected` + 토스트 + `disconnect()`. 프로브가 성공하거나 네트워크 오류(서버 다운 등)면 세션은 유효할 수 있으므로 카운터 리셋 후 `activate()`로 재시도 재개.

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/websocket.test.ts`에 추가:

```ts
  describe('세션 프로브 — 핸드셰이크 연속 실패', () => {
    const closeTimes = (client: (typeof clientInstances)[number], n: number) => {
      for (let i = 0; i < n; i += 1) client.config.onWebSocketClose?.();
    };

    it('연속 5회 실패 시 deactivate 후 unread-count로 세션 프로브한다', async () => {
      apiMock.get.mockResolvedValue({ status: 200, code: 'SUCCESS', message: '', data: 0 });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(apiMock.get).toHaveBeenCalledWith('/api/notifications/unread-count', { silent: true });
      });
      expect(client.deactivate).toHaveBeenCalled();
    });

    it('프로브 성공(세션 유효) 시 카운터 리셋 후 재시도를 재개한다', async () => {
      apiMock.get.mockResolvedValue({ status: 200, code: 'SUCCESS', message: '', data: 0 });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      // connect() 시 1회 + 프로브 후 재개 1회
      await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
      expect(showToastMock).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('프로브 401 시 토스트 + authRejected + 재시도 중단', async () => {
      apiMock.get.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
      });
      expect(wsService.isAuthRejected()).toBe(true);
      // 재개(activate 2회째) 없음
      expect(client.activate).toHaveBeenCalledTimes(1);
    });

    it('프로브 403 시에도 만료로 확정한다', async () => {
      apiMock.get.mockRejectedValue({ status: 403, code: 'FORBIDDEN', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
      });
      expect(wsService.isAuthRejected()).toBe(true);
    });

    it('프로브 네트워크 오류(서버 다운) 시 만료로 취급하지 않고 재시도를 재개한다', async () => {
      apiMock.get.mockRejectedValue({ status: 503, code: 'HTTP_ERROR', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
      expect(showToastMock).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('onConnect가 카운터를 리셋한다 — 4회 실패 후 연결되면 프로브하지 않는다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 4);
      client.config.onConnect();
      closeTimes(client, 4);

      expect(apiMock.get).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 신규 6개 중 "카운터 리셋" 제외 5개 FAIL (`apiMock.get` 미호출 등). "카운터 리셋" 테스트는 구현 전에도 통과할 수 있음(아직 프로브 자체가 없으므로) — 회귀 방지용으로 유지.

- [ ] **Step 3: 구현**

`src/lib/websocket.ts` 수정:

(a) import 추가:

```ts
import { api } from '@/lib/api';
```

(b) 모듈 상수 (class 선언 위):

```ts
/** CONNECTED에 도달하지 못한 연속 소켓 절단 횟수가 이 값에 달하면 세션 프로브 */
const CONSECUTIVE_FAILURE_THRESHOLD = 5;
```

(c) 필드 추가 (`reconnectHandlers` 아래):

```ts
  private consecutiveFailures = 0;
  private probing = false;
```

(d) `connect()` — `this.authRejected = false;` 아래에 추가:

```ts
    this.consecutiveFailures = 0;
```

(e) `onConnect` 콜백 — `this.connected = true;` 아래에 추가:

```ts
        this.consecutiveFailures = 0;
```

(f) Task 2의 `onWebSocketClose` 핸들러를 다음으로 교체:

```ts
      onWebSocketClose: () => {
        // onDisconnect는 정상 종료(DISCONNECT 프레임)에만 발화 —
        // heartbeat 강제 종료·네트워크 순단 등 모든 소켓 절단은 여기서 정리
        this.connected = false;
        this.subscriptions.clear();
        // 세션(2h) 만료 시 SockJS 핸드셰이크가 403 거부 — STOMP 이전 단계라
        // onStompError에 안 걸리고 조용히 무한 재시도하므로 연속 실패를 세어 판별
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
          void this.probeSession();
        }
      },
```

(g) private 메서드 추가 (`subscribeDmRoomNow` 아래):

```ts
  /**
   * 핸드셰이크 연속 실패 시 세션 유효성 판별.
   * 재시도를 멈추고 REST로 세션을 확인 — 401/403이면 만료 확정(로그인 안내),
   * 그 외(성공·네트워크 오류)면 카운터 리셋 후 재시도 재개.
   */
  private async probeSession(): Promise<void> {
    if (this.probing || !this.client) return;
    this.probing = true;
    const client = this.client;
    try {
      await client.deactivate();
      await api.get<number>('/api/notifications/unread-count', { silent: true });
      // 세션 유효 — 서버 WS만 문제일 수 있으므로 재시도 재개
      this.consecutiveFailures = 0;
      if (this.client === client) client.activate();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        this.authRejected = true;
        showToast('로그인하고 이용해 주세요');
        this.disconnect();
      } else {
        // 서버 다운 등 — 세션 만료 아님, 재시도 재개
        this.consecutiveFailures = 0;
        if (this.client === client) client.activate();
      }
    } finally {
      this.probing = false;
    }
  }
```

주의: `deactivate()` 자체가 소켓 close를 유발해 `onWebSocketClose`가 재진입할 수 있으나 `probing` 가드가 중복 프로브를 막는다. `this.client === client` 가드는 프로브 중 명시적 `disconnect()`(로그아웃)가 일어난 경우 버려진 client를 되살리지 않기 위함이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/websocket.ts tests/lib/websocket.test.ts
git commit -m "feat(ws): 세션 만료(핸드셰이크 403) 감지 — 연속 실패 5회 시 REST 프로브

SockJS 핸드셰이크 403은 onStompError에 안 걸려 무한 재시도하던 문제.
연속 절단 5회에 unread-count로 세션을 프로브해 401/403이면
기존 authRejected 경로(토스트+중단), 아니면 재시도 재개."
```

---

### Task 4: 지수 백오프 + 백그라운드 탭 heartbeat worker (config 옵션)

**Files:**
- Modify: `src/lib/websocket.ts`
- Modify: `tests/lib/websocket.test.ts`

**Interfaces:**
- Consumes: Task 1 하네스의 `importOriginal` 스프레드 목 (실제 enum이 통과됨)
- Produces: 없음 (Client config 옵션만)

**배경:** (1) `reconnectDelay: 3000` 고정이라 서버 재배포 시 전 클라이언트가 3초마다 동시 재시도(thundering herd). stompjs 7.3 내장 옵션으로 3s→6s→12s→…→최대 60s 지수 백오프. 지터는 넣지 않는다(확정). (2) Chrome 백그라운드 탭 타이머 스로틀링(분당 1회)으로 heartbeat가 최악 60초 간격 — 감지 창 75초 대비 마진 15초라 beat 하나만 유실돼도 오탐 절단. `TickerStrategy.Worker`로 Web Worker 타이머 사용. Worker 미지원 환경은 라이브러리가 interval로 폴백하므로 가드 불필요.

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib/websocket.test.ts` 상단 import에 enum 추가:

```ts
import { ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';
```

(목이 `importOriginal` 스프레드라 실제 enum 값이 들어온다.)

테스트 추가:

```ts
  describe('재연결 백오프 + heartbeat worker 옵션', () => {
    it('지수 백오프: 3초 시작, 최대 60초, EXPONENTIAL 모드', () => {
      wsService.connect('테스터');
      const cfg = clientInstances[0].config;

      expect(cfg.reconnectDelay).toBe(3000);
      expect(cfg.maxReconnectDelay).toBe(60000);
      expect(cfg.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
    });

    it('백그라운드 탭 스로틀링 대응: heartbeat를 Web Worker로 발행', () => {
      wsService.connect('테스터');
      const cfg = clientInstances[0].config;

      expect(cfg.heartbeatStrategy).toBe(TickerStrategy.Worker);
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 신규 2개 FAIL — `maxReconnectDelay`/`reconnectTimeMode`/`heartbeatStrategy`가 `undefined`

- [ ] **Step 3: 구현**

`src/lib/websocket.ts`:

(a) import 수정 (기존 2행):

```ts
import { Client, IMessage, ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';
```

(b) Client config의 `reconnectDelay: 3000,` 을 다음으로 교체:

```ts
      // 지수 백오프: 3s → 6s → 12s → ... 최대 60s (thundering herd 완화)
      reconnectDelay: 3000,
      maxReconnectDelay: 60000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      // Chrome 백그라운드 탭 타이머 스로틀링(분당 1회) 대응 — heartbeat를
      // Web Worker 타이머로 발행. 미지원 환경은 라이브러리가 interval 폴백.
      heartbeatStrategy: TickerStrategy.Worker,
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/websocket.test.ts`
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/websocket.ts tests/lib/websocket.test.ts
git commit -m "feat(ws): 재연결 지수 백오프(최대 60초) + 백그라운드 탭 heartbeat worker

3초 고정 재시도의 thundering herd 완화(EXPONENTIAL, jitter 없음 — 확정),
백그라운드 탭 타이머 스로틀링으로 인한 heartbeat 오탐 절단 방지."
```

---

### Task 5: NotificationProvider — 재연결 시 알림 재동기화 + id 병합

**Files:**
- Modify: `src/components/providers/NotificationProvider.tsx`
- Create: `tests/providers/NotificationProvider.test.tsx`

**Interfaces:**
- Consumes: `wsService.onReconnect(handler: () => void): () => void` (Task 1), 기존 `fetchNotifications`/`fetchUnreadCount`
- Produces: 없음 (Provider 내부 동작 — context 시그니처 불변)

**배경:** 끊김~재구독 사이(최대 75초+α)에 도착한 알림은 DB에만 있고 화면·unread 뱃지에 반영되지 않는다. 재연결 시 REST를 재조회하되, REST 응답과 fetch 사이에 WS로 먼저 받은 알림이 겹칠 수 있으므로 **id 기준 중복 제거 병합**이 필수다. 병합 규칙: 서버 스냅샷(fetched)이 진실(isRead 등 최신) — fetched를 기준으로 두고, fetched에 없는 기존 항목(WS로 막 받은 더 새로운 알림 등)을 뒤에 합친 후 id 내림차순 정렬.

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/providers/NotificationProvider.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

const { wsMock } = vi.hoisted(() => ({
  wsMock: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(() => () => {}),
    onReconnect: vi.fn(() => () => {}),
  },
}));
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuthContext: () => ({ user: { nickname: '테스터' } }),
}));

import NotificationProvider, { useNotification } from '@/components/providers/NotificationProvider';
import type { Notification } from '@/types/api';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  type: 'LIKE',
  targetId: 10,
  relatedPostId: 10,
  message: '회원님의 게시글을 좋아합니다',
  senderNickname: '상대방',
  senderProfileImageUrl: null,
  isRead: false,
  createdAt: '2026-08-02T10:00:00',
  ...overrides,
});

/** api.get을 엔드포인트별로 라우팅 */
const routeApiGet = (notifications: Notification[], unreadCount: number) => {
  apiMock.get.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith('/api/notifications/unread-count')) {
      return Promise.resolve(successRes(unreadCount));
    }
    if (endpoint.startsWith('/api/notifications')) {
      return Promise.resolve(successRes({ content: notifications }));
    }
    return Promise.reject(new Error(`unexpected endpoint: ${endpoint}`));
  });
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationProvider — 재연결 재동기화', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.patch.mockReset();
    wsMock.on.mockReset();
    wsMock.on.mockReturnValue(() => {});
    wsMock.onReconnect.mockReset();
    wsMock.onReconnect.mockReturnValue(() => {});
  });

  it('마운트 시 onReconnect 핸들러를 등록하고 언마운트 시 해제한다', async () => {
    routeApiGet([], 0);
    const off = vi.fn();
    wsMock.onReconnect.mockReturnValue(off);

    const { unmount } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(wsMock.onReconnect).toHaveBeenCalledTimes(1));

    unmount();
    expect(off).toHaveBeenCalled();
  });

  it('재연결 시 알림 목록과 unread 카운트를 재조회한다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // 끊김 사이 서버에 알림 2건 추가 + unread 3으로 변경된 상황
    routeApiGet(
      [makeNotification({ id: 3 }), makeNotification({ id: 2 }), makeNotification({ id: 1 })],
      3
    );
    act(() => reconnectHandler?.());

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([3, 2, 1]);
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('재조회 결과와 기존 목록을 id 기준으로 중복 제거 병합한다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });
    let wsHandler: ((data: unknown) => void) | null = null;
    wsMock.on.mockImplementation((_channel: string, handler: (data: unknown) => void) => {
      wsHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // WS로 id 5 수신 (재조회 응답에도 포함될 알림 — 중복 케이스)
    act(() => wsHandler?.(makeNotification({ id: 5 })));
    expect(result.current.notifications.map((n) => n.id)).toEqual([5, 1]);

    // 재조회 스냅샷에도 id 5가 있음 → 병합 후 한 번만 존재해야 함
    routeApiGet([makeNotification({ id: 5 }), makeNotification({ id: 1 })], 2);
    act(() => reconnectHandler?.());

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([5, 1]);
    });
  });

  it('REST 스냅샷에 없는 기존 항목(더 새로운 WS 알림)도 병합 후 유지된다', async () => {
    routeApiGet([makeNotification({ id: 1 })], 1);
    let reconnectHandler: (() => void) | null = null;
    wsMock.onReconnect.mockImplementation((handler: () => void) => {
      reconnectHandler = handler;
      return () => {};
    });
    let wsHandler: ((data: unknown) => void) | null = null;
    wsMock.on.mockImplementation((_channel: string, handler: (data: unknown) => void) => {
      wsHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // 재조회 응답이 만들어진 뒤 WS로 id 9가 도착한 레이스 상황:
    // 스냅샷 [2,1] 에는 id 9가 없다
    let resolveFetch: ((v: unknown) => void) | null = null;
    apiMock.get.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/api/notifications/unread-count')) {
        return Promise.resolve(successRes(2));
      }
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    });
    act(() => reconnectHandler?.());
    act(() => wsHandler?.(makeNotification({ id: 9 })));
    act(() => {
      resolveFetch?.(
        successRes({ content: [makeNotification({ id: 2 }), makeNotification({ id: 1 })] })
      );
    });

    await waitFor(() => {
      expect(result.current.notifications.map((n) => n.id)).toEqual([9, 2, 1]);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/providers/NotificationProvider.test.tsx`
Expected: FAIL — `wsMock.onReconnect` 미호출(첫 테스트), 병합 테스트들 실패

- [ ] **Step 3: 구현**

`src/components/providers/NotificationProvider.tsx` 수정:

(a) `fetchNotifications`(37~47행)의 `setNotifications(res.data.content);` 를 병합 로직으로 교체:

```ts
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ content: Notification[] }>(
        `/api/notifications?page=0&size=20`
      );
      // 서버 스냅샷을 기준으로, 스냅샷에 없는 기존 항목(fetch 중 WS로 받은
      // 더 새로운 알림 등)을 id 기준 중복 제거 후 병합 — 재연결 재동기화 대응
      setNotifications((prev) => {
        const merged = [...res.data.content];
        const ids = new Set(merged.map((n) => n.id));
        for (const n of prev) {
          if (!ids.has(n.id)) merged.push(n);
        }
        return merged.sort((a, b) => b.id - a.id);
      });
    } catch {
      // Backend may not be available
    }
  }, [user]);
```

(b) WS 연결 effect(86~109행) — `wsService.on('notification', ...)` 등록 아래에 재연결 핸들러 추가, cleanup에서 해제:

```ts
    // 재연결 시 끊김 동안 놓친 알림 재동기화 (REST 재조회 + id 병합)
    const unsubscribeReconnect = wsService.onReconnect(() => {
      fetchNotifications();
      fetchUnreadCount();
    });

    return () => {
      unsubscribe();
      unsubscribeReconnect();
    };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/providers/NotificationProvider.test.tsx`
Expected: 4개 전부 PASS

- [ ] **Step 5: 회귀 확인 (Provider를 쓰는 기존 테스트 포함 전체)**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/providers/NotificationProvider.tsx tests/providers/NotificationProvider.test.tsx
git commit -m "feat(notification): 재연결 시 알림 목록·unread 재동기화

끊김(최대 75초+α) 동안 도착한 알림이 새로고침 전까지 안 보이던 문제.
onReconnect에서 REST 재조회하고 기존 목록과 id 기준 중복 제거 병합."
```

---

### Task 6: useDmRoom — 재연결 시 열린 방 메시지 재동기화

**Files:**
- Modify: `src/hooks/useDmRoom.ts`
- Modify: `tests/hooks/useDmRoom.test.ts`

**Interfaces:**
- Consumes: `wsService.onReconnect(handler: () => void): () => void` (Task 1), 기존 `GET /api/dm/rooms/{roomId}/messages?page=0&size=50`
- Produces: 없음 (훅 반환 시그니처 불변)

**배경:** 방을 열어둔 채 끊기면 그 사이 상대가 보낸 메시지가 유실처럼 보인다. 재연결 시 최신 페이지(page 0)를 재조회해 병합한다. 병합 규칙(기존 WS 수신 핸들러와 동일한 원칙): (1) `clientMessageId` 일치 → 낙관적 메시지를 서버 메시지로 치환, (2) `id` 중복 → 스킵, (3) 신규만 `createdAt` 오름차순 정렬 후 뒤에 append (전체 재정렬은 하지 않음 — 낙관적 'sending' 메시지의 KST-naive 시각과 섞이는 문제 방지).

- [ ] **Step 1: 실패 테스트 작성**

`tests/hooks/useDmRoom.test.ts` 수정:

(a) `wsMock`에 `onReconnect` 추가 — `vi.hoisted` 블록의 wsMock 정의를 다음으로 교체:

```ts
const { wsMock } = vi.hoisted(() => {
  const wsMock = {
    onDmRoom: vi.fn(() => () => {}),
    onReconnect: vi.fn(() => () => {}),
    send: vi.fn(() => true),
    isConnected: vi.fn(() => true),
  };
  return { wsMock };
});
```

(b) `beforeEach`에 리셋 추가:

```ts
    wsMock.onReconnect.mockReset();
    wsMock.onReconnect.mockReturnValue(() => {});
```

(c) describe 블록 추가 (파일 하단, 기존 describe('useDmRoom') 안):

```ts
  // ─── 재연결 재동기화 ──────────────────────────────────────────────────────

  describe('재연결 시 열린 방 메시지 재동기화', () => {
    const captureReconnect = () => {
      let handler: (() => void) | null = null;
      wsMock.onReconnect.mockImplementation((h: () => void) => {
        handler = h;
        return () => {};
      });
      return () => handler;
    };

    it('재연결 시 page 0을 재조회해 놓친 메시지를 뒤에 병합한다', async () => {
      const getHandler = captureReconnect();
      const m1 = makeMsg({ id: 1, createdAt: '2026-08-02T10:00:00.000Z' });
      apiMock.get.mockResolvedValueOnce(makePageRes([m1]));

      const { result } = renderHook(() =>
        useDmRoom({ roomId: 7, userNickname: '나' })
      );
      await waitFor(() => expect(result.current.messages).toHaveLength(1));

      // 끊김 사이 상대가 보낸 id 2, 3이 스냅샷에 포함됨 (id 1은 중복)
      const m2 = makeMsg({ id: 2, createdAt: '2026-08-02T10:01:00.000Z' });
      const m3 = makeMsg({ id: 3, createdAt: '2026-08-02T10:02:00.000Z' });
      apiMock.get.mockResolvedValueOnce(makePageRes([m3, m2, m1]));

      act(() => getHandler()?.());

      await waitFor(() => {
        expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3]);
      });
      expect(apiMock.get).toHaveBeenLastCalledWith('/api/dm/rooms/7/messages?page=0&size=50');
    });

    it('재조회 스냅샷의 clientMessageId 일치 메시지는 낙관적 메시지를 치환한다', async () => {
      const getHandler = captureReconnect();
      apiMock.get.mockResolvedValueOnce(makePageRes([]));

      const { result } = renderHook(() =>
        useDmRoom({ roomId: 7, userNickname: '나' })
      );
      await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

      // 전송 → 에코를 못 받고 끊긴 상황 (낙관적 메시지가 'sending'으로 남음)
      act(() => result.current.sendMessage('안녕'));
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].status).toBe('sending');

      const echoed = makeMsg({
        id: 10,
        senderNickname: '나',
        content: '안녕',
        clientMessageId: 'mock-uuid-1',
        createdAt: '2026-08-02T10:00:01.000Z',
      });
      apiMock.get.mockResolvedValueOnce(makePageRes([echoed]));

      act(() => getHandler()?.());

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].id).toBe(10);
        expect(result.current.messages[0].status).toBe('sent');
      });
    });

    it('roomId가 없으면 onReconnect를 등록하지 않는다', () => {
      renderHook(() => useDmRoom({ roomId: null, userNickname: '나' }));
      expect(wsMock.onReconnect).not.toHaveBeenCalled();
    });

    it('언마운트 시 onReconnect 등록을 해제한다', async () => {
      const off = vi.fn();
      wsMock.onReconnect.mockReturnValue(off);
      apiMock.get.mockResolvedValue(makePageRes([]));

      const { unmount } = renderHook(() =>
        useDmRoom({ roomId: 7, userNickname: '나' })
      );
      await waitFor(() => expect(wsMock.onReconnect).toHaveBeenCalled());

      unmount();
      expect(off).toHaveBeenCalled();
    });
  });
```

주의: 기존 테스트 파일의 `beforeEach`에서 `apiMock.get.mockReset()`이 이미 호출된다. `captureReconnect`는 각 it 안에서 호출해야 한다(beforeEach의 `mockReturnValue`가 implementation을 덮으므로).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/hooks/useDmRoom.test.ts`
Expected: 신규 4개 중 "roomId가 없으면" 제외 3개 FAIL (`onReconnect` 미호출). "roomId가 없으면" 테스트는 구현 전에도 통과 — 회귀 방지용 유지.

- [ ] **Step 3: 구현**

`src/hooks/useDmRoom.ts` — "WS 구독" effect(73~123행) 바로 아래에 새 effect 추가:

```ts
  // 재연결 시 열린 방의 놓친 메시지 재동기화 (최신 페이지 재조회 + 병합)
  useEffect(() => {
    if (!roomId || !userNickname) return;

    const unsubscribe = wsService.onReconnect(() => {
      api
        .get<PageResponse<DmMessage>>(
          `/api/dm/rooms/${roomId}/messages?page=0&size=50`
        )
        .then((res) => {
          const content = res.data?.content ?? [];
          setMessages((prev) => {
            const next = [...prev];
            const fresh: DmMessage[] = [];
            for (const incoming of content) {
              // 낙관적 메시지 치환 (에코를 못 받고 끊긴 경우)
              if (incoming.clientMessageId) {
                const idx = next.findIndex(
                  (m) => m.clientMessageId === incoming.clientMessageId
                );
                if (idx !== -1) {
                  next[idx] = { ...incoming, status: 'sent' };
                  continue;
                }
              }
              if (next.some((m) => m.id === incoming.id)) continue;
              fresh.push({ ...incoming, status: 'sent' });
            }
            // 신규(끊김 동안 놓친 메시지)만 시간순으로 뒤에 붙인다.
            // 전체 재정렬은 낙관적 메시지의 KST-naive 시각과 섞여 순서가 튈 수 있어 안 함.
            fresh.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return [...next, ...fresh];
          });
          // 이 GET으로 백엔드가 미읽음을 읽음 처리하므로 방 목록 배지도 정리
          onUnread?.(roomId);
        })
        .catch(() => {
          // 재조회 실패 — 다음 재연결 때 다시 시도
        });
    });

    return unsubscribe;
  }, [roomId, userNickname]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/hooks/useDmRoom.test.ts`
Expected: 전체 PASS (기존 + 신규 4)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useDmRoom.ts tests/hooks/useDmRoom.test.ts
git commit -m "feat(dm): 재연결 시 열린 방 메시지 재동기화

끊김 동안 상대가 보낸 메시지가 새로고침 전까지 안 보이던 문제.
onReconnect에서 page 0 재조회 후 clientMessageId/id 기준 병합."
```

---

### Task 7: 최종 검증 — 전체 테스트 + production 빌드

**Files:** 없음 (검증만. 실패 시 원인 파일 수정)

**Interfaces:**
- Consumes: Task 1~6의 전체 변경
- Produces: 검증 완료된 브랜치 (push·머지는 하지 않음)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전체 PASS (베이스라인 706개 + 신규 ~21개)

- [ ] **Step 2: lint**

Run: `npx eslint src/lib/websocket.ts src/components/providers/NotificationProvider.tsx src/hooks/useDmRoom.ts tests/lib/websocket.test.ts tests/providers/NotificationProvider.test.tsx tests/hooks/useDmRoom.test.ts`
Expected: 에러 0 (경고 발생 시 수정)

- [ ] **Step 3: production 빌드**

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과, exit 0. (CLAUDE.md 규칙 — Vercel prerender 실패 예방)

- [ ] **Step 4: 실패 시 수정 후 재검증 + 커밋**

빌드/lint 실패 시 원인을 수정하고 Step 1~3을 다시 통과시킨 뒤:

```bash
git add -A
git commit -m "fix(ws): 빌드/lint 수정"
```

(실패가 없으면 이 스텝은 스킵. **push는 하지 않는다** — 사용자 결정 대기.)

---

## Self-Review 결과

- **스펙 커버리지:** 작업 1(재동기화) → Task 1+5+6, 작업 1.5(connected 정리) → Task 2, 작업 3(세션 프로브) → Task 3, 작업 2(백오프) → Task 4, 작업 4(worker) → Task 4. 핸드오프의 PR A/B 분리는 단일 브랜치 순차 커밋으로 대체(머지 보류 지시 때문) — 커밋 단위가 PR 단위와 1:1 대응하므로 추후 분리 가능.
- **타입 일관성:** `onReconnect(handler: () => void): () => void` 시그니처가 Task 1(정의)·5·6(사용) 일치. `MockClientConfig`의 `onWebSocketClose?: () => void`는 Task 2 구현 전 옵셔널 체이닝으로 안전.
- **수동 검증(구현 후 사용자 안내용):** DevTools Network offline 90초 → online 복귀 시 놓친 알림/DM 표시 확인. 세션 쿠키 삭제 후 재연결 유도 → 무한 재시도 없이 로그인 안내. CONNECTED 프레임에 `heart-beat:25000,25000` 확인.
