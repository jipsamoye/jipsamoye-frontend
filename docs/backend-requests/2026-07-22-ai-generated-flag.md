# 백엔드 요청: 게시글 응답에 aiGenerated 플래그 추가

> 2026-07-22, 프론트 AI 키캡 라벨 기능 관련

## 배경

피드 카드와 게시글 상세의 AI 생성 이미지 위에 "AI 키캡" 라벨을 표시하는 기능이 프론트에 들어갔다.
현재는 게시글 응답에 AI 생성 여부 필드가 없어서, **제목이 "AI 키캡 자랑"과 완전 일치하면 AI 게시글로 간주**하는
임시 휴리스틱으로 동작 중이다. 유저가 같은 제목으로 직접 쓴 글에도 라벨이 붙는 오탐 가능성이 있다.

## 요청 사항

아래 응답들의 게시글 객체에 `aiGenerated: boolean` 필드 추가:

- `GET /api/posts` (목록 content 각 항목)
- `GET /api/posts/{id}` (상세)
- `GET /api/posts/popular`, `GET /api/posts/search`, `GET /api/users/{nickname}/posts` 등 PetPostListItem을 반환하는 모든 API

값 기준: `POST /api/figurines/{jobId}/post` 로 생성된 게시글이면 `true`, 그 외 `false`.

## 프론트 호환성

프론트는 이미 forward-compat으로 구현되어 있어 **배포 순서 제약 없음**:

```ts
// src/lib/aiPost.ts
post.aiGenerated ?? post.title === 'AI 키캡 자랑'
```

- 필드가 없으면(현재) → 제목 휴리스틱 사용
- 필드가 오면 → 플래그가 우선 (휴리스틱 자동 무력화, 프론트 재배포 불필요)
