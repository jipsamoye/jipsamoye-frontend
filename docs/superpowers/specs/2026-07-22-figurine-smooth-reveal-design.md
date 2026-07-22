# AI 키캡 피규어 결과 이미지 부드러운 표시 — 설계

날짜: 2026-07-22
브랜치: `fix/figurine-smooth-reveal` (origin/main 기반, PR #41 머지본 위)

## 문제

키캡 피규어 생성 완료 시 결과 이미지가 "끊기듯" 표시된다.

1. **로드 전 화면 교체**: `phase === 'completed'` 순간 스피너가 사라지고 `DetailImage`가
   마운트되는데, 이미지 다운로드는 그때 시작된다. 빈 영역이 떴다가 이미지가 점진적으로
   그려지거나 한 박자 늦게 나타난다.
2. **썸네일 404 플래시**: `DetailImage`는 `_800.webp` 썸네일을 먼저 시도하지만, 방금 생성된
   결과 이미지는 Lambda 썸네일이 아직 없을 확률이 높다. 404 → `onError` → 원본 재요청으로
   이미지가 두 번 로드되며 깜빡인다.
3. **레이아웃 점프**: 결과 `<img>`에 고정 비율이 없어 로드 순간 높이가 튀고 버튼이 밀린다.

## 목표

완성 순간 빈 화면·깜빡임·레이아웃 점프 없이, 이미지가 완전히 준비된 뒤 부드럽게 페이드인.

## 설계 (선택안: 로딩 유지 → 완성되면 페이드인)

1. **프리로드 단계**: `phase`가 `completed`가 되어도 바로 결과 화면으로 전환하지 않는다.
   `resultImageUrl`을 백그라운드에서 프리로드(`new Image()` + `decode()`)하고, 그동안 기존
   "만들고 있어요…" 스피너 화면을 유지한다.
2. **로드 완료 → 페이드인**: 디코딩까지 끝나면 결과 섹션을 마운트하고 섹션 전체(이미지+버튼)를
   `opacity-0 → opacity-100`, `transition-opacity duration-500`으로 페이드인한다. 캐시에 이미
   있으므로 마운트 즉시 완성된 픽셀이 그려진다.
3. **썸네일 우회**: 결과 이미지는 `DetailImage` 대신 원본 URL을 직접 `<img>`로 표시해
   404 → fallback 재요청 깜빡임을 제거한다.
4. **안전장치**: 프리로드가 실패하거나 8초를 넘기면 그냥 결과 화면으로 전환한다(기존 동작
   폴백). 사용자가 무한 대기하지 않는다.

## 구현 위치

- `src/lib/preloadImage.ts` (신규): `preloadImage(url, timeoutMs): Promise<void>` —
  성공/실패/타임아웃 모두 resolve (전환 트리거 용도이므로 reject 불필요).
- `src/components/domain/FigurineCreator.tsx`: `revealReady` 로컬 상태 추가.
  `phase === 'completed'` && `job.resultImageUrl` 감지 → 프리로드 → `revealReady = true`.
  결과 섹션 렌더 조건에 `revealReady` 반영, 페이드인 클래스 적용, `DetailImage` → `<img>` 교체.
- `useFigurineJob`의 phase 상태 머신은 변경하지 않는다 (리스크 최소화).

## 테스트

- `tests/lib/preloadImage.test.ts` (신규): 로드 성공 시 resolve, 로드 실패 시에도 resolve,
  타임아웃 시 resolve.
- `tests/components/FigurineCreator.test.tsx` (기존 보강): completed 직후에는 스피너 유지,
  프리로드 완료 후 결과 섹션 표시.

## 트레이드오프

체감 대기 시간이 이미지 로드 시간(보통 1~2초)만큼 늘어나지만, 이미 1분 가까이 기다린 뒤라
체감 차이는 작고 완성 순간의 인상이 좋아진다. 실패·지연 시 8초 백스톱으로 기존 동작에 수렴.
