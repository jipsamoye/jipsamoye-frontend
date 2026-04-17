# 하네스 엔지니어링 적용 설계

> **작성일:** 2026-04-17
> **목적:** Claude 에이전트 활용 극대화를 위한 리포지터리 구조 개선
> **참고:** [OpenAI 하네스 엔지니어링 블로그](https://openai.com/index/harness-engineering/)

---

## 배경

현재 문제점:
1. CLAUDE.md가 162줄로 비대 — 에이전트가 핵심 규칙을 놓치기 쉬움
2. 아키텍처 규칙이 문서에만 존재 — 기계적 강제 없음
3. 새 대화마다 프로젝트 배경 반복 설명 필요
4. 코드 스타일 불일관 — 에이전트가 기존 패턴 복제 못 함
5. 품질/기술 부채 추적 체계 없음

## 적용 범위

OpenAI 하네스 엔지니어링의 핵심 원칙 3가지를 적용:
1. **CLAUDE.md를 맵(목차)으로** — 백과사전이 아닌 다른 문서로의 포인터
2. **docs/ 구조화** — 기록 시스템(source of truth)으로서의 리포지터리 지식
3. **아키텍처 기계적 강제** — ESLint 커스텀 룰로 레이어 규칙 적용

---

## 1. CLAUDE.md 리팩터링

**현재:** 162줄, API 엔드포인트 + 코드 관례 + 디자인 가이드 혼재
**변경 후:** ~60줄, 문서 맵 + 핵심 규칙(4개)만 유지

### 문서 맵 구조

```
CLAUDE.md (~60줄)           ← 맵: 기술 스택 + 핵심 규칙 + docs/ 포인터
ARCHITECTURE.md             ← 폴더 구조, 레이어 규칙, 의존성 방향
docs/
├── API.md                  ← 백엔드 API 엔드포인트, 응답 형식, 페이지네이션
├── CONVENTIONS.md          ← 코드 스타일, 네이밍, 컴포넌트 규칙
├── DESIGN.md               ← UI 디자인 가이드, 페이지 구조, 레이아웃
├── QUALITY.md              ← 영역별 품질 등급, 기술 부채 추적
├── specs/                  ← 기능별 설계 문서
│   └── PLAN.md             ← 기존 구현 계획 (이동)
│   └── SOCIAL_PLAN.md      ← 소셜 기능 계획 (이동)
└── references/             ← 외부 참고 자료
    └── grimity-style.md    ← Grimity 디자인 참고 사항
```

### CLAUDE.md 핵심 규칙 (4개만)

1. `any` 사용 금지 — 모든 API 응답은 타입 정의 필수
2. 컴포넌트에서 직접 fetch 금지 → custom hook으로 분리
3. 한 파일 = 한 컴포넌트 (PascalCase)
4. `'use client'`는 필요한 곳만

---

## 2. ARCHITECTURE.md — 레이어 규칙

### 의존성 방향 (위에서 아래로만 허용)

```
types/          ← 순수 타입, 아무것도 import 안 함
    ↓
lib/            ← API 클라이언트, 유틸리티 (types만 import)
    ↓
hooks/          ← 커스텀 훅 (lib, types import)
    ↓
components/
├── common/     ← Button, Modal (다른 컴포넌트 import 금지)
├── domain/     ← PostCard, CommentSection (common + hooks import 가능)
└── layout/     ← Header, Sidebar (common + domain + hooks import 가능)
    ↓
app/            ← 페이지 (모든 레이어 import 가능)
```

### 금지 규칙

| 레이어 | import 금지 대상 |
|--------|-----------------|
| types/ | lib, hooks, components, app |
| lib/ | hooks, components, app |
| hooks/ | components, app |
| common/ | domain, layout |
| domain/ | layout |

---

## 3. ESLint 커스텀 룰 — 아키텍처 강제

`eslint.config.mjs`에 `no-restricted-imports` 규칙 추가:

- `src/types/**` — `@/components/*`, `@/hooks/*`, `@/lib/*`, `@/app/*` import 금지
- `src/lib/**` — `@/components/*`, `@/hooks/*`, `@/app/*` import 금지
- `src/hooks/**` — `@/components/*`, `@/app/*` import 금지
- `src/components/common/**` — `@/components/domain/*`, `@/components/layout/*` import 금지

에러 메시지에 수정 가이드 포함하여 에이전트 친화적으로 작성.

---

## 4. QUALITY.md — 품질 등급 추적

각 영역에 A~D 등급 부여:

| 영역 | 등급 | 비고 |
|------|------|------|
| 이미지 처리 | C | 압축 불안정, 대용량 이미지 존재 |
| 인증 | D | userId 직접 전달, 세션 미구현 |
| 게시글 CRUD | B | 동작하지만 SSR 미적용 |
| 댓글 | B | 동작함 |
| 레이아웃 | A | 반응형, 다크모드 완성 |
| WebSocket | B | 동작하지만 모든 페이지에서 로드 |
| 검색 | B | 동작함 |

---

## 구현 순서

1. CLAUDE.md에서 내용을 docs/ 파일들로 분리
2. CLAUDE.md를 맵(목차)으로 리팩터링
3. ARCHITECTURE.md 작성
4. ESLint 레이어 규칙 추가
5. QUALITY.md 작성
6. 기존 PLAN.md, SOCIAL_PLAN.md를 docs/specs/로 이동
7. 린트 통과 확인 + 커밋

---

## 기대 효과

- Claude가 새 대화에서 CLAUDE.md만 읽으면 전체 구조 파악 가능
- 잘못된 import를 린트가 자동으로 잡아줌
- 품질 등급으로 개선 우선순위가 명확해짐
- 기능 설계 문서가 체계적으로 관리됨
