# 키캡 누르기 — 구현 세션 핸드오프

**작성일** 2026-08-08 · **브랜치** `feature/keycap-press` · **워크트리** `.claude/worktrees/keycap-press`

> 기획 핸드오프(`2026-08-08-keycap-press-handoff.md`)와 세부 구현 계획
> (`docs/superpowers/plans/2026-08-08-keycap-press.md`)을 잇는 문서.
> 구현 세션은 이 문서 → 계획 → (필요 시) 기획 스펙 순으로 읽으면 된다.

## 구현 세션이 할 일

1. `.claude/worktrees/keycap-press` 워크트리로 진입한다 (`EnterWorktree` path 지정). 새로 만들지 말 것 — 이 브랜치에 스펙·자산·계획이 전부 있다.
2. `docs/superpowers/plans/2026-08-08-keycap-press.md`를 **superpowers:subagent-driven-development**(권장) 또는 **superpowers:executing-plans**로 태스크 단위 실행한다. Task 1→10 순서 의존성 있음 (lib → 컴포넌트 → 적용 3곳 → 검증).
3. 완료 기준: 전체 vitest 통과 + `npx next build` "Generating static pages"까지 통과 + 계획 Task 10의 수동 확인 체크리스트.
4. push는 사용자 확인 후. 머지 후 Vercel 배포 확인까지가 책임 범위 (CLAUDE.md).

## 계획 세션(이번)에서 이미 검증한 것

- **베이스라인 클린:** 이 워크트리에서 `npm install` 후 88개 파일 · 776개 테스트 전부 통과 (2026-08-08).
- **프로토타입 실동작:** `prototype/mobile-nudge.html`(최종안)을 로컬 서버로 띄워 브라우저에서 직접 확인 — 키캡 누름 시 유도 3종(배지·물결·자가 시연) 영구 소멸, 축 칩 전환·프리뷰 재생, 음원 14개 fetch 200. 튜닝값(스쿼시 `scaleY(.9) scaleX(1.04)` 110ms, 시연 380ms @ 0.9s/4.2s, 물결 1.9s, 프리뷰 up 딜레이 130ms)은 계획의 "튜닝값 표"에 옮겨놨다 — **변경 금지**.
- 프로토타입 서버는 `prototype/`이 아니라 **`assets/keycap-press/` 루트에서** 띄워야 `../sounds/` fetch가 산다. (포트 8899는 다른 세션이 쓰고 있을 수 있음)

## 계획 수준에서 확정한 구현 결정 (계획 문서에 근거 상세)

| 결정 | 요지 |
|---|---|
| **WAV 유지, ogg 변환 안 함** | Safari/iOS `decodeAudioData`가 Ogg Vorbis 미지원 — ogg만 실으면 iOS에서 소리 전멸. 총 140KB라 절감 이득도 미미 |
| **게시글 상세에도 칩바 렌더** | 스펙이 상세에서 뺀 건 "유도 3종"뿐. iOS 무음 대응·음소거 가시성 요구는 상세에도 적용 |
| **제이드 140ms 트림+페이드** (자산 단계) | 스펙 열린 항목 1 해소 — 런타임 페이드 로직 대신 ffmpeg로 자산을 고침. Task 1에서 청취 검증 필수 |
| **localStorage는 마운트 후 useEffect에서 읽기** | share 페이지가 서버 컴포넌트 → hydration mismatch 방지 |

## 아키텍처 한 장 요약

```
public/sounds/keycap/*.wav (14) + LICENSE.txt   ← kbsim MIT 고지 (필수)
src/lib/keycap.ts        축 7종 메타 + localStorage(keycap.switch/muted/pressed)
src/lib/keycapSound.ts   WebAudio 싱글턴 — AudioContext는 제스처 안에서 lazy 생성
src/components/domain/KeycapSwitchBar.tsx   음소거 + 칩 7개 (controlled)
src/components/domain/PressableKeycap.tsx   상태 소유 래퍼 — children = 이미지
적용: FigurineCreator(nudge) · figurines/share(nudge) · posts/[id] 첫 이미지(유도 없음)
```

## 조심할 지점

- **스펙의 "버린 것" 재제안 금지** — 레이어 분리, 축 랜덤 배정, round-robin, 무접점, WebAudio 합성음, 햅틱.
- Task 7에서 기존 `FigurineCreator.test.tsx`의 결과 섹션 구조 assertion이 래퍼 추가로 깨질 수 있다 — 의도 보존하며 갱신.
- 게시글 상세의 기존 `AiKeycapBadge`에 `pointer-events-none` 추가를 잊으면 배지 영역이 안 눌린다.
- 제약 4(배지 정렬): 바깥 div `-translate-x-1/2` / 안쪽 배지 `floating` 분리 — 한 요소에 합치면 배지가 왼쪽으로 튕겨나간다.
