# DM 방 선(先)생성 전환 (A안) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 DM 대화를 열 때 서버에 방을 즉시 생성해 실제 roomId로 구독→전송 순서를 보장함으로써, "첫 메시지 전송 중 고착"(에코 유실)과 "두 번째 전송 시 첫 메시지 증발"(draft→방 전환 와이프) 버그를 구조적으로 제거한다.

**Architecture:** 백엔드 `POST /api/dm/rooms`에 `create=true` 파라미터를 추가해 방을 find-or-create하고(기존 호출은 `create=false` 기본값으로 하위호환), 프론트는 draft 상태(roomId=null)를 완전히 제거한다. 대화창은 항상 실제 roomId로 열리므로 `/sub/dm/room/{id}` 구독이 첫 전송보다 항상 먼저 성립한다. 빈 방은 기존 `EXISTS(message)` 필터 덕에 목록에 노출되지 않으며(서버·클라이언트 모두), 목록에 없는 방의 헤더 표시는 `pendingPartner` 상태(기존 draftPartner의 축소 재정의)로 해결한다.

**Tech Stack:** Spring Boot 3.5 (Java 17, JUnit5+Mockito), Next.js 15 (TypeScript, Vitest + Testing Library)

## Global Constraints

- 두 레포 모두: 테스트 없이 커밋 금지 (CLAUDE.md). 커밋 메시지 한글 + `fix:`/`feat:` 접두사.
- 백엔드 워크트리: `/Users/jys/jipsamoye.backend-worktrees/dm-room-create-first` (브랜치 `fix/dm-room-create-first`, base origin/develop)
- 프론트 워크트리: `/Users/jys/jipsamoye.frontend/.claude/worktrees/dm-room-create-first` (브랜치 `worktree-dm-room-create-first`, base origin/main)
- 백엔드 검증: `./gradlew test` 통과 후 커밋. 프론트 검증: `npm test` 통과, 마지막에 `npx next build` "Generating static pages" 단계까지 통과.
- 배포 순서 계약: **백엔드 먼저 배포 → 프론트 나중**. 구 프론트는 `create` 파라미터를 안 보내므로 기존 draft 응답을 그대로 받는다(하위호환). PR 생성/머지는 구현 완료 후 사용자 확인을 받고 진행(계획 범위 밖).
- 프론트 커밋 트레일러: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- `any` 사용 금지, API 응답 타입 명시 (프론트 CLAUDE.md).

---

### Task 1: 백엔드 — `POST /api/dm/rooms`에 `create` 파라미터 추가 (방 선생성)

**작업 디렉터리:** `/Users/jys/jipsamoye.backend-worktrees/dm-room-create-first`

**Files:**
- Modify: `src/main/java/com/jipsamoye/backend/domain/dm/service/DmService.java` (createRoom 시그니처)
- Modify: `src/main/java/com/jipsamoye/backend/domain/dm/service/DmServiceImpl.java:50-76` (createRoom 구현)
- Modify: `src/main/java/com/jipsamoye/backend/domain/dm/controller/DmController.java:34-41` (파라미터 추가)
- Test: `src/test/java/com/jipsamoye/backend/domain/dm/service/DmServiceImplTest.java` (CreateRoomTest nested class)

**Interfaces:**
- Consumes: `DmRoomResolver.resolveOrCreateRoomId(User a, User b): Long` (기존, 무수정 — 키 정규화 + retry-on-conflict find-or-create), `DmRoomResponseMapper.of(Long roomId, User other, DmMessage lastMessage, long unreadCount): DmRoomResponse` (기존, 무수정)
- Produces: `DmService.createRoom(Long userId, String targetNickname, boolean create): DmRoomResponse` — `create=true`면 응답의 `roomId()`가 항상 non-null. HTTP 계약: `POST /api/dm/rooms?targetNickname=X&create=true` → `data.roomId: number` (non-null), `create` 생략 시 기존 동작(빈/부재 방이면 `roomId: null`).

- [ ] **Step 1: 실패하는 테스트 작성**

`DmServiceImplTest.java`의 `CreateRoomTest` nested class에 아래 테스트 4개를 추가한다. 기존 테스트들의 `dmService.createRoom(1L, "냥집사")` 호출은 전부 `dmService.createRoom(1L, "냥집사", false)`로 시그니처만 갱신한다(기대값 무변경 — create=false 하위호환 보존 검증이 됨).

```java
@Test
@DisplayName("create=true & 방 없음 - resolver로 방을 생성하고 roomId 반환")
void createRoom_createTrue_noRoom_createsAndReturnsRoomId() {
    User user = mock(User.class);
    User target = mock(User.class);
    lenient().when(user.getId()).thenReturn(1L);
    lenient().when(target.getId()).thenReturn(2L);
    when(target.getNickname()).thenReturn("냥집사");
    when(userRepository.findById(1L)).thenReturn(Optional.of(user));
    when(userRepository.findByNickname("냥집사")).thenReturn(Optional.of(target));
    when(dmRoomRepository.findByUsers(user, target)).thenReturn(Optional.empty());
    when(dmRoomResolver.resolveOrCreateRoomId(user, target)).thenReturn(77L);

    DmRoomResponse res = dmService.createRoom(1L, "냥집사", true);

    assertThat(res.roomId()).isEqualTo(77L);
    assertThat(res.lastMessage()).isNull();
    assertThat(res.unreadCount()).isEqualTo(0L);
    verify(dmRoomResolver).resolveOrCreateRoomId(user, target);
}

@Test
@DisplayName("create=true & 빈 방 존재 - 기존 방 roomId 재사용, resolver 미호출")
void createRoom_createTrue_emptyRoomExists_reusesExisting() {
    User user = mock(User.class);
    User target = mock(User.class);
    lenient().when(user.getId()).thenReturn(1L);
    lenient().when(target.getId()).thenReturn(2L);
    when(target.getNickname()).thenReturn("냥집사");
    when(userRepository.findById(1L)).thenReturn(Optional.of(user));
    when(userRepository.findByNickname("냥집사")).thenReturn(Optional.of(target));
    DmRoom emptyRoom = mock(DmRoom.class);
    when(emptyRoom.getId()).thenReturn(55L);
    when(dmRoomRepository.findByUsers(user, target)).thenReturn(Optional.of(emptyRoom));
    when(dmMessageRepository.findFirstByRoomOrderByCreatedAtDesc(emptyRoom))
            .thenReturn(Optional.empty());

    DmRoomResponse res = dmService.createRoom(1L, "냥집사", true);

    assertThat(res.roomId()).isEqualTo(55L);
    assertThat(res.lastMessage()).isNull();
    verify(dmRoomResolver, never()).resolveOrCreateRoomId(any(), any());
}

@Test
@DisplayName("create=true & 메시지 있는 방 - 기존 방 응답 그대로, resolver 미호출")
void createRoom_createTrue_roomWithMessage_returnsExisting() {
    User user = mock(User.class);
    User target = mock(User.class);
    lenient().when(user.getId()).thenReturn(1L);
    lenient().when(target.getId()).thenReturn(2L);
    when(target.getNickname()).thenReturn("냥집사");
    when(userRepository.findById(1L)).thenReturn(Optional.of(user));
    when(userRepository.findByNickname("냥집사")).thenReturn(Optional.of(target));
    DmRoom room = mock(DmRoom.class);
    when(room.getId()).thenReturn(10L);
    DmMessage lastMsg = mock(DmMessage.class);
    when(lastMsg.getContent()).thenReturn("마지막 메시지");
    when(lastMsg.getCreatedAt()).thenReturn(LocalDateTime.of(2026, 7, 25, 12, 0));
    when(dmRoomRepository.findByUsers(user, target)).thenReturn(Optional.of(room));
    when(dmMessageRepository.findFirstByRoomOrderByCreatedAtDesc(room))
            .thenReturn(Optional.of(lastMsg));
    when(dmMessageRepository.countUnread(room, user)).thenReturn(2L);

    DmRoomResponse res = dmService.createRoom(1L, "냥집사", true);

    assertThat(res.roomId()).isEqualTo(10L);
    assertThat(res.lastMessage()).isEqualTo("마지막 메시지");
    assertThat(res.unreadCount()).isEqualTo(2L);
    verify(dmRoomResolver, never()).resolveOrCreateRoomId(any(), any());
}

@Test
@DisplayName("create=false & 방 없음 - 기존 draft 동작 보존 (roomId=null, 저장 없음)")
void createRoom_createFalse_noRoom_returnsDraft() {
    User user = mock(User.class);
    User target = mock(User.class);
    lenient().when(user.getId()).thenReturn(1L);
    lenient().when(target.getId()).thenReturn(2L);
    when(target.getNickname()).thenReturn("냥집사");
    when(userRepository.findById(1L)).thenReturn(Optional.of(user));
    when(userRepository.findByNickname("냥집사")).thenReturn(Optional.of(target));
    when(dmRoomRepository.findByUsers(user, target)).thenReturn(Optional.empty());

    DmRoomResponse res = dmService.createRoom(1L, "냥집사", false);

    assertThat(res.roomId()).isNull();
    verify(dmRoomResolver, never()).resolveOrCreateRoomId(any(), any());
    verify(dmRoomRepository, never()).save(any());
}
```

주의: 기존 CreateRoomTest에 자기 자신 DM 금지·USER_NOT_FOUND 테스트가 이미 있으면 시그니처만 3-인자로 바꾸고 그대로 둔다.

- [ ] **Step 2: 테스트가 컴파일 실패(시그니처 불일치)하는지 확인**

Run: `cd /Users/jys/jipsamoye.backend-worktrees/dm-room-create-first && ./gradlew compileTestJava -q`
Expected: FAIL — `createRoom(Long, String, boolean)` 메서드 없음 컴파일 에러

- [ ] **Step 3: 구현**

`DmService.java`:
```java
DmRoomResponse createRoom(Long userId, String targetNickname, boolean create);
```

`DmServiceImpl.java` — 기존 `createRoom` 교체 (javadoc 갱신 포함):
```java
/**
 * 채팅방을 resolve하거나(기본) 선생성한다(create=true).
 * - 메시지가 있는 기존 방이면 그 방의 응답(roomId 포함)을 반환한다.
 * - create=true: 방이 없으면 즉시 생성하고, 빈 방이 있으면 재사용해 roomId를 반환한다.
 *   클라이언트가 실제 roomId로 먼저 구독한 뒤 전송하게 하여 첫 메시지 에코 유실을 막는다.
 *   빈 방은 목록 쿼리의 EXISTS(message) 필터로 노출되지 않는다.
 * - create=false(구 클라이언트): 방이 없거나 빈 방이면 draft 응답(roomId=null) — 하위호환.
 */
@Override
public DmRoomResponse createRoom(Long userId, String targetNickname, boolean create) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    User target = userRepository.findByNickname(targetNickname)
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

    validateDmTarget(user, target);

    DmRoom existing = dmRoomRepository.findByUsers(user, target).orElse(null);
    if (existing != null) {
        DmMessage lastMsg = dmMessageRepository.findFirstByRoomOrderByCreatedAtDesc(existing).orElse(null);
        if (lastMsg != null) {
            long unread = dmMessageRepository.countUnread(existing, user);
            return DmRoomResponseMapper.of(existing.getId(), target, lastMsg, unread);
        }
        if (create) {
            return DmRoomResponseMapper.of(existing.getId(), target, null, 0);
        }
        return DmRoomResponseMapper.of(null, target, null, 0);
    }

    if (create) {
        // find-or-create는 키 정규화 + retry-on-conflict의 REQUIRES_NEW 트랜잭션에 위임
        // (클래스 레벨 readOnly 트랜잭션과 무관하게 쓰기 가능).
        Long roomId = dmRoomResolver.resolveOrCreateRoomId(user, target);
        return DmRoomResponseMapper.of(roomId, target, null, 0);
    }
    return DmRoomResponseMapper.of(null, target, null, 0);
}
```

`DmController.java`:
```java
@Operation(summary = "채팅방 resolve/생성", description = "create=true면 방이 없을 때 즉시 생성해 roomId를 반환한다")
@PostMapping("/rooms")
public ResponseEntity<ApiResponse<DmRoomResponse>> createRoom(
        @AuthenticationPrincipal CustomUserDetails userDetails,
        @RequestParam String targetNickname,
        @RequestParam(defaultValue = "false") boolean create) {
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.created(dmService.createRoom(userDetails.getUserId(), targetNickname, create)));
}
```

`DmService.createRoom`을 호출하는 다른 곳이 있으면(grep으로 확인) 시그니처를 맞춘다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `./gradlew test --tests 'com.jipsamoye.backend.domain.dm.service.DmServiceImplTest' -q && ./gradlew test -q`
Expected: PASS (전체 테스트 — ArchUnit 포함)

- [ ] **Step 5: 커밋**

```bash
git add -A src/
git commit -m "fix: DM 방 resolve에 create 파라미터 추가 - 방 선생성으로 첫 메시지 에코 유실 방지"
```

---

### Task 2: 프론트 — `useOpenDm`이 항상 실제 방으로 라우팅

**작업 디렉터리:** `/Users/jys/jipsamoye.frontend/.claude/worktrees/dm-room-create-first`

**Files:**
- Modify: `src/hooks/useOpenDm.ts`
- Test: `tests/hooks/useOpenDm.test.ts`

**Interfaces:**
- Consumes: `api.post<DmRoomResolve>('/api/dm/rooms?targetNickname=...&create=true')` — Task 1 계약: roomId 항상 non-null (구 백엔드 대비 null 방어만 유지)
- Produces: 라우팅 계약 — `/dm?room={id}&nick={nickname}` (+이미지 있으면 `&img={url}`). Task 4의 딥링크 핸들러가 이 형식을 소비한다. `?draft=` 라우트는 폐기.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/hooks/useOpenDm.test.ts` 전체를 아래로 교체한다 (기존 harness 유지, 케이스 재작성):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiMock, pushMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  pushMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

import { useOpenDm } from '@/hooks/useOpenDm';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

describe('useOpenDm', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    pushMock.mockReset();
  });

  it('resolve를 create=true로 호출하고 /dm?room={id}&nick= 으로 이동', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({
        roomId: 5,
        otherUserNickname: '소금이맘',
        otherUserProfileImageUrl: null,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/dm/rooms?targetNickname=${encodeURIComponent('소금이맘')}&create=true`
    );
    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=5&nick=${encodeURIComponent('소금이맘')}`
    );
  });

  it('resolve 응답 이미지가 있으면 img 파라미터 동봉', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: 7, otherUserProfileImageUrl: 'https://cdn/a.jpg' })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=7&nick=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/a.jpg')}`
    );
  });

  it('resolve 응답에 이미지가 없으면 인자 profileImageUrl로 fallback', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: 7, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', 'https://cdn/fallback.jpg');
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/dm?room=7&nick=${encodeURIComponent('소금이맘')}&img=${encodeURIComponent('https://cdn/fallback.jpg')}`
    );
  });

  it('roomId가 null이면(구 백엔드 방어) /dm 으로 fallback', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({ roomId: null, otherUserProfileImageUrl: null })
    );
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith('/dm');
  });

  it('API 실패 시 /dm 으로 fallback', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useOpenDm());

    await act(async () => {
      await result.current('소금이맘', null);
    });

    expect(pushMock).toHaveBeenCalledWith('/dm');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/hooks/useOpenDm.test.ts`
Expected: FAIL (create=true 미호출, ?draft= 라우팅)

- [ ] **Step 3: 구현**

`src/hooks/useOpenDm.ts`의 `openDm` 본문을 교체:

```typescript
/**
 * 프로필(페이지/호버 카드)의 "💬 메시지" 버튼에서 공통으로 쓰는 DM 열기 훅.
 *
 * - resolve: POST /api/dm/rooms?targetNickname=&create=true → 방이 없으면 즉시 생성(선생성).
 *   실제 roomId로 대화창을 열어 구독이 첫 전송보다 항상 먼저 성립한다(첫 메시지 에코 유실 방지).
 * - 이동: /dm?room={id}&nick={nickname}&img={url} — nick/img는 방이 아직 목록에 없을 때
 *   (빈 방은 목록에서 숨김) 헤더 아바타·닉네임을 즉시 채우기 위함.
 * - 실패 또는 roomId=null(구 백엔드): /dm 으로 fallback.
 */
export function useOpenDm() {
  const router = useRouter();

  const openDm = useCallback(
    async (nickname: string, profileImageUrl: string | null) => {
      try {
        const res = await api.post<DmRoomResolve>(
          `/api/dm/rooms?targetNickname=${encodeURIComponent(nickname)}&create=true`
        );
        if (res.data?.roomId != null) {
          const img = res.data.otherUserProfileImageUrl ?? profileImageUrl ?? '';
          const imgQuery = img ? `&img=${encodeURIComponent(img)}` : '';
          router.push(`/dm?room=${res.data.roomId}&nick=${encodeURIComponent(nickname)}${imgQuery}`);
        } else {
          router.push('/dm');
        }
      } catch {
        router.push('/dm');
      }
    },
    [router]
  );

  return openDm;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/hooks/useOpenDm.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useOpenDm.ts tests/hooks/useOpenDm.test.ts
git commit -m "fix(dm): 메시지 버튼이 방을 선생성해 실제 roomId로 이동 (draft 라우트 폐기)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 프론트 — `useDmRoom`에서 draft 전송 경로 제거

**작업 디렉터리:** `/Users/jys/jipsamoye.frontend/.claude/worktrees/dm-room-create-first`

**Files:**
- Modify: `src/hooks/useDmRoom.ts` (targetNickname 옵션 제거, sendMessage/retryMessage 단순화)
- Test: `tests/hooks/useDmRoom.test.ts` (draft 전송 케이스 제거·대체)

**Interfaces:**
- Consumes: 없음 (독립)
- Produces: `useDmRoom({ roomId, userNickname, onMessageSent?, onUnread? })` — `targetNickname` 옵션 삭제. `sendMessage(content)`는 `roomId == null`이면 no-op. `/pub/dm/send` payload는 `{ roomId, targetNickname: null, content, imageUrl: null, clientMessageId }` (백엔드 DmSendRequest 필드 형태 유지). Task 4가 이 시그니처를 소비한다.

- [ ] **Step 1: 테스트 수정 (실패 상태 만들기)**

`tests/hooks/useDmRoom.test.ts`에서:
1. 기존 draft 케이스 2개(대략 L495-556: "draft(roomId=null) 상태에선 GET 메시지 로드와 onDmRoom 구독을 하지 않는다", "draft에서 sendMessage 시 roomId=null + targetNickname 포함 payload를 전송한다") 중 **후자를 삭제**하고 아래로 대체한다. 전자는 "roomId=null이면 로드/구독 안 함" 동작이 그대로 유효하므로 `targetNickname` 인자만 제거하고 유지한다.
2. 파일 내 모든 `useDmRoom({ ... targetNickname: ... })` 호출에서 `targetNickname` 속성을 제거한다.

대체 테스트 (describe 블록은 기존 파일의 harness/헬퍼를 그대로 사용):

```typescript
it('roomId가 null이면 sendMessage는 no-op (전송·낙관적 추가 없음)', () => {
  const { result } = renderHook(() =>
    useDmRoom({ roomId: null, userNickname: '나' })
  );

  act(() => {
    result.current.sendMessage('안녕하세요');
  });

  expect(wsMock.send).not.toHaveBeenCalled();
  expect(result.current.messages).toHaveLength(0);
});

it('sendMessage는 항상 실제 roomId + targetNickname=null payload로 전송한다', () => {
  const { result } = renderHook(() =>
    useDmRoom({ roomId: 7, userNickname: '나' })
  );

  act(() => {
    result.current.sendMessage('안녕하세요');
  });

  expect(wsMock.send).toHaveBeenCalledWith(
    '/pub/dm/send',
    expect.objectContaining({
      roomId: 7,
      targetNickname: null,
      content: '안녕하세요',
    })
  );
  expect(result.current.messages[0]).toMatchObject({
    content: '안녕하세요',
    status: 'sending',
  });
});
```

주의: 기존 파일의 wsMock/apiMock 변수명·모킹 구조를 먼저 읽고 동일한 이름을 사용할 것 (위 코드의 `wsMock`은 기존 harness 변수명에 맞춰 조정).

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/hooks/useDmRoom.test.ts`
Expected: FAIL (TS 컴파일 에러 또는 draft payload 불일치)

- [ ] **Step 3: 구현**

`src/hooks/useDmRoom.ts`:
1. `UseDmRoomOptions`에서 `targetNickname?: string | null;` 필드와 그 jsdoc 제거. 함수 시그니처 구조분해에서도 제거.
2. `sendMessage`를 다음으로 교체:

```typescript
/** 메시지 전송 (낙관적 UI) — 방은 항상 선생성되어 있으므로 roomId 필수 */
const sendMessage = useCallback(
  (content: string) => {
    if (!content.trim() || !userNickname || !roomId) return;

    const clientMessageId = crypto.randomUUID();
    const optimistic: DmMessage = {
      id: -Date.now(), // 임시 음수 id
      senderNickname: userNickname,
      content: content.trim(),
      readAt: null,
      // KST-naive 형식으로 생성해 parseServerTime 파이프라인과 일치시킴.
      // 에코 도착 시 서버 createdAt으로 치환되므로 시간 점프 없음.
      createdAt: nowKstString(),
      clientMessageId,
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);

    const sent = wsService.send('/pub/dm/send', {
      roomId,
      targetNickname: null,
      content: content.trim(),
      imageUrl: null,
      clientMessageId,
    });

    if (!sent) {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
        )
      );
    }
  },
  [roomId, userNickname]
);
```

3. `retryMessage`도 동일하게: 가드 `if (!userNickname || !roomId) return;`, payload `{ roomId, targetNickname: null, ... }`, deps `[roomId, userNickname]`.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/hooks/useDmRoom.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useDmRoom.ts tests/hooks/useDmRoom.test.ts
git commit -m "fix(dm): useDmRoom draft 전송 경로 제거 - 항상 실제 roomId로 전송

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 프론트 — DM 페이지 draft 상태 제거 + `pendingPartner` 도입

**작업 디렉터리:** `/Users/jys/jipsamoye.frontend/.claude/worktrees/dm-room-create-first`

**Files:**
- Modify: `src/app/dm/page.tsx`
- Delete: `tests/app/dmPage.draftTransition.test.tsx`
- Create: `tests/app/dmPage.openConversation.test.tsx`

**Interfaces:**
- Consumes: Task 2의 라우팅 계약(`/dm?room={id}&nick=&img=`), Task 3의 `useDmRoom({ roomId, userNickname, ... })` 시그니처, Task 1의 resolve 계약(`create=true` → roomId non-null)
- Produces: 사용자 노출 동작 — 새 대화가 실제 방으로 즉시 열리고, 첫 메시지가 정상 에코를 받아 '전송 중'이 해제되며, 방 전환 와이프가 발생하지 않는다.

- [ ] **Step 1: 구조 변경 (page.tsx)**

`src/app/dm/page.tsx`에서:

1. `DraftPartner` interface를 `PendingPartner`로 개명하고 주석 교체:
```typescript
/** 선택된 방이 아직 목록에 없을 때(빈 방은 목록에서 숨김) 헤더에 쓸 상대 정보 */
interface PendingPartner {
  nickname: string;
  profileImageUrl: string | null;
}
```
2. 상태 개명: `draftPartner`/`setDraftPartner` → `pendingPartner`/`setPendingPartner` (L57 주석도 위 의미로 교체). `draftPartnerRef`는 **삭제** (전환 로직이 사라져 더 이상 참조할 곳 없음. `selectedRoomIdRef`는 dm-rooms 핸들러의 `applyRoomUpdate`에 여전히 필요하므로 유지).
3. `useDmRoom` 호출에서 `targetNickname: draftPartner?.nickname ?? null,` 줄 삭제.
4. `activePartner` 파생은 동일 구조 유지(`selectedRoom` 우선, 없으면 `pendingPartner`).
5. dm-rooms push 핸들러(L105-128)에서 draft 전환 분기(L111-123의 `const draft = ...` ~ `return;`)를 **통째로 삭제**하고 `applyRoomUpdate(payload, selectedRoomIdRef.current);`만 남긴다. effect 주석을 "목록 화면 실시간 반영"으로 갱신.
6. 딥링크 effect(L131-153)를 교체:
```typescript
// ─── 딥링크: ?room= 으로 방 선택 (+ ?nick=&img= 로 목록에 없는 새 방의 헤더 정보) ──
useEffect(() => {
  const roomParam = searchParams.get('room');
  if (!roomParam) return;
  const roomId = parseInt(roomParam, 10);
  if (!isNaN(roomId)) {
    const nickParam = searchParams.get('nick');
    const imgParam = searchParams.get('img');
    setSelectedRoomId(roomId);
    setPendingPartner(
      nickParam ? { nickname: nickParam, profileImageUrl: imgParam || null } : null
    );
    setMobileView('chat');
  }
  // URL에서 쿼리 파라미터 제거 (뒤로가기 시 깔끔하게)
  router.replace('/dm', { scroll: false });
}, [searchParams, router]);
```
7. `handleSelectRoom`·`handleBackToList`의 `setDraftPartner(null)` → `setPendingPartner(null)`.
8. `handleSend`의 draft 주석(L199-200) 삭제, `if (selectedRoomId != null)` 가드는 유지.
9. `handleCreateRoom`을 교체:
```typescript
const handleCreateRoom = useCallback(
  async (target: NewMessageTarget) => {
    if (!user) return;
    // create=true: 방이 없으면 즉시 생성(선생성). 실제 roomId로 구독을 먼저 성립시켜
    // 첫 메시지 에코 유실을 막는다. 빈 방은 목록에 노출되지 않으므로(EXISTS 필터)
    // 헤더 표시는 pendingPartner로 해결한다.
    try {
      const res = await api.post<DmRoomResolve>(
        `/api/dm/rooms?targetNickname=${encodeURIComponent(target.nickname)}&create=true`
      );
      const resolved = res.data;
      if (resolved && resolved.roomId != null) {
        const roomId = resolved.roomId;
        // 대화 이력이 있는 방인데 목록에 아직 없으면 합친다 (빈 방은 목록에 넣지 않음)
        if (resolved.lastMessage != null) {
          setRooms((prev) =>
            prev.some((r) => r.roomId === roomId)
              ? prev
              : [{ ...resolved, roomId }, ...prev]
          );
        }
        setSelectedRoomId(roomId);
        setPendingPartner({
          nickname: target.nickname,
          profileImageUrl: resolved.otherUserProfileImageUrl ?? target.profileImageUrl ?? null,
        });
        setMobileView('chat');
      }
    } catch {
      // ignore
    }
    setShowNewMessageModal(false);
  },
  [user, setRooms]
);
```

- [ ] **Step 2: 테스트 재작성**

`tests/app/dmPage.draftTransition.test.tsx`를 삭제하고 `tests/app/dmPage.openConversation.test.tsx`를 생성한다. 기존 파일의 harness(모킹 블록, sampleUser, makePageRes, captureRoomsHandler 등 L1-115)를 그대로 복사해 쓰되, describe/케이스를 아래로 교체:

```typescript
describe('DM 페이지 — 방 선생성 대화 열기', () => {
  // beforeEach는 기존 harness 그대로

  it('새 메시지 모달에서 상대 선택 → create=true resolve 후 실제 방으로 대화창 열림', async () => {
    apiMock.post.mockResolvedValueOnce(
      successRes({
        roomId: 77,
        otherUserNickname: '상대방',
        otherUserProfileImageUrl: null,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      })
    );
    render(<DmPage />);

    // "새 메세지 보내기" 버튼 → 모달 → 팔로잉 목록은 apiMock.get이 빈 목록 반환
    // NewMessageModalContent 경유 대신 handleCreateRoom과 동일 경로 검증을 위해
    // 모달 내 상대 클릭까지 수행하기 어렵다면, useOpenDm 딥링크 케이스(아래)로 갈음하고
    // 이 케이스는 모달 오픈 → 검색 → 선택 플로우가 가능한 범위에서 작성한다.
    // (기존 NewMessageModalContent.test.tsx가 onSelect 콜백 계약을 이미 검증하므로,
    //  여기서는 딥링크 경로 중심으로 페이지 통합 동작을 검증해도 충분하다.)
  });

  it('딥링크 ?room=77&nick=상대방 → 대화 패널이 열리고 헤더에 닉네임 표시', async () => {
    searchParamsRef.current = new URLSearchParams('room=77&nick=상대방');
    render(<DmPage />);

    await waitFor(() => {
      // 헤더에 상대 닉네임 렌더 (목록에 방이 없어도 pendingPartner로 표시)
      expect(screen.getAllByText('상대방').length).toBeGreaterThan(0);
    });
    // 메시지 로드가 실제 roomId로 나감
    expect(apiMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/dm/rooms/77/messages')
    );
    // WS 구독이 실제 roomId로 성립
    expect(wsMock.onDmRoom).toHaveBeenCalledWith(77, expect.any(Function));
    // URL 정리
    expect(replaceMock).toHaveBeenCalledWith('/dm', { scroll: false });
  });

  it('딥링크 ?room=5 (nick 없음, 기존 방) → 방 선택되고 pendingPartner 없이 동작', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (/\/messages/.test(url)) return Promise.resolve(makePageRes([]));
      return Promise.resolve(
        successRes([
          {
            roomId: 5,
            otherUserNickname: '기존상대',
            otherUserProfileImageUrl: null,
            lastMessage: '이전 대화',
            lastMessageAt: '2026-07-25T10:00:00',
            unreadCount: 0,
          },
        ])
      );
    });
    searchParamsRef.current = new URLSearchParams('room=5');
    render(<DmPage />);

    await waitFor(() => {
      expect(screen.getAllByText('기존상대').length).toBeGreaterThan(0);
    });
  });

  it('dm-rooms push 수신 → 목록 갱신 (열린 방이면 unread 0)', async () => {
    searchParamsRef.current = new URLSearchParams('room=42&nick=상대방');
    const getHandler = captureRoomsHandler();
    render(<DmPage />);

    await waitFor(() => expect(getHandler()).toBeDefined());

    act(() => {
      getHandler()!(makeRoomPush({ roomId: 42, unreadCount: 3, lastMessage: '첫 메시지' }));
    });

    await waitFor(() => {
      // 목록에 방이 나타나고, 열린 방이므로 unread 뱃지(3)는 표시되지 않음
      expect(screen.getByText('첫 메시지')).toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  it('?draft= 파라미터는 더 이상 처리하지 않는다 (빈 목록 화면 유지)', async () => {
    searchParamsRef.current = new URLSearchParams('draft=상대방&img=x');
    render(<DmPage />);

    await waitFor(() => {
      expect(screen.getByText('다른 집사에게 사진과 메시지를 보낼 수 있어요')).toBeInTheDocument();
    });
    // draft 파라미터로는 대화 패널이 열리지 않음
    expect(wsMock.onDmRoom).not.toHaveBeenCalled();
  });
});
```

첫 번째 케이스(모달 경유)는 NewMessageModalContent 실제 렌더가 harness에서 가능하면 완성하고, 불가능하면 케이스를 제거한다(모달 onSelect 계약은 `tests/components/NewMessageModalContent.test.tsx`가 담당). **handleCreateRoom의 create=true 호출 검증은 필수**이므로, 모달 경유가 어려우면 다음처럼 대체한다: 모달을 연 뒤 `NewMessageModalContent`가 mock되지 않은 상태에서 팔로잉 목록 fixture 1건을 반환시켜 그 항목을 클릭 → `apiMock.post`가 `create=true` URL로 호출됐는지 + 헤더 닉네임 표시를 assert.

- [ ] **Step 3: 실패 확인 → 구현 → 통과 확인**

Run: `npm test -- tests/app/dmPage.openConversation.test.tsx`
Expected: Step 1 구현이 이미 반영됐으므로 PASS. 실패 시 구현/테스트를 수정 (page.tsx는 Step 1에서 이미 수정됨 — 이 Task는 구조 변경과 테스트가 상호 검증하는 형태).

Run: `npm test`
Expected: 전체 PASS (다른 테스트 파일에 draftPartner/targetNickname 참조가 남아 있으면 함께 수정)

- [ ] **Step 4: 커밋**

```bash
git add src/app/dm/page.tsx tests/app/
git commit -m "fix(dm): draft 상태 제거 - 방 선생성으로 첫 메시지 전송 중 고착·증발 버그 해결

새 대화를 열 때 방을 서버에 즉시 생성해 실제 roomId로 구독을 먼저
성립시킨다. draft(roomId=null) 상태와 draft→방 전환이 사라져
(1) 첫 메시지 에코 유실로 인한 '전송 중' 고착
(2) 방 전환 시 setMessages 와이프로 인한 첫 메시지 증발
이 구조적으로 재현 불가능해진다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 프론트 — 타입 주석 정리 + 프로덕션 빌드 검증

**작업 디렉터리:** `/Users/jys/jipsamoye.frontend/.claude/worktrees/dm-room-create-first`

**Files:**
- Modify: `src/types/api.ts` (DmRoomResolve 주석)
- 검증만: 전체 테스트 + `npx next build`

**Interfaces:**
- Consumes: Task 1-4 전부
- Produces: 머지 가능한 브랜치 (전체 테스트 + 프로덕션 빌드 통과)

- [ ] **Step 1: DmRoomResolve 타입 주석 갱신**

`src/types/api.ts`의 `DmRoomResolve` 정의에 주석을 갱신한다 (타입 자체는 `roomId: number | null` 유지 — 구 백엔드 방어용):

```typescript
/**
 * POST /api/dm/rooms 응답.
 * create=true(현재 클라이언트)로 호출하면 방을 선생성하므로 roomId가 항상 non-null.
 * null은 구 백엔드(create 미지원)에 대한 방어적 타입으로만 남긴다.
 */
export type DmRoomResolve = Omit<DmRoom, 'roomId'> & { roomId: number | null };
```

- [ ] **Step 2: 전체 테스트**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 3: 프로덕션 빌드**

Run: `npx next build`
Expected: "Generating static pages" 단계까지 통과, 에러 0

- [ ] **Step 4: grep으로 잔재 확인**

Run: `grep -rn "draftPartner\|targetNickname" src/ tests/ --include="*.ts" --include="*.tsx" | grep -v "targetNickname: null" | grep -v "targetNickname="`
Expected: draft 관련 잔재 없음 (useDmRoom payload의 `targetNickname: null`과 API URL 쿼리만 남음)

- [ ] **Step 5: 커밋**

```bash
git add src/types/api.ts
git commit -m "docs(dm): DmRoomResolve 타입 주석 갱신 (create=true 선생성 계약)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 검증 (End-to-End)

구현 완료 후 수동 검증 절차 (로컬 백엔드 + 프론트 dev 서버, 또는 배포 후):

1. 백엔드 워크트리에서 `./gradlew test` 전체 통과 확인.
2. 프론트 워크트리에서 `npm test` + `npx next build` 통과 확인.
3. (가능하면) 로컬 통합: 백엔드 `./gradlew bootRun` (local 프로필) + 프론트 `npm run dev` → 계정 A로 로그인 → 한 번도 대화한 적 없는 계정 B 프로필에서 "메시지" 클릭 → **개발자도구 Network에서 `POST /api/dm/rooms?...&create=true`가 roomId를 반환하는지** 확인 → 첫 메시지 전송 → **"전송 중"이 즉시 해제되고 읽음 표시("1")로 바뀌는지** 확인 → 연속으로 두 번째 메시지 전송 → **첫 메시지가 사라지지 않는지** 확인 → 새로고침 → 두 메시지 모두 존재 확인.
4. 회귀: 기존 대화방 열기/전송/읽음/과거 메시지 무한스크롤 정상 동작 확인.

## 배포 순서 (구현 완료 후, 사용자 확인 필요)

1. 백엔드: `fix/dm-room-create-first` → develop 머지 → develop→main PR (main 머지 = 운영 배포, **사용자 확인 필수**).
2. 백엔드 배포 확인 후 프론트: 브랜치 PR → main 머지 → Vercel 배포 확인 (`vercel ls --prod`).
3. 폐기 정리(선택): 구 접근법의 미푸시 브랜치 `fix/dm-first-message`(프론트)와 워크트리 `/Users/jys/jipsamoye.frontend-worktrees/fix-dm-first-message` 삭제 여부를 사용자에게 확인.
