# AI 키캡 이미지 생성 기능 — 백엔드 API 연동 가이드

> 백엔드 전달 문서 (2026-07-22). 세부 UI/구현 계획은 프론트엔드에서 작성.
> 백엔드 브랜치: `jipsamoye.backend` `feature/figurine-ai` (develop 미머지, 대기 상태 — 프론트 개발 시점에 맞춰 머지/배포 요청)

## 기능 개요

반려동물 사진을 올리면 OpenAI가 **아티산 키캡 위 미니 피규어 굿즈 스타일** 이미지로 변환해주고, 버튼 한 번으로 자랑 피드에 자동 게시하는 기능. 기존 글쓰기와 **별도 버튼/화면**으로 진입.

## 전체 플로우 (4단계)

```
1. 사진 업로드   : 기존 presigned 흐름 그대로 (dirName=posts) → imageUrl 획득
2. 생성 요청     : POST /api/figurines { sourceImageUrl } → jobId 즉시 반환
3. 상태 폴링     : GET /api/figurines/{jobId} 를 2~3초 간격 반복
                   → COMPLETED가 되면 resultImageUrl 표시
4. 자동 게시(선택): POST /api/figurines/{jobId}/post → 자랑 피드에 게시글 생성
```

생성은 서버에서 비동기 처리되며 **보통 수십 초** 걸린다. 새 API는 모두 기존과 동일한 인증(로그인 필수)·응답 래퍼(`{status, code, message, data}`)를 사용한다.

## API 명세

### 1. 생성 요청 — `POST /api/figurines` → 201

```json
// 요청
{ "sourceImageUrl": "https://images.jipsamoye.com/posts/{내userId}/{uuid}.jpg" }

// 응답 data
{ "jobId": 1, "status": "PENDING", "resultImageUrl": null, "failReason": null, "petPostId": null }
```

⚠️ `sourceImageUrl`은 **본인이 presigned로 업로드한 posts 경로 이미지만** 허용 (타인 이미지·다른 경로는 400).

### 2. 상태 조회(폴링) — `GET /api/figurines/{jobId}` → 200

응답 `data`는 위와 동일한 구조. `status` 값:

| status | 의미 | 프론트 처리 |
|--------|------|------------|
| `PENDING` / `PROCESSING` | 생성 중 | 로딩 UI, 폴링 계속 |
| `COMPLETED` | 완료 | `resultImageUrl` 이미지 표시 + "게시하기" 버튼 노출 |
| `FAILED` | 실패 | `failReason` 안내 + "다시 시도" (새 사진으로 1번부터) |

- 서버가 **5분 넘게 진행 중인 작업은 자동으로 FAILED 처리**하므로, 프론트는 무한 폴링 걱정 없이 FAILED 수신 시 중단하면 된다.
- 본인 job만 조회 가능 (타인 jobId는 403).

### 3. 자동 게시 — `POST /api/figurines/{jobId}/post` → 201

```json
// 요청 바디 없음
// 응답 data
{ "petPostId": 77 }
```

- 제목 "AI 키캡 자랑"으로 서버가 알아서 게시글 생성 (사용자 입력 없음). 생성된 게시글로 이동시켜주면 됨.
- **1회만 가능** — 중복 요청은 409 (서버에서 더블클릭도 방어하지만, 버튼 비활성화 처리 권장).

## 에러 코드

| HTTP | code | 상황 |
|------|------|------|
| 400 | `BAD_REQUEST` | 본인 posts 이미지가 아닌 URL |
| 400 | `FIGURINE_JOB_NOT_COMPLETED` | 완료 전에 게시 시도 |
| 403 | `FORBIDDEN` | 타인의 job 접근 |
| 404 | `FIGURINE_JOB_NOT_FOUND` | 없는 jobId |
| 409 | `FIGURINE_ALREADY_POSTED` | 이미 게시된 job 재게시 |
| 502 | `FIGURINE_GENERATION_FAILED` | (폴링 응답의 failReason으로 주로 전달됨) |

## 참고사항

- 결과는 요청당 **1장 (1024×1024 PNG)**. 마음에 안 들면 새 생성 요청으로 재시도.
- 생성 결과·원본은 서버가 보관하므로 프론트에서 별도 정리 불필요.
- 사용량 제한은 현재 없음 (추후 추가 예정이니 UI에 하드코딩된 무제한 가정은 피할 것).
- 게시하지 않고 이탈해도 무방 (미게시 결과는 그냥 남음).
