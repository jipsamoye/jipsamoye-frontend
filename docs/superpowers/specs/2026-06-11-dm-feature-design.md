# DM 기능 완성 — 설계 스펙

> 2026-06-11 · brainstorming 인터뷰 결과 정리. 구현 계획은 메인 세션 plan 파일과 동일.

## Context

집사모여에 DM(1:1 다이렉트 메시지) 기능이 **"해피패스 스켈레톤"** 상태로만 존재한다.
`src/app/dm/page.tsx`, 타입(`DmRoom`/`DmMessage`), 사이드바 메뉴, WebSocket DM 메서드,
프로필/호버카드의 "💬 메시지" 버튼까지 배선돼 있지만 — 이상적인 상황에서만 동작하고,
실제 메신저라면 반드시 처리해야 할 상황들이 비어 있거나 깨져 있다.

대표적 문제:
- 프로필 "메시지" 버튼이 방을 만든 뒤 `roomId`를 버리고 그냥 `/dm`으로 보냄 → 방이 안 열림
- `onDmRoom`이 WS 연결 전이면 구독이 조용히 실패, 재연결 시 재구독 없음
- 내가 보낸 메시지를 서버 에코에만 의존 → 미연결이면 메시지 증발, "전송 중/실패" 없음
- 방을 열어도 읽음 처리/실시간 읽음 갱신 없음, `unreadCount` 리셋 안 됨
- 첫 50개만 로드, 과거 메시지 페이지네이션 없음
- 이미지 첨부 버튼이 빈 함수, 음소거 버튼 무동작(가짜 UI)

**목표:** 위 스켈레톤을 실제로 쓸 수 있는 1:1 메신저로 완성한다. 새 아키텍처가 아니라
비어 있거나 깨진 부분을 채우고 정리한다.

## 확정된 제품 결정 (인터뷰 결과)

| 항목 | 결정 |
|---|---|
| DM 대상 | **내가 팔로잉한 상대에게만** 가능 |
| 진입점 | 프로필 페이지 버튼 + 프로필 호버카드 버튼(이미 존재) + DM 페이지 "새 메시지" 모달(팔로잉 목록) |
| 새 DM 알림 | **전역 뱃지 없음.** DM 페이지 진입 시 방 목록의 안 읽은 개수로만 확인 |
| 읽음 표시 | **실시간 갱신** — 상대가 읽으면 내 "1"→"읽음" 즉시 |
| 메시지 전송 | **낙관적 UI + 실패/재전송** (`clientMessageId` 기반 에코 매칭) |
| 과거 메시지 | **위로 스크롤 시 무한스크롤** 로드 |
| 제거할 가짜 UI | 음소거(종) 버튼, 이미지 첨부 버튼 |
| 대화 닫기 버튼 | 유지 — 삭제가 아니라 대화창만 닫기(방 선택 해제). 휴지통 아이콘 → X(닫기) 아이콘 교체 |
| 이번 범위 제외 | 이미지 첨부, 방 나가기/삭제, 전역 알림 통합 |

## 작업 항목 (프론트)

1. **진입점 딥링크 수정** — DM 페이지가 `/dm?room={roomId}` 쿼리를 읽어 해당 방 자동 선택
   (`useSearchParams` → Suspense 경계 필수). 프로필/호버카드 버튼은 `POST /api/dm/rooms` 응답의
   `roomId`로 `router.push('/dm?room=' + roomId)`. "메시지" 버튼은 내가 팔로잉한 상대일 때만 노출.
2. **WS 구독 타이밍 버그 수정** — `onDmRoom` 구독 요청을 기억했다가 `onConnect`(최초/재연결) 시 자동 (재)구독.
3. **메시지 전송 견고화 (낙관적 UI)** — 즉시 `status:'sending'` 추가, 미연결/실패 시 `failed`+재전송,
   에코의 `clientMessageId`로 치환. UTC 시간 버그(`new Date().toISOString()`) 제거.
4. **읽음 실시간 갱신** — 방 열면 `unreadCount` 0 리셋, READ 이벤트로 내 메시지 `readAt` 갱신.
5. **과거 메시지 무한스크롤** — 위로 스크롤 시 다음 page prepend, 스크롤 위치 보존.
6. **로직 분리** — `useDmRooms`/`useDmRoom` 커스텀 훅 신규.
7. **가짜 UI 정리** — 음소거·이미지 첨부 버튼 제거, 대화 닫기 버튼은 X 아이콘으로 유지.

## 필요한 백엔드 계약 (조율용)

열린 방 채널 `/sub/dm/room/{roomId}`이 두 종류 이벤트를 구분 가능하게 보내야 한다:

```jsonc
{ "type": "MESSAGE", "message": { "id", "senderNickname", "content", "imageUrl", "readAt", "createdAt", "clientMessageId" } }
{ "type": "READ", "readerNickname": "...", "readAt": "..." }
```

- `/pub/dm/send` payload에 `clientMessageId` 포함 → 백엔드가 에코에 그대로 반환(본인 포함).
- 기존 REST(`GET/POST /api/dm/rooms`, `GET /api/dm/rooms/{roomId}/messages`) 그대로 사용.
- 프론트는 `type` 없을 때 MESSAGE로 폴백 처리(점진 전환 대비).

## 테스트 항목

- useDmRoom: 낙관적 추가→에코 치환 / 미연결 failed / 재전송 / READ로 readAt 갱신 / 무한스크롤 prepend / id 중복 무시
- useDmRooms: 방 선택 시 unread 리셋 / 낙관적 lastMessage
- websocket: 미연결 후 onConnect 자동 구독 / MESSAGE·READ 분기
- 딥링크: `/dm?room=123` 자동 선택, Suspense 빌드 통과
- 엣지: IME Enter, 비로그인, 팔로잉 아닌 상대 버튼 미노출
