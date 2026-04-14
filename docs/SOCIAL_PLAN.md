# 집사모여 — 소셜 기능 고도화 계획서

> **작성일:** 2026-04-14
> **목표:** MVP 이후 소셜 기능 강화

---

## Phase 1 — 기본 기능 (백엔드 불필요 / 기존 구조 확장)

### 1-1. 게시글 공유
- [x] 게시글 상세 우상단에 공유 버튼 추가
- [x] 좋아요 옆 `···` 메뉴에 공유 옵션 추가
- [x] 공유 모달: "링크 복사하기" 버튼
- [x] `navigator.clipboard.writeText()` + 토스트 "링크가 복사됐어요!"
- [x] 추후 카카오/X 공유 확장 가능하게 구조 설계

### 1-2. 대댓글
- [x] 댓글에 "답글" 버튼 추가
- [x] 대댓글 들여쓰기 표시
- [x] 답글 입력 UI (답글 대상 표시 + 취소 버튼)
- [x] 1단계 깊이 (추후 무한 깊이 확장 가능하게 설계)
- [x] 전부 펼쳐서 표시

**백엔드 필요:**
- `POST /api/posts/{postId}/comments?userId=&parentId=` — parentId 파라미터 추가
- Comment 응답에 `parentId`, `replies` 필드 추가

---

## Phase 2 — 실시간 알림

### 2-1. 알림 시스템
- [x] WebSocket 연결 (Phase 3 오픈채팅/DM과 공유)
- [x] 알림 종류: 좋아요, 댓글, 대댓글, 팔로우
- [x] 헤더 종 아이콘에 빨간 뱃지 (미읽은 수)
- [x] 알림 패널에 실제 알림 목록 표시
- [x] 알림 클릭 시 읽음 처리 + 해당 페이지로 이동
- [x] 접속 시 미읽은 수 조회

**백엔드 필요:**
- WebSocket `/ws` — 알림 실시간 수신 (오픈채팅/DM과 공유)
- `GET /api/notifications?userId=&page=0&size=20` — 알림 목록
- `PATCH /api/notifications/{id}/read?userId=` — 읽음 처리
- `GET /api/notifications/unread-count?userId=` — 미읽은 수

---

## Phase 3 — 채팅

### 3-1. 오픈채팅방
- [ ] 우하단 플로팅 버튼 (모든 페이지에 표시)
- [ ] 클릭 시 채팅창 열기/닫기
- [ ] WebSocket 연결
- [ ] 랜덤 닉네임 부여 (`익명의 멍집사12`, `익명의 냥집사7`)
- [ ] 접속 시 최근 50개 메시지 로드
- [ ] 실시간 메시지 송수신
- [ ] 전체 1개 방 (추후 주제별 확장)

**백엔드 필요:**
- WebSocket 엔드포인트 (`/ws`)
- `GET /api/chat/messages?size=50` — 최근 메시지
- WebSocket으로 실시간 송수신
- 랜덤 닉네임 생성 로직

### 3-2. DM (쪽지)
- [ ] 사이드바 "DM" 메뉴 추가
- [ ] DM 페이지: 왼쪽 채팅방 목록 + 오른쪽 대화창
- [ ] WebSocket (STOMP) 실시간 메시지
- [ ] 읽음 표시 (카카오톡처럼 1 사라지기)
- [ ] 이미지 전송 (기존 presigned-url 재사용)
- [ ] 사이드바에 안읽은 메시지 수 뱃지

**백엔드 필요:**
- WebSocket 엔드포인트 (오픈채팅과 공유 가능)
- `GET /api/dm/rooms?userId=` — 채팅방 목록
- `GET /api/dm/rooms/{roomId}/messages?page=0&size=50` — 메시지 목록
- `POST /api/dm/rooms?userId=&targetUserId=` — 채팅방 생성
- WebSocket으로 메시지 송수신 + 읽음 처리

---

## 구현 순서 요약

```
Phase 1 (기본 기능)
  [x] 1-1 게시글 공유 (링크 복사)
  [x] 1-2 대댓글

Phase 2 (실시간 알림)
  [x] 2-1 알림 시스템 (WebSocket)

Phase 3 (채팅)
  [x] 3-1 오픈채팅방 (WebSocket)
  [x] 3-2 DM (WebSocket + STOMP)
```

---

## 기술 스택 추가

| 기능 | 기술 |
|------|------|
| 실시간 알림 | WebSocket (오픈채팅/DM과 공유) |
| 오픈채팅 | WebSocket |
| DM | WebSocket + STOMP |
| 이미지 전송 | 기존 S3 Presigned URL 재사용 |
