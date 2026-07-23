# AI 키캡 만들기 — 사이드바 노출 + 비로그인 로그인 모달 유도

날짜: 2026-07-23

## 목표

1. 데스크톱 사이드바에 `AI 키캡 만들기` 메뉴를 추가한다. 로그인 여부와 무관하게 항상 노출한다.
2. 모바일 드로어의 `AI 키캡 만들기` 메뉴도 항상 노출로 변경한다 (현재는 로그인 시에만).
3. 비로그인 상태로 `/figurines/new`에서 사진을 올리려고 하면 로그인 모달(네이버/게스트)을 자동으로 띄워 로그인을 유도한다.

## 배경

- 로그인 모달은 `ClientLayout`이 로컬 state(`showLogin`)로 소유하고, 헤더의 "로그인" 버튼으로만 열 수 있다.
- 비로그인 상태에서 "키캡 피규어 만들기" 버튼을 누르면 토스트만 뜨고 로그인 유도가 약하다.

## 설계

### 모달 열기 통로 — `src/lib/loginModal.ts`

`src/lib/api.ts`의 `setUnauthorizedHandler`와 동일한 handler-registry 패턴.

- `setLoginModalHandler(handler | null)` — `ClientLayout`이 마운트 시 `() => setShowLogin(true)`를 등록, 언마운트 시 해제.
- `openLoginModal()` — 등록된 핸들러 호출. 미등록이면 no-op.

대안 검토: (1) FigurineCreator에 LoginModal 별도 렌더 — 모달 인스턴스 중복, 확장 시 복붙. (2) Context 추가 — 이 용도엔 과함. 기존 관례(handler-registry)에 맞는 현재 안 채택.

### 트리거 지점 — `FigurineCreator`

비로그인(`user == null`) 상태에서:

1. "사진 선택" 라벨 클릭 → `preventDefault()`로 파일 선택창을 막고 `openLoginModal()` 호출.
2. "키캡 피규어 만들기" 버튼 클릭 → 기존 토스트 대신 `openLoginModal()` 호출 (업로드 미시도 유지).

### 메뉴 노출

- `Sidebar.tsx`: navItems에 `{ label: 'AI 키캡 만들기', href: '/figurines/new', icon: KeycapIcon }` 추가 (requiresAuth 없음).
- `MobileDrawer.tsx`: 키캡 항목의 `requiresAuth: true` 제거.

## 범위 제외

- 로그인 성공 후 "하던 작업 이어가기"(선택 파일 유지)는 이번 범위에서 제외.

## 테스트

- `lib/loginModal`: 핸들러 등록/호출/해제/미등록 no-op.
- `Sidebar`: 비로그인에도 키캡 메뉴 렌더 + KeycapIcon 사용.
- `MobileDrawer`: 비로그인에도 키캡 메뉴 렌더 (기존 "렌더하지 않는다" 테스트 대체).
- `FigurineCreator`: 비로그인 시 사진 선택 클릭 → 파일창 차단 + 모달 호출, 생성 클릭 → 모달 호출 + 업로드 미시도. 로그인 시에는 모달 미호출.
- `ClientLayout`: `openLoginModal()` 호출 시 로그인 모달이 열린다 (glue 확인).

## 완료 기준

- 위 테스트 전부 통과 + 기존 테스트 회귀 없음.
- `npx next build` 통과.
