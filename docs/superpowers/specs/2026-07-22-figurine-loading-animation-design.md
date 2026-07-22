# AI 키캡 피규어 — 생성 대기 애니메이션 설계

- 작성일: 2026-07-22
- 대상 화면: `/figurines/new` (`src/components/domain/FigurineCreator.tsx`, `phase === 'generating'`)
- 관련 문서: `docs/superpowers/specs/2026-07-22-figurine-ai-api-handoff.md`, `docs/superpowers/plans/2026-07-22-figurine-ai.md`
- 목업: 세션 스크래치패드의 `figurine-loading-mockup.html` (A/B/C 3안 + reduced-motion·지연 시나리오 토글). 레포에 커밋하지 않는 검토용 산출물.

## 1. 문제

현재 대기 화면은 원본 사진 + 회전 스피너 + 고정 문구 한 줄이다.

```
[원본 사진 opacity-60]
   ⟳  (amber 스피너)
키캡 피규어를 만들고 있어요…
보통 1분 안에 완성돼요. 이 화면을 벗어나면 진행 상황을 볼 수 없어요.
```

문제는 세 가지다.

1. **평균 60초, 최대 5분의 대기를 스피너 하나가 감당한다.** 스피너는 10초를 넘어가면 "멈춘 것 같다"는 신호로 읽힌다.
2. **무엇을 만드는지 보여주지 않는다.** 이 기능의 핵심 가치인 "키캡 피규어"가 대기 중엔 화면 어디에도 없다.
3. **디자인 토큰 이탈.** `amber-500`은 Tailwind 기본값이고, 이 프로젝트 팔레트(`globals.css @theme`)에 정의된 포인트 컬러는 `orange-500 #ff8a00`이다.

## 2. 제약 — 진행률은 존재하지 않는다

`useFigurineJob`은 `GET /api/figurines/{id}`를 2.5초 간격으로 폴링하고, 서버는
`PENDING | PROCESSING | COMPLETED | FAILED` 4상태만 반환한다. **퍼센트 필드가 없다.**

따라서 진행률 바(0→100%)를 그리면 그 숫자는 전부 클라이언트가 지어낸 값이 된다.
70%에서 멈춰 있다가 갑자기 완료되거나, 100%에 도달하고도 계속 도는 순간 신뢰가 깨진다.

**결론: 퍼센트를 쓰지 않는다.** 대신 두 가지로 대체한다.

- **무한 슬라이드 진행바** — "진행 중"만 전달하고 완료 시점은 약속하지 않는다.
- **경과 시간 기반 단계 내러티브** — 서버 상태가 아니라 클라이언트 경과 시간으로 카피를 전환한다.
  이건 거짓 진행률이 아니라 *작업 설명*이므로 정직하다. (실제로 백엔드는 분석→생성→후처리를 순차 수행한다.)

## 3. 검토한 3안

목업에서 3안을 나란히 구현해 비교했다.

| | A. 레진 몰딩 키캡 | B. 미니 키보드 타이핑 | C. 스캔 현상 |
|---|---|---|---|
| 동작 | 빈 키캡에 얼굴이 떠오르고 주황 레진이 차올라 굳음 | 키캡 4개가 순차로 눌리고 마지막 키캡에 얼굴이 또렷해짐 | 스캔 빔이 원본 사진을 훑고 지나가며 키캡 버전이 드러남 |
| 브랜드 적합 | **최상** — 만드는 *과정*이 그대로 그림이 됨 | 중 — 키보드는 맞지만 "피규어를 빚는" 서사 없음 | 중상 |
| 구현 비용 | 중간 (CSS ~120줄) | 낮음 (~40줄) | 낮음 |
| 리스크 | 없음 | 서사 약함 | **가짜 완성본이 실제 결과 기대를 왜곡** |
| 재사용성 | 낮음 (이 화면 전용) | 높음 | 낮음 |

**C를 탈락시킨 이유**가 가장 명확하다. "완성된 키캡이 드러나는" 연출은 사용자가 그 프리뷰를 결과물로
오인하게 만든다. 실제 결과가 나왔을 때 기대와 다르면 애니메이션이 만든 기대가 그대로 실망이 된다.
대기 화면은 결과를 암시해선 안 된다.

**B는 안전하지만 심심하다.** 이 기능은 자랑 피드로 이어지는 재미 기능이라 대기 자체가 경험의 일부다.
B는 "로딩 중"만 말하고 "우리 애를 키캡으로 만드는 중"은 말하지 않는다.

### 추천: A — 레진 몰딩 키캡

빈 키캡 안에 우리 애 얼굴이 흐릿하게 떠오르고, 그 위로 주황빛 레진이 차올라 굳으며 표면 광택이 지나간다.
6초 루프. 이 그림 하나가 "지금 무엇을 만드는 중인지"를 카피 없이 설명하고, 4단계 카피와 1:1로 맞물린다.

트레이드오프도 분명하다. **CSS 코드가 3안 중 가장 길고(약 120줄) 이 화면 전용이라 재사용이 안 된다.**
대신 이 기능이 서비스의 신규 킬러 기능이라는 점, 대기가 경험의 절반이라는 점에서 그 비용은 정당하다.
재사용이 필요해지면 그때 B 수준의 범용 로더를 별도로 만든다.

## 4. 설계

### 4.1 컴포넌트 경계

```
src/components/domain/FigurineLoading.tsx   (신규, 'use client')
  props: { previewUrl?: string | null; startedAt: number }
  책임: 키캡 몰딩 애니메이션 + 단계 카피 전환 + 접근성 처리
  의존: useFigurineStageCopy 훅, globals.css keyframes

src/hooks/useFigurineStageCopy.ts           (신규)
  입력: startedAt (ms epoch)
  출력: { stage: FigurineStage; line: string }
  책임: 1초 tick으로 경과 시간을 단계에 매핑. 그 외 아무것도 안 함.
```

`FigurineCreator`는 `phase === 'generating'` 블록을 `<FigurineLoading />` 한 줄로 교체한다.
`FigurineCreator`는 이미 flow 제어로 187줄이라, 애니메이션 마크업을 여기 넣으면 두 책임이 섞인다.

`startedAt`은 `FigurineCreator`가 `handleGenerate` 시점에 `Date.now()`로 잡아 넘긴다.
훅 내부에서 마운트 시각을 잡지 않는 이유는 테스트에서 시간을 주입할 수 있어야 하기 때문이다.

### 4.2 단계 카피 타임라인

| 경과 | stage | 카피 |
|---|---|---|
| 0–8초 | `analyzing` | 사진에서 우리 애를 찾고 있어요 |
| 8–22초 | `sculpting` | 이목구비를 피규어로 다듬는 중이에요 |
| 22–40초 | `casting` | 키캡 안에 레진을 붓고 있어요 |
| 40–60초 | `polishing` | 표면을 반짝반짝 광내는 중이에요 |
| 60초+ | `overtime` | 거의 다 왔어요. 조금만 더 기다려 주세요 |

`overtime` 단계가 핵심이다. 안내한 "보통 1분"을 넘긴 순간이 사용자가 이탈을 고민하는 지점이므로,
그 구간에서 카피가 바뀌어야 시스템이 살아 있다는 신호가 된다. 60초 이후엔 보조 문구
"보통 1분 안에 완성돼요"를 "사진에 따라 더 걸릴 수 있어요"로 함께 교체한다.

실패 처리는 기존 그대로다 — 서버가 5분 초과 작업을 FAILED 처리하고, 클라이언트는 `MAX_POLLS = 144`
(6분) 백스톱을 유지한다. 이 애니메이션은 타임아웃 로직을 건드리지 않는다.

### 4.3 애니메이션 구조 (A안)

`globals.css`에 keyframes를 추가하고 Tailwind의 `animate-[name_dur_ease_infinite]` 임의값으로 참조한다
(`Toast.tsx`의 `slideDown` 선례와 동일한 관례).

| keyframe | 대상 | 주기 | 내용 |
|---|---|---|---|
| `figurineBob` | 키캡 전체 | 3.4s | translateY 0 → -8px 부유 |
| `figurineShadow` | 바닥 그림자 | 3.4s | scale·opacity 연동 |
| `figurineFocus` | 피사체 | 6s | grayscale+blur → 선명, scale 0.9 → 1.02 |
| `figurineFill` | 레진 레이어 | 6s | height 0 → 100% → 0 |
| `figurineWave` | 레진 표면 | 2.2s | 26px translateX 반복 (물결) |
| `figurineSweep` | 광택 | 3.2s | 좌→우 하이라이트 스윕 |
| `figurineTwinkle` | 반짝임 3개 | 6s | 지연 3.2/3.6/4.0s, 완성 직전 느낌 |
| `figurineSlide` | 진행바 | 1.6s | translateX -110% → 360% |

`transform` / `opacity` / `height`만 사용한다. `height` 애니메이션은 레이아웃을 유발하지만
`overflow:hidden` 컨테이너 내부 절대배치 요소라 리페인트 범위가 키캡 안으로 갇힌다.

**피사체 이미지:** 업로드한 원본 사진(`previewUrl` blob)을 키캡 안에 마스킹해 넣는다.
개인화 효과가 크고, 이미 메모리에 있어 추가 네트워크 비용이 없다. blob이 없는 경우
(새로고침 등)에만 실루엣 플레이스홀더로 폴백한다.

### 4.4 컬러

`amber-*` → `orange-*` 전면 교체. 레진은 `orange-400`~`yellow-300` 그라디언트,
진행바는 `orange-300 → orange-500`, 키캡 본체는 `gray-100`~`gray-300`.
`FigurineCreator`의 `PRIMARY_BUTTON` 상수도 `bg-orange-500 hover:bg-orange-600`으로 함께 정리한다.

### 4.5 접근성

- 애니메이션 컨테이너 전체에 `aria-hidden="true"` — 장식이므로 스크린리더가 읽을 게 없다.
- 카피 블록은 `role="status" aria-live="polite"`. 단계가 바뀔 때만 읽히므로 5회 이하로 소음이 없다.
- `prefers-reduced-motion: reduce`에서는 **모든 keyframe을 정지**하고 레진이 62% 차오른 정지 프레임을
  보여준다. 카피 전환은 그대로 유지 — 이게 실제 진행 신호이므로 없애면 안 된다.
  진행바는 회색 고정 트랙으로 대체한다.
- 카피 전환 페이드(`figurineFadeSwap`)도 reduced-motion에서 제거하고 즉시 교체한다.

### 4.6 성능

- JS 타이머는 `useFigurineStageCopy`의 1초 `setInterval` 하나뿐. 폴링 타이머(2.5초)와 독립.
- 언마운트 시 인터벌 해제. `phase !== 'generating'`이면 컴포넌트 자체가 사라지므로 자동 정리.
- 애니메이션은 전부 CSS라 메인 스레드 부담이 없다.

## 5. 테스트 계획

CLAUDE.md 규칙상 테스트 없이 커밋하지 않는다.

**`tests/hooks/useFigurineStageCopy.test.ts`** (fake timers)
- 정상: 0/8/22/40/60초 경계에서 각 단계로 전환된다
- 경계: 정확히 8초에서 `sculpting`(7.9초는 `analyzing`)
- 엣지: 60초 이후 300초까지 `overtime`에 머문다 (그 위 단계로 넘어가지 않음)
- 정리: 언마운트 후 인터벌이 더 이상 실행되지 않는다

**`tests/components/FigurineLoading.test.tsx`**
- `role="status"` 영역이 존재하고 현재 단계 카피를 담는다
- 애니메이션 컨테이너가 `aria-hidden`이다
- `previewUrl`이 있으면 이미지를, 없으면 플레이스홀더를 렌더한다
- 퍼센트 텍스트(`%`)가 화면에 존재하지 않는다 — 회귀 방지용 명시 테스트

**`tests/components/FigurineCreator.test.tsx`** (기존 보강)
- `phase === 'generating'`에서 `FigurineLoading`이 렌더된다
- 기존 스피너 마크업 관련 단언이 있으면 갱신 (기존 동작 보존 확인)

## 6. 범위 밖

- 백엔드에 진행률 필드 추가 — 별건. 추가되면 이 설계의 카피 타임라인을 실제 단계로 교체할 수 있다.
- 백그라운드 생성(화면 이탈 후에도 진행) — 폴링 구조 변경이 필요한 별도 작업.
- 다크모드 — 프로젝트 전반이 아직 라이트 전용이므로 이 화면만 선행하지 않는다.
- 완료 시점 전환 애니메이션(로딩 → 결과) — 후속 개선 후보로 남긴다.

## 7. 완료 기준

- [ ] `/figurines/new`에서 생성 요청 시 키캡 몰딩 애니메이션이 재생된다
- [ ] 8/22/40/60초에 카피가 바뀐다
- [ ] 화면 어디에도 퍼센트가 없다
- [ ] `prefers-reduced-motion`에서 애니메이션이 멈추고 카피만 바뀐다
- [ ] `amber-*` 클래스가 이 화면에서 전부 사라진다
- [ ] 위 테스트 전부 통과
- [ ] `npx next build` 통과
