# 구글 검색결과 파비콘이 옛날 발바닥으로 나오는 문제 — 프론트 작업 지시

> 백엔드 세션 전달 문서 (2026-08-07). 진단은 라이브 사이트·이 레포를 직접 확인해 끝냈고, **코드 수정은 전혀 하지 않았다.**
> 구현·테스트·배포는 이 문서를 읽는 프론트엔드 세션이 맡는다.

## 문제

구글에서 `jipsamoye.com`을 검색하면 결과 옆 아이콘이 **옛날 🐾 발바닥**으로 나온다.
브라우저 탭에 뜨는 아이콘은 **코랄색 "집사모여" 글씨**다.

**사용자가 원하는 방향은 하나로 확정됐다 — 탭 아이콘이 정답이고, 구글 쪽을 거기에 맞춘다.** (반대 방향 아님)

## 진단 (실측 완료)

| 항목 | 실측 결과 |
|---|---|
| `https://www.jipsamoye.com/favicon.svg` | **200**, `image/svg+xml`, 344 bytes |
| `https://www.jipsamoye.com/favicon.ico` | **404** — apex `jipsamoye.com`도 동일 |
| 서빙되는 HTML `<head>` | `<link rel="icon" href="/favicon.svg"/>` **단 하나** |
| `public/favicon.svg` | `#ff734c` 라운드 사각형 + `<text>` 2줄("집사"/"모여") |
| `src/app/layout.tsx:16-18` | `icons: { icon: '/favicon.svg' }` |
| apple-touch-icon / manifest / PNG 아이콘 | 전부 없음 |
| `robots.ts` / `sitemap.ts` | 없음 |
| 배포 | Vercel (응답 헤더 `dpl_` 확인) |

### 근본 원인

구글 파비콘 크롤러는 **루트 `/favicon.ico`를 우선 조회한다.** 지금 404라서 새 아이콘을 수집하지 못하고, 커밋 `2bfb238`(`fix(favicon): 발바닥(🐾) 파비콘을 '집사모여' 글씨로 교체`)에서 `src/app/favicon.ico`가 삭제되기 **이전에 캐싱해둔 발바닥을 계속 쓰고 있다.**

### 부수 리스크 (같이 해소됨)

현재 SVG는 `<text>` + 시스템 한글 폰트(`Apple SD Gothic Neo` / `Malgun Gothic` / `Noto Sans KR`)에 의존한다. 한글 폰트가 없는 렌더링 환경에서는 두부(□□□)로 깨진다. 래스터로 한 번 구워두면 이 문제도 사라진다.

## 작업 범위 — 사용자가 이미 결정한 사항 (임의로 넓히지 말 것)

**1. 범위는 `favicon.ico` + `apple-touch-icon.png` 까지.**
`manifest.webmanifest`, `icon-192.png`, `icon-512.png`는 **하지 않는다.** PWA가 아니므로 YAGNI로 제외하기로 사용자와 합의했다.

**2. 아이콘 디자인은 바꾸지 않는다.**
탭 아이콘과 100% 동일하게 4글자("집사"/"모여") 그대로 래스터화한다.

> 구글 검색결과는 파비콘을 16~18px로 표시하므로 4글자가 뭉개질 가능성이 있다(원래 발바닥을 썼던 이유일 수 있음). 이 점은 사용자에게 이미 고지했고, **"일단 그대로 굽고 48/32/16px 실물을 확인한 뒤 결정"** 으로 정해졌다.
> → **사전에 재디자인하지 말 것.** 생성된 실물을 사용자에게 보여주고, 조정 여부는 그때 사용자가 판단한다.

## 구현 지침

### 1. 래스터 생성 — 새 의존성 없이 puppeteer 사용

`puppeteer`가 이미 devDependency(`^24.42.0`)로 들어있다. 헤드리스 크롬으로 `public/favicon.svg`를 렌더해 크기별 PNG를 캡처하면 된다. **Windows 크롬은 `Malgun Gothic`을 가지고 있어 한글이 정상 렌더된다.**

일회성 스크립트로 때우지 말고 **재실행 가능한 형태**로 남길 것:
- `scripts/generate-favicons.mjs`
- `package.json`에 실행 스크립트 추가 (예: `"favicons": "node scripts/generate-favicons.mjs"`)

SVG를 바꿨을 때 다시 굽기만 하면 되도록 하는 게 목적이다.

### 2. ICO 인코딩 — 라이브러리 추가 불필요

순수 Node로 만들 수 있다. **PNG-in-ICO** 방식이며 모던 브라우저와 구글 모두 지원한다:

```
ICONDIR      (6바이트)   reserved=0, type=1, count=N
ICONDIRENTRY (16바이트×N) width, height, 0, 0, planes=1, bitCount=32, bytesInRes, imageOffset
PNG 블롭 N개
```

**16 / 32 / 48 멀티사이즈로 넣을 것.** (구글이 참조하는 건 48)

### 3. 산출 파일

| 파일 | 내용 |
|---|---|
| `public/favicon.ico` | 16·32·48 멀티사이즈 |
| `public/apple-touch-icon.png` | 180×180 |
| `public/favicon.svg` | **그대로 유지** — 탭에서는 계속 SVG가 쓰여야 선명하다 |

`.ico`는 반드시 **`public/`** 에 둔다. `src/app/favicon.ico`에 두면 안 된다 (아래 테스트 항목 참고).

### 4. `src/app/layout.tsx` 메타데이터 확장

```ts
icons: {
  icon: [
    { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    { url: '/favicon.svg', type: 'image/svg+xml' },
  ],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
},
```

`.ico`를 먼저 선언해 구글이 확실히 집도록 하고, SVG도 남겨 모던 브라우저 탭에서는 계속 벡터가 쓰이게 한다.

### 5. ⚠️ 기존 테스트가 깨진다

`tests/app/favicon.test.ts`의 마지막 케이스가 문자열 리터럴을 정확히 검사한다:

```ts
expect(layout).toContain("icon: '/favicon.svg'");
```

위 4번 구조로 바꾸면 **이 단언은 실패한다.** 함께 수정해야 한다.

**나머지 회귀 방지 케이스는 그대로 유지할 것:**
- 🐾 부재
- "집사" / "모여" 포함
- `#ff734c` 이고 `#f59e0b` 아님
- `src/app/favicon.ico` 부재 — 새 `.ico`는 `public/`에 두므로 **이 단언은 계속 통과한다**

### 6. 추가할 테스트

- `public/favicon.ico` 존재 + ICO 매직넘버(`00 00 01 00`) + 디렉터리 엔트리에 16·32·48 포함
- `public/apple-touch-icon.png` 존재 + PNG 시그니처(`89 50 4E 47`)
- `layout.tsx`가 `/favicon.ico`와 `/favicon.svg`를 **둘 다** 참조

### 7. 레포 규칙 (CLAUDE.md)

- 테스트 없이 커밋 금지
- push 전 `npx next build` 통과 확인 — "Generating static pages" 단계까지
- main push 후 **Vercel 배포 성공 여부까지 확인**. "푸쉬 완료"로 끝내지 말 것
- 브랜치는 레포 관례대로 `feature/*` → main PR (**이 레포에는 develop 브랜치가 없다**)

## 배포 이후 — 사용자 수동 작업 (코드 아님)

1. `curl -I https://www.jipsamoye.com/favicon.ico` → **200** 확인
2. Google Search Console → URL 검사 → `https://www.jipsamoye.com/` 색인 요청

### 반드시 사용자에게 미리 말해둘 것

**코드를 고쳐 배포해도 구글 검색결과는 즉시 안 바뀐다.** 구글이 파비콘을 재크롤링할 때까지 **수일~수주** 걸리며, 이건 우리가 제어할 수 없다. 배포 직후 검색해보고 "안 고쳐졌다"고 오해하지 않도록 먼저 안내할 것.
