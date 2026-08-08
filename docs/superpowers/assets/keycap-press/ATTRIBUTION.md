# 키캡 축 소리 — 출처와 라이선스

배포 시 **kbsim(MIT) 저작권 고지가 반드시 필요하다.** CC0 2종은 의무 없음.

> 키보드 사운드: [kbsim](https://github.com/tplai/kbsim) © Thomas Lai (MIT)

## 파일별 출처

| 파일 | 축 | 출처 | 라이선스 |
|---|---|---|---|
| `brown-down.wav` / `brown-up.wav` | Cherry MX Brown (갈축) | kbsim `src/assets/audio/mxbrown/press/GENERIC_R2.mp3`, `release/GENERIC.mp3` | MIT |
| `blue-down.wav` / `blue-up.wav` | Cherry MX Blue (청축) | kbsim `mxblue/` 동일 경로 | MIT |
| `red-down.wav` / `red-up.wav` | Gateron Red Ink (리니어) | kbsim `redink/` 동일 경로 | MIT |
| `navy-down.wav` / `navy-up.wav` | Kailh Box Navy | kbsim `boxnavy/` 동일 경로 | MIT |
| `cream-down.wav` / `cream-up.wav` | NovelKeys Cream | kbsim `cream/` 동일 경로 | MIT |
| `jade-down.wav` / `jade-up.wav` | Kailh Box Jade | [Freesound 643558](https://freesound.org/people/el_boss/sounds/643558/) (el_boss) | CC0 |
| `black-down.wav` / `black-up.wav` | Gateron Black | [Freesound 643559](https://freesound.org/people/el_boss/sounds/643559/) (el_boss) | CC0 |

## 라이선스 원문 (검증된 인용)

**kbsim** — `LICENSE.md`:
> Copyright (c) Thomas Lai — Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction…
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

마지막 문장 때문에 **음원을 재배포하는 우리도 고지 의무가 있다.**

**Freesound CC0** — 두 사운드 페이지 공통:
> Creative Commons 0 — You can copy, modify, distribute and perform the sound, even for commercial purposes, all without the need of asking permission to the author.

## 가공 내역

- kbsim: `GENERIC_R2`(QWERTY 줄) 변형 선택. R0~R4는 키보드 **행(row)** 을 뜻하며 `KeySimulator.js`에서 확인됨. 윗줄이 밝고 아랫줄이 어둡다.
- Freesound: 익명으로는 원본 다운로드 불가(API/CDN 6개 경로 전부 401/403/302 확인). `cdn.freesound.org/previews/...-hq.ogg`에서 잘라냄. **mp3 미리듣기는 19kHz 로우패스가 걸려 있어 ogg를 썼다.**
- 전부 mono / 44100Hz / `pcm_s16le`, **피크 -3.0 dBFS로 정규화**, 리딩 무음 제거(온셋 ≤4ms), 트랜지언트 1개만 포함되도록 검증.

## 배제한 소스와 이유

배포 전에 "더 좋은 소스 없나" 다시 찾을 필요 없다. 아래는 전부 확인 후 탈락시킨 것들이다.

| 소스 | 탈락 사유 |
|---|---|
| `nathan-fiscaletti/keyboardsounds` | GPL-3.0 |
| `Acylation/obsidian-click-clack` | MIT지만 음원이 Writemonkey 3(클로즈드 프리웨어)에서 가져온 것 — MIT가 덮지 못함 |
| `millerjs/modelm` | LICENSE 없음, 음원 출처가 제3자 웹사이트·유튜브 |
| mechvibes.com 커뮤니티 팩 130여 개 | 라이선스·저작자 표기 전무 |
| Pixabay | *"You cannot sell or distribute Content on a Standalone basis"* — 정적 에셋 서빙이 이 조항에 걸림 |
| Mixkit | *"You can't redistribute the Item on its own"* — 명시적 금지 |
| archive.org `office-sound-effects` | CC0로 **선언**돼 있으나 실제 내용물은 Mixkit 파일 재업로드. `licenseurl`은 업로더 자기신고라 신뢰 불가 |
| OpenGameArt "Single Key Press Sounds" | 페이지 라이선스가 CC-BY 3.0이고, 원본이 **맥 멤브레인 키보드** — 기계식으로 라벨하면 오라벨 |
| Freesound 546165 | 제목은 "HHKB, Topre"인데 설명은 "WhiteFox / Hako Violet" — 자기모순 |
