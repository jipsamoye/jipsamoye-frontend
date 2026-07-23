# AI 키캡 결과 URL 공유 — 설계

> 2026-07-23. 결과 화면에서 피드 게시 없이 URL로 공유하는 기능.

## 목표

결과 화면(`completed`)에서 버튼 한 번으로 카톡 등에 공유 가능한 URL을 만든다.
링크를 받은 사람은 **로그인 없이** 결과 이미지를 볼 수 있고, 카톡/트위터 미리보기에 키캡 이미지가 뜬다.

## 접근법

**프론트 전용 공유 페이지 + 이미지 URL 쿼리 파라미터.** 백엔드 수정 없이 가능.

- `resultImageUrl`은 공개 CDN(`images.jipsamoye.com`) → URL만 있으면 누구나 접근 가능.
- 잡 조회 API는 본인만 가능(타인 403)이므로 jobId 기반 공유 페이지는 백엔드 수정 없이는 불가.

**검토한 대안:**
- jobId 기반 공개 공유 API(백엔드 추가): URL이 짧지만 백엔드 작업 + 배포 대기 필요. 추후 전환 가능.
- 이미지 URL 클립보드 복사만: 구현 최소지만 미리보기가 밋밋하고 서비스 유입(CTA) 없음.

**트레이드오프(수용):**
1. URL이 김 (인코딩된 CDN URL 포함).
2. `img` 파라미터로 우리 CDN의 아무 이미지나 공유 페이지를 만들 수 있음 — 외부 도메인은 차단, CDN 내 이미지는 어차피 공개라 수용.
3. 원본 삭제 시 공유 페이지도 깨짐 — 백엔드가 생성 결과를 보관하므로 현실적 문제 없음.

## 구현

### 1. 공유 URL 유틸 — `src/lib/figurineShare.ts` (신규)

- `getSharedFigurineImageUrl(img)`: 공유 페이지의 `img` searchParam 검증.
  `https://images.jipsamoye.com/` 로 시작하는 문자열만 통과, 그 외(타 도메인·http·비URL·배열·undefined)는 `null`.
- `buildFigurineShareUrl(resultImageUrl, origin)`: `{origin}/figurines/share?img={encodeURIComponent(url)}`.

### 2. 공유 페이지 — `src/app/figurines/share/page.tsx` (신규, 서버 컴포넌트)

- `searchParams.img` 검증 실패 시 `notFound()`.
- `generateMetadata`: 제목 "AI 키캡 피규어 — 집사모여" + `og:image`/`twitter:card` = 결과 이미지.
- 내용: 결과 이미지 크게 + 슬로건 + "나도 만들어보기" 버튼(→ `/figurines/new`).
- 인증 무관 공개 페이지 (OG 크롤러 접근 필요).

### 3. 공유 버튼 — `FigurineCreator.tsx` 결과 화면

- "자랑 피드에 게시하기"와 "다른 사진으로 다시 만들기" 사이에 아웃라인 버튼 "링크로 공유하기".
- `navigator.share` 지원 시 네이티브 공유 시트(취소는 무시), 미지원 시 클립보드 복사 + 토스트
  ("링크가 복사됐어요!" / 실패 시 "링크 복사에 실패했어요.") — `posts/[id]` 관례.
- `completed`뿐 아니라 `posted` 상태에서도 활성 (서버 변이 없는 동작이라).

## 테스트

- 유틸: 정상 CDN URL 통과 / 타 도메인·`http:`·비URL·배열·undefined 거부, 공유 URL 인코딩 확인.
- 페이지: 유효 `img` → 메타데이터 og:image 포함 + 이미지·CTA 렌더, 무효 → `notFound`.
- 버튼: `navigator.share` 존재 시 호출, 부재 시 clipboard + 토스트, 실패 토스트.

## 완료 기준

- 결과 화면에서 공유 → 링크 복사/공유 시트 동작.
- 링크 접속 시 (비로그인 포함) 이미지 + CTA 페이지 표시.
- 테스트 통과 + `npx next build` "Generating static pages" 단계 통과.
