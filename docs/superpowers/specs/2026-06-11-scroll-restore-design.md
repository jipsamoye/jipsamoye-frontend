# 뒤로가기 스크롤 복원 — 설계 스펙

> 2026-06-11 · 브레인스토밍 인터뷰로 확정된 설계

## 문제

리스트 페이지(메인, 자유게시판)에서 게시글 상세로 들어갔다가 브라우저 뒤로가기로 돌아오면, 목록이 처음부터 다시 로드되고 스크롤이 맨 위로 리셋된다. 특히 메인의 "최신 자랑"은 무한스크롤이라 불러뒀던 목록 자체가 사라져 보던 위치로 돌아갈 수 없다.

근본 원인: Next.js App Router의 기본 스크롤 복원은 복원 시점에 콘텐츠가 존재해야 동작하는데, 이 프로젝트는 클라이언트에서 매번 재fetch하므로 그 시점에 콘텐츠 높이가 0이다. 따라서 스크롤 위치만이 아니라 **리스트 상태 스냅샷 복원**이 본질이다.

## 확정 요구사항

| 항목 | 결정 |
|---|---|
| 적용 범위 | 메인(`/`) + 자유게시판(`/board`)만. 랭킹·프로필·검색은 추후 확장 |
| 복원 방식 | 스냅샷 복원 — 떠날 때 목록 데이터 + 스크롤 위치를 sessionStorage에 저장, 돌아오면 API 재호출 없이 즉시 복원 |
| 복원 조건 | 브라우저 뒤로가기/앞으로가기(popstate) 진입 시에만. 로고·홈 버튼 등 일반 진입은 기존처럼 최신 목록을 맨 위부터 |
| 접근법 | sessionStorage 스냅샷 + 공용 훅 (React Query 도입·전역 스토어 방식은 기각 — 과한 변경 / 새로고침에 취약) |

## 설계

### 공용 훅 `useScrollRestore` (신규: `src/hooks/useScrollRestore.ts`)

```ts
const restored = useScrollRestore<HomeSnapshot>('home', {
  capture: () => ({ latestPosts, popularPosts, boardPosts, page, hasNext }),
  restore: (snap) => { /* setState 일괄 복원 */ },
});
```

- **뒤로가기 감지**: 모듈 레벨에서 `popstate` 리스너 1회 등록(`typeof window` 가드) → 발생 시 모듈 플래그 set. 훅 마운트 시 플래그가 있으면 뒤로가기 진입으로 판단, 플래그는 1회용으로 소모
- **저장**: 스크롤 위치는 throttled scroll 리스너로 ref에 기록, unmount cleanup에서 `capture()` 결과 + 스크롤 위치를 `sessionStorage['scroll-restore:{key}']`에 JSON 저장 (capture는 ref 미러로 최신값 보장)
- **복원**: 뒤로가기 진입 + 스냅샷 존재 시에만 `restore(snap)` 호출 후 `window.scrollTo(0, savedY)`. 반환값 `restored: boolean`으로 페이지가 초기 fetch를 생략
- **안전장치**: JSON 파싱 실패·구조 불일치 시 조용히 무시하고 일반 로딩 폴백. 복원은 클라이언트 마운트 후에만 (SSR/hydration 불일치 방지)

### 메인 페이지 (`src/app/page.tsx`)

- 스냅샷 = `{ popularPosts, boardPosts, latestPosts, page, hasNext }` — **페이지 전체 상태 통째로**. "최신 자랑"이 하단 섹션이라 위쪽 섹션(이주의 자랑·게시판 5개)이 스켈레톤→실데이터로 바뀌면 높이가 출렁여 스크롤이 어긋나기 때문
- 복원 시 초기 fetch 3개(top10, boards, loadMore) 전부 생략 → API 호출 0회 즉시 복원
- 무한스크롤 옵저버는 그대로 동작 (복원 후 이어서 스크롤하면 다음 페이지 정상 로드)
- `?section=latest` 자동 스크롤은 복원 시 건너뜀 (복원 위치 우선)

### 자유게시판 (`src/app/board/page.tsx`)

- 스냅샷 = `{ items, currentPage, totalPages, tab, searchType, searchInput, activeQuery }` — 탭·검색·페이지 번호까지 복원
- 복원 시 초기 fetch 생략 (fetch useEffect가 복원된 상태로 재실행되지 않도록 주의)
- 기존 "페이지 변경 시 scrollTo(0)" 동작 유지

### 전제 조건 (확인 완료)

- `PostCard` 썸네일은 `aspect-square` 고정 비율 → 이미지 로딩과 무관하게 높이 고정, 데이터 세팅 직후 `scrollTo` 가능
- 스크롤 컨테이너는 window (별도 overflow 컨테이너 아님)
- 백엔드 API 변경 없음 (순수 프론트)

## 테스트 (vitest, `tests/hooks/useScrollRestore.test.ts`)

- 정상: 저장(unmount) → popstate → 재마운트 시 restore 호출 + `scrollTo(savedY)` 호출
- 엣지: 일반 마운트면 복원 안 함 / 스냅샷 없으면 복원 안 함 / 깨진 JSON이면 폴백 / popstate 플래그 1회 소모(두 번째 마운트는 복원 안 함)

## 트레이드오프 (사용자 인지 완료)

- 복원된 목록은 떠난 시점 데이터 → 좋아요·댓글 수가 잠깐 과거 값일 수 있음 (탭 닫으면 sessionStorage 소멸)
- 떠난 사이 올라온 새 글은 복원 화면에 없음 → 새로고침/홈 클릭 시 최신 갱신
