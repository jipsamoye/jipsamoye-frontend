# 집사모여 프론트엔드 — 구현 계획 (PLAN)

> **기반 문서:** CLAUDE.md
> **작성일:** 2026-04-11

---

## 기술 스택

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- 반응형 웹 (PC + 태블릿 + 모바일)
- 다크모드 지원
- Vercel 배포

---

## Phase 1: 기반

### 1-1. 폴더 구조 + API 클라이언트 + 타입 정의

**폴더 구조 세팅:**
```
src/
├── app/              # 페이지
├── components/
│   ├── common/       # Button, Modal, Card, Input 등
│   ├── layout/       # Header, Sidebar, Layout
│   └── domain/       # PostCard, CommentItem, ProfileHeader 등
├── hooks/            # useAuth, usePosts, useInfiniteScroll 등
├── lib/              # api.ts (API 클라이언트), utils.ts
├── types/            # API 응답 타입 정의
└── styles/           # globals.css
```

**API 클라이언트 (`lib/api.ts`):**
- fetch 기반 공통 함수 (get, post, patch, delete)
- 환경변수로 API base URL 관리
- 에러 핸들링 공통 처리

**타입 정의 (`types/`):**
- `User`, `PetPost`, `Comment`, `Follow` 등 API 응답 타입
- `ApiResponse<T>`, `PageResponse<T>` 공통 타입
- Request DTO 타입

### 1-2. 공통 레이아웃 (사이드바 + 헤더 + 반응형)

**사이드바:**
- PC: 왼쪽 고정 사이드바 (홈, 랭킹, 자유게시판)
- 모바일: 하단 탭바로 변환

**헤더:**
- 비로그인: 로고 + [검색] [로그인]
- 로그인: 로고 + [자랑하기] [검색] [알림아이콘] [프로필]
- 모바일: 로고 + [검색] [프로필/로그인]

### 1-3. 다크모드 설정

- Tailwind CSS `darkMode: 'class'` 설정
- 시스템 설정 따라가기 + 수동 토글
- localStorage에 선택값 저장

### 1-4. 공통 컴포넌트

- `Button` — 크기, 색상, variant
- `Modal` — 로그인 모달 등에 재사용
- `Card` — 게시글 카드 (썸네일 + 제목 + 좋아요/조회수 + 작성자)
- `Input` — 텍스트, 검색 등
- `Avatar` — 프로필 이미지 (null이면 기본 이미지)
- `InfiniteScroll` — 무한 스크롤 래퍼

---

## Phase 2: 핵심 페이지

### 2-1. 메인 페이지 (`/`)

**오늘의 멍냥 섹션:**
- `GET /api/posts/popular` 호출
- 가로 스크롤 카드 (큰 썸네일)

**최신 게시글 섹션:**
- `GET /api/posts?page=0&size=20` 호출
- 4열 그리드 (태블릿 2열, 모바일 1열)
- 무한 스크롤

**게시글 카드 구성:**
- 썸네일 (첫 번째 이미지)
- 제목
- 좋아요 수 + 조회수
- 작성자 닉네임

### 2-2. 게시글 상세 (`/posts/[id]`)

- `GET /api/posts/{id}` 호출
- 이미지 세로 나열
- 작성자 정보 (프로필 이미지 + 닉네임 + 팔로우 버튼)
- 좋아요 버튼 (`POST /api/posts/{id}/like`)
- 댓글 영역:
  - `GET /api/posts/{id}/comments` 호출
  - 댓글 입력 폼 (`POST /api/posts/{id}/comments`)
  - 본인 댓글 수정/삭제
- 하단: 작성자의 다른 게시글 (`GET /api/users/{nickname}/posts`)
- 하단: 추천 게시글

### 2-3. 글쓰기 (`/posts/new`)

- 이미지 업로드 영역:
  - `POST /api/images/presigned-url` → Presigned URL 발급
  - S3에 PUT 업로드
  - 드래그앤드롭 + 클릭 업로드
  - 이미지 순서 변경 (드래그), 삭제 (X 버튼)
  - JPG/PNG/WEBP, 10MB/장, 최대 5장
- 제목 입력 (100자 제한)
- 내용 입력 (5000자 제한)
- 작성 버튼 → `POST /api/posts`

### 2-4. 로그인 모달

- 모달 팝업 (페이지 이동 아님)
- 카카오 로그인 버튼 (아이콘만, 동작 안 함 — 추후 연동)
- 구글 로그인 버튼 (아이콘만, 동작 안 함 — 추후 연동)
- **둘러보기 버튼** → `POST /api/auth/guest` 호출 → 임시 계정 생성 + 로그인 상태

---

## Phase 3: 부가 페이지

### 3-1. 프로필 페이지 (`/users/[nickname]`)

- `GET /api/users/{nickname}` 호출
- 커버 이미지 영역
- 프로필 이미지 + 닉네임 + 소개글
- 팔로워/팔로잉 수
- 프로필 편집 버튼 (본인만)
- 팔로우 버튼 (타인만)
- 게시글 탭: `GET /api/users/{nickname}/posts` (그리드)

### 3-2. 랭킹 페이지 (`/ranking`)

- 주간/월간 탭
- 날짜 선택
- `GET /api/posts/popular` 호출 (추후 기간별 API 추가 시 연동)
- 인기 게시글 카드 리스트

### 3-3. 검색 페이지 (`/search`)

- 상단 검색 아이콘 클릭 → 검색 페이지로 이동
- 검색 입력창 (중앙 배치)
- `GET /api/posts/search?q={keyword}` 호출
- 검색 결과 그리드

### 3-4. 자유게시판 (`/board`)

- 사이드바 아이콘만 (추후 기능 추가)
- "준비 중입니다" 안내 페이지

---

## Phase 4: 마무리

### 4-1. Vercel 배포

- GitHub 레포 연결
- 환경변수 설정 (API base URL)
- develop → 프리뷰 배포, main → 프로덕션 배포

### 4-2. 반응형 점검

- PC (1200px+), 태블릿 (768px~1199px), 모바일 (~767px)
- 사이드바 ↔ 하단 탭바 전환
- 그리드 4열 → 2열 → 1열

### 4-3. 다크모드 점검

- 전체 페이지 다크모드 스타일 확인
- 이미지/카드/모달 등 요소별 확인

---

## 구현 순서 요약

```
Phase 1 (기반)
  [ ] 1-1 폴더 구조 + API 클라이언트 + 타입 정의
  [ ] 1-2 공통 레이아웃 (사이드바 + 헤더 + 반응형)
  [ ] 1-3 다크모드 설정
  [ ] 1-4 공통 컴포넌트 (Button, Modal, Card, Input, Avatar, InfiniteScroll)

Phase 2 (핵심 페이지)
  [ ] 2-1 메인 페이지 (오늘의 멍냥 + 최신 게시글 무한스크롤)
  [ ] 2-2 게시글 상세 (이미지 + 좋아요 + 댓글)
  [ ] 2-3 글쓰기 (이미지 업로드 + 제목 + 내용)
  [ ] 2-4 로그인 모달 (카카오/구글 버튼만 + 둘러보기 동작)

Phase 3 (부가 페이지)
  [ ] 3-1 프로필 페이지
  [ ] 3-2 랭킹 페이지
  [ ] 3-3 검색 페이지
  [ ] 3-4 자유게시판 (준비 중 안내)

Phase 4 (마무리)
  [ ] 4-1 Vercel 배포
  [ ] 4-2 반응형 점검
  [ ] 4-3 다크모드 점검
```
