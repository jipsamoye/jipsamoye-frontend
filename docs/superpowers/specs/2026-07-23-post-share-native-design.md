# 게시글 상세 공유 UX 통일 (네이티브 공유 시트) — 설계

- **날짜:** 2026-07-23
- **브랜치:** `feature/post-share-native` (origin/main 기준)

## 배경

- AI 키캡 결과 공유(PR #53)는 버튼 클릭 즉시 `navigator.share` 네이티브 공유 시트를 열고, 미지원 브라우저에서는 클립보드 복사 + 토스트로 폴백한다.
- 게시글 상세(`/posts/[id]`)의 공유하기 버튼은 모달을 띄운 뒤 "링크 복사하기"만 제공한다 — 클릭이 한 번 더 필요하고 네이티브 공유가 안 된다.
- 게시글 상세 URL은 이미 공개 페이지이므로 키캡처럼 별도 공유 페이지(`/figurines/share`)는 필요 없다. 가져올 것은 공유 UX뿐이다.

## 목표

게시글 상세의 공유 UX를 키캡과 동일하게 통일한다: 네이티브 공유 시트 → 클립보드 폴백. 공유 로직은 공용 유틸로 추출해 양쪽이 함께 쓴다.

## 변경 내용

### 1. `src/lib/share.ts` (신규)

```ts
export async function shareOrCopyLink(options: { title: string; url: string }): Promise<void>
```

- `navigator.share` 지원 시 네이티브 시트 호출. 사용자가 시트를 닫은 경우(AbortError 등 reject)는 조용히 무시.
- 미지원 시 `navigator.clipboard.writeText(url)` 후 "링크가 복사됐어요!" 토스트. 실패 시 "링크 복사에 실패했어요." 토스트.
- 에러 처리는 유틸 내부에서 완결(토스트) — 호출부는 fire-and-forget.

### 2. `src/components/domain/FigurineCreator.tsx`

- `handleShare` 내부의 share/clipboard 분기를 `shareOrCopyLink` 호출로 교체. 동작 불변 리팩터링 (공유 URL 생성 `buildFigurineShareUrl`은 그대로).

### 3. `src/app/posts/[id]/page.tsx`

- 공유 모달 제거: `showShareModal` state, 공유 `Modal` JSX, `handleCopyLink`, `LinkIcon` import 삭제.
- `PostActions`의 `onShare`에서 바로 `shareOrCopyLink({ title: `${post.title} — 집사모여`, url: window.location.href })` 호출.

## 테스트

- `tests/lib/share.test.ts` (신규): ① navigator.share 지원 시 시트 호출 ② AbortError 시 토스트 없음 ③ 미지원 시 클립보드 복사 + 성공 토스트 ④ 클립보드 실패 시 실패 토스트.
- `FigurineCreator` 기존 공유 테스트(`FigurineCreator.share.test.tsx`) 통과 확인 — 리팩터링 동작 보존.
- 게시글 상세: 공유 버튼 클릭 시 네이티브 공유(또는 폴백 복사)가 수행되는지 확인.

## 트레이드오프 / 주의

- 데스크톱 크롬·엣지도 `navigator.share`를 지원해 OS 공유 시트가 뜬다. "그냥 복사"를 기대하는 데스크톱 사용자에겐 한 단계 어색할 수 있으나, 키캡 쪽과의 일관성을 우선한다 (사용자 확정).
- 시트 안에도 "링크 복사" 항목이 있으므로 기능 손실은 없다.

## 범위 제외

- 게시글별 OG 미리보기(`generateMetadata`) 도입 — 별도 작업.
