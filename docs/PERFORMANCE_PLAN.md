# 집사모여 프론트엔드 — 성능 개선 계획

> **기반 문서:** CLAUDE.md, docs/PLAN.md
> **작성일:** 2026-04-19
> **근거:** 운영 환경 네트워크 로그 + 코드 전수 분석 (2026-04-19)

---

## 1. 문제 요약

운영 환경(홈 진입 시) 네트워크 타임라인에서 **체감 로딩 2.5~3초**가 측정됨.

관측된 핵심 지표:
- OPTIONS 프리플라이트: 요청당 ~800ms (top10 794ms, posts 807ms, me 793ms)
- 실제 GET 응답: ~600ms (top10 612ms, posts 598ms, me 603ms)
- S3 원본 이미지: 754KB 1.3s / 114KB 1.07s
- 홈 한 번 로딩 = API 호출 3개 + 이미지 최대 30장

---

## 2. 홈페이지 진입 실제 타임라인

```
t=0        ─ HTML + JS 번들 로딩 (~260ms)
t=260ms    ─ React mount
             ├─ GET /api/auth/me      (AuthProvider.tsx:25)
             ├─ GET /api/posts/top10  (page.tsx:24)
             └─ GET /api/posts?page=0 (page.tsx:35)
             ↓ 각자 OPTIONS 프리플라이트 발사
t=260~1060ms  ─ OPTIONS × 3 (병렬) ≈ 800ms
t=1060~1660ms ─ 실제 GET × 3 ≈ 600ms
t=1660ms   ─ 렌더 시작 → 썸네일 30장을 S3 원본에서 다운로드
t≈2500~3000ms ─ LCP
```

---

## 3. 구조적 병목 — 코드 레벨 원인 분석

### B1. 모든 요청이 프리플라이트를 유발 (`src/lib/api.ts:21-28`)

```ts
const res = await fetch(`${API_BASE_URL}${endpoint}`, {
  headers: {
    'Content-Type': 'application/json',  // ← GET/DELETE에도 박힘
    ...options?.headers,
  },
  credentials: 'include',
  ...options,
});
```

- `credentials: 'include'` + `Content-Type: application/json` 조합은 CORS "simple request" 조건을 모두 깨트림 → **모든 메서드가 프리플라이트 대상**.
- GET/DELETE에는 body가 없는데도 `Content-Type`이 붙어 있어 불필요하게 프리플라이트를 강제.
- 백엔드에 `Access-Control-Max-Age`가 없거나 짧아서 **매 요청마다** OPTIONS가 재발생 (794/807/793ms의 유사 수치가 이를 증명).

### B2. 비로그인자도 매번 `/api/auth/me` 호출 (`src/components/providers/AuthProvider.tsx:22-29`)

```ts
useEffect(() => {
  setUnauthorizedHandler(() => setUser(null));
  api.get<User>('/api/auth/me', { silent: true })
    .then((res) => setUser(res.data))
    .catch(() => setUser(null))
    .finally(() => setLoading(false));
}, []);
```

- 세션 쿠키 유무 체크 없이 무조건 호출 → 비로그인자에게 **OPTIONS 800ms + 401 응답 600ms = 1.4초** 순손실.
- 이미지 #2의 `me` 401 603ms가 이 경로.

### B3. 홈 페이지가 클라이언트 컴포넌트 (`src/app/page.tsx:1`)

```ts
'use client';
// ...
useEffect(() => {
  api.get<PetPostListItem[]>('/api/posts/top10').then(...);
}, []);
```

- Next.js 16 App Router의 서버 컴포넌트 fetch 혜택(CORS 우회, HTML 인라인 데이터, 스트리밍 SSR)을 전혀 못 씀.
- JS 번들 다운로드 → hydrate → fetch가 **순차적**으로 진행.

### B4. `<img>` 원본 직링크 — `next/image` 사용 0건

영향 파일 (총 8개):
```
src/components/domain/PostCard.tsx:23       ← 홈 그리드
src/components/domain/PopularSlider.tsx:12  ← 홈 슬라이더
src/components/common/Avatar.tsx
src/components/domain/CoverImageEditor.tsx
src/components/domain/PostEditor.tsx
src/app/posts/[id]/page.tsx
src/app/users/[nickname]/page.tsx
src/app/dm/page.tsx
```

- `next.config.ts:4-11`의 `images.remotePatterns` 설정은 `next/image`에서만 동작 → 현재 **완전 사문화**.
- 홈 진입 시 최대 30장 × 평균 수백 KB = **수 MB** 통신.
- Vercel Image Optimization(WebP/AVIF 자동 변환, 리사이즈, edge 캐싱) 혜택 0.

### B5. 로그인 직후 API 폭발 (`src/components/providers/NotificationProvider.tsx:86-109`)

```ts
wsService.connect(user.nickname);  // SockJS handshake (/ws/info + xhr fallback)
fetchNotifications();              // OPTIONS + GET
fetchUnreadCount();                // OPTIONS + GET
```

- 로그인 유저는 홈 진입 시 API 호출 **5개 + WS 핸드셰이크** 동시 발생.
- SockJS는 `/ws/info` → `xhr-streaming` → fallback까지 여러 요청을 시도해 초기 비용이 큼.

### B6. 캐싱 레이어 부재

- React Query/SWR 없음 → 라우트 이동마다 동일 API 재호출.
- `/api/posts/popular`는 백엔드에서 1시간 캐싱되지만, 프론트 `api.get`은 항상 네트워크로 나감.
- 브라우저 HTTP 캐시 활용 여부는 백엔드 `Cache-Control` 헤더에 의존.

### B7. 인피니트 스크롤 중복 트리거 가능성 (`src/app/page.tsx:55-66`)

- 마운트 시 `loadMore()` 1회 + IntersectionObserver에서 또 `loadMore()` 가능.
- `loadingRef` 가드로 현재는 막혀 있지만, 첫 렌더에서 observer 타깃이 뷰포트 안에 있으면 이론적으로 페이지 2를 건너뛰는 레이스가 존재.

---

## 4. 개선 조치 매트릭스

| ID | 조치 | 영향 파일 | 난이도 | 절감 효과 | 우선순위 |
|---|---|---|---|---|---|
| F1 | `api.ts`에서 GET/DELETE의 Content-Type 제거 | `src/lib/api.ts` | ⭐ | 프리플라이트 일부 제거 | P0 |
| F2 | `/api/auth/me` 호출 전 쿠키 존재 체크 | `src/components/providers/AuthProvider.tsx` | ⭐ | 비로그인 홈 **-1.4초** | P0 |
| B1 | 백엔드 CORS `setMaxAge(86400L)` | 별도 레포 | ⭐ | **-800ms × N** (첫 요청 외) | P0 |
| F3 | `<img>` → `next/image` 일괄 전환 | 8개 파일 | ⭐⭐ | -500~800ms, 데이터 **-80%** | P1 |
| F4 | 홈 초기 데이터 2종(`top10`, `posts?page=0`)을 RSC fetch | `src/app/page.tsx` + 분리 컴포넌트 | ⭐⭐⭐ | -400~600ms (CORS 우회) | P1 |
| F5 | React Query 도입 | 전역 | ⭐⭐ | 재방문 즉시 표시 | P2 |
| I1 | S3 앞 CloudFront + 쿼리 리사이즈 | 인프라 | ⭐⭐⭐ | 이미지 CDN hit, 리사이즈 | P2 |
| F6 | 인피니트 스크롤 초기 중복 트리거 방지 | `src/app/page.tsx` | ⭐ | 안정성 | P3 |

---

## 5. 단계별 실행 계획

### Phase 1 — 즉효 조치 (P0, 예상 작업 1~2시간)

**목표:** 비로그인 홈 로딩 2.5초 → 0.8초

**체크리스트:**
- [ ] F1. `src/lib/api.ts` — `request()` 내부에서 body 존재 시에만 `Content-Type: application/json` 주입
  - 수정안:
    ```ts
    const headers: Record<string, string> = { ...options?.headers };
    if (options?.body) headers['Content-Type'] = 'application/json';
    ```
- [ ] F1 단위 테스트: GET 요청에 Content-Type이 붙지 않는지 확인 (`tests/lib/api.test.ts`)
- [ ] F2. `AuthProvider.tsx` — `document.cookie`에 세션 쿠키(예: `JSESSIONID` 또는 백엔드가 심은 이름) 존재할 때만 `/me` 호출
  - 쿠키 이름은 백엔드 팀과 확정 필요
- [ ] F2 단위 테스트: 쿠키 없을 때 fetch 호출이 일어나지 않는지 확인
- [ ] B1. (별도 레포) Spring Boot `CorsConfiguration.setMaxAge(86400L)` 추가 + 배포

**완료 기준:**
- 비로그인 홈 DevTools Network에서 첫 진입 시 OPTIONS 1회만, 재진입 시 0회
- `/api/auth/me` 요청이 비로그인자에게 나가지 않음

### Phase 2 — 이미지 & 렌더링 (P1, 예상 작업 반나절)

**목표:** LCP 0.8초 → 0.5초 이하, 이미지 데이터 -80%

**체크리스트:**
- [ ] F3. `<img>` → `next/image` 일괄 전환 (8개 파일)
  - `PostCard.tsx`, `PopularSlider.tsx`는 `fill` + `sizes` 속성으로 반응형 대응
  - `Avatar.tsx`는 고정 `width`/`height`
  - 에디터(`PostEditor.tsx`, `CoverImageEditor.tsx`) 내부 미리보기는 로컬 `URL.createObjectURL`이므로 전환 대상 여부 개별 판단
- [ ] F3 시각 회귀 테스트: 홈/프로필/게시글 상세 페이지 수동 확인
- [ ] F4. 홈의 서버 컴포넌트화
  - `app/page.tsx`를 서버 컴포넌트로 변경하고, 인피니트 스크롤/슬라이더만 클라이언트 분리 (`HomeClient.tsx`)
  - 서버에서 `top10`, `posts?page=0` fetch → props로 전달
  - 쿠키 인증이 필요한 `/me`는 별도 처리 (서버에서 cookie 헤더 포워딩 or 클라이언트에 잔류)
- [ ] F4 단위 테스트: 서버 컴포넌트 렌더 스냅샷

**완료 기준:**
- Lighthouse 모바일 LCP < 2.5s (목표 < 1.5s)
- 홈 한 번 로딩 시 이미지 총 다운로드량 < 500KB

### Phase 3 — 캐싱 & 인프라 (P2)

**체크리스트:**
- [ ] F5. React Query(`@tanstack/react-query`) 도입
  - Provider 추가 → 기존 `useEffect + fetch`를 `useQuery`로 점진 전환
  - staleTime 전역 기본값 60s, popular은 5분
- [ ] I1. (인프라) S3 앞 CloudFront 배포 + 이미지 리사이즈 Lambda@Edge or 쿼리 파라미터 기반 리사이즈

### Phase 4 — 안정성 (P3)

- [ ] F6. `src/app/page.tsx`에서 첫 `loadMore()` 자동 호출과 observer 트리거 간 가드 정리

---

## 6. 측정 방법

### 개선 전/후 비교 지표

| 지표 | 측정 방법 | 개선 전 (현재) | 목표 |
|---|---|---|---|
| 홈 LCP | Lighthouse 모바일 (throttled 4G) | ~2.5~3s | < 1.5s |
| 홈 총 요청 수 | DevTools Network | ~35 | < 15 |
| 홈 총 이미지 트래픽 | DevTools Network "Img" 필터 합계 | ~수 MB | < 500KB |
| API 1건 소요 (프리플라이트 + 응답) | DevTools Network | ~1.4s | < 0.6s (재요청 시 < 0.6s) |
| 비로그인 홈 API 호출 수 | DevTools Network | 3 (`me`, `top10`, `posts`) | 2 (`me` 제거) |

### 측정 체크포인트

각 Phase 완료 시 동일 네트워크 조건(Slow 4G throttle, 캐시 비움)에서 위 지표를 기록.

---

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| F4 서버 컴포넌트화 시 쿠키 인증 흐름 깨짐 | 로그인 사용자 세션 유실 | `cookies()` API로 헤더 포워딩, 로컬에서 검증 후 배포 |
| F3 `next/image` Vercel Image Optimization 비용 증가 | Vercel 청구 | `unoptimized` 옵션 또는 I1 CloudFront로 장기 이전 |
| F1 `Content-Type` 제거 후 일부 POST/PATCH가 text로 오인 | 백엔드 400 | body 있는 요청에만 붙이도록 분기 (설명 그대로) |
| B1 백엔드 배포 타이밍 | 프론트 조치 효과 반감 | 프론트 F1/F2 먼저 배포해도 개별 효과 있음 |

---

## 8. 참고 파일 인덱스

- `src/lib/api.ts` — API 클라이언트 (B1, F1)
- `src/components/providers/AuthProvider.tsx` — 인증 상태 부트 (B2, F2)
- `src/components/providers/NotificationProvider.tsx` — 로그인 후 추가 호출 (B5)
- `src/app/page.tsx` — 홈 페이지 (B3, B7, F4, F6)
- `src/components/domain/PostCard.tsx` — 그리드 썸네일 (B4, F3)
- `src/components/domain/PopularSlider.tsx` — 인기 슬라이더 (B4, F3)
- `next.config.ts` — 이미지 설정 (F3)
- 백엔드 `CorsConfiguration` — (별도 레포, B1)
