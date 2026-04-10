# 집사모여 — 프론트엔드

> **슬로건:** 우리 애 자랑하러
> 강아지·고양이를 키우는 집사들이 반려동물을 자랑하고 소통하는 커뮤니티

## 기술 스택

- **Framework:** Next.js 15 (App Router, TypeScript)
- **CSS:** Tailwind CSS
- **배포:** Vercel
- **백엔드:** Spring Boot (별도 레포: jipsamoye/jipsamoye-backend)

## 백엔드 API

- **로컬:** http://localhost:8080
- **운영:** http://43.203.165.97
- **Swagger:** http://43.203.165.97/swagger-ui/index.html

### API 엔드포인트 요약

**인증**
- `POST /api/auth/guest` — 둘러보기 임시 계정 생성 + 세션 발급
- `GET /api/auth/me?userId=` — 현재 로그인 유저 정보
- `POST /api/auth/logout` — 로그아웃
- `DELETE /api/auth/withdraw?userId=` — 회원 탈퇴

**게시글**
- `GET /api/posts?page=0&size=20` — 게시글 목록 (최신순, 페이지네이션)
- `GET /api/posts/{id}` — 게시글 상세
- `POST /api/posts?userId=` — 게시글 작성
- `PATCH /api/posts/{id}?userId=` — 게시글 수정
- `DELETE /api/posts/{id}?userId=` — 게시글 삭제 (soft delete)
- `GET /api/posts/popular` — 오늘의 멍냥 (인기 게시글, 1시간 캐싱)
- `GET /api/posts/search?q={keyword}&page=0&size=20` — 검색

**댓글**
- `GET /api/posts/{postId}/comments?page=0&size=20` — 댓글 목록
- `POST /api/posts/{postId}/comments?userId=` — 댓글 작성
- `PATCH /api/comments/{id}?userId=` — 댓글 수정
- `DELETE /api/comments/{id}?userId=` — 댓글 삭제

**좋아요**
- `POST /api/posts/{postId}/like?userId=` — 좋아요 토글 (true: 추가, false: 취소)

**팔로우**
- `POST /api/users/{nickname}/follow?userId=` — 팔로우 토글
- `GET /api/users/{nickname}/followers?page=0&size=20` — 팔로워 목록
- `GET /api/users/{nickname}/following?page=0&size=20` — 팔로잉 목록

**유저**
- `GET /api/users/{nickname}` — 프로필 조회
- `PATCH /api/users/me?userId=` — 프로필 수정
- `GET /api/users/{nickname}/posts?page=0&size=20` — 유저 게시글 목록

**이미지**
- `POST /api/images/presigned-url?userId=` — S3 Presigned URL 발급

### API 응답 형식 (성공/에러 동일)

```json
{ "status": 200, "code": "SUCCESS", "message": "요청 성공", "data": { ... } }
{ "status": 400, "code": "INVALID_INPUT", "message": "...", "data": null }
```

### 페이지네이션 응답

```json
{
  "data": {
    "content": [...],
    "totalPages": 5,
    "totalElements": 100,
    "currentPage": 0,
    "size": 20,
    "hasNext": true
  }
}
```

## 디자인 참고

- **스타일:** Grimity (https://www.grimity.com) 레이아웃 참고
- **색상:** 깔끔한 화이트 톤
- **레이아웃:** 왼쪽 사이드바 + 오른쪽 메인 콘텐츠

## 페이지 구조

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 메인 | `/` | 오늘의 멍냥 (가로 스크롤) + 최신 게시글 (4열 그리드) |
| 랭킹 | `/ranking` | 주간/월간 탭 + 인기 게시글 |
| 게시글 상세 | `/posts/[id]` | 이미지 + 작성자 + 좋아요 + 댓글 + 작성자 다른 글 + 추천 |
| 글쓰기 | `/posts/new` | 이미지 업로드 + 제목 + 내용 |
| 프로필 | `/users/[nickname]` | 커버 + 프로필 이미지 + 팔로워/팔로잉 + 게시글 목록 |
| 자유게시판 | `/board` | 아이콘만 (추후 기능 추가) |

## 레이아웃 구성

**사이드바:** 홈, 랭킹, 자유게시판
**헤더 (비로그인):** 로고 + [검색] [로그인]
**헤더 (로그인):** 로고 + [자랑하기] [검색] [알림아이콘] [프로필]
**로그인 모달:** 카카오/구글 + 둘러보기 버튼

## 게시글 카드 구성

- 썸네일 (첫 번째 이미지)
- 제목
- 좋아요 수 + 조회수
- 작성자 닉네임

## 이미지 업로드 흐름

1. 프론트에서 `POST /api/images/presigned-url` 호출 → presignedUrl + imageUrl 발급
2. presignedUrl로 S3에 직접 PUT 업로드
3. 게시글 작성 시 imageUrl을 body에 포함하여 전송

## 폴더 구조

```
src/
├── app/              # Next.js 페이지 (App Router)
├── components/       # 재사용 컴포넌트
│   ├── common/       # 버튼, 모달, 카드 등 공통
│   ├── layout/       # 헤더, 사이드바, 레이아웃
│   └── domain/       # 게시글 카드, 댓글, 프로필 등 도메인별
├── hooks/            # 커스텀 훅 (API 호출, 인증 등)
├── lib/              # API 클라이언트, 유틸
├── types/            # TypeScript 타입 정의
└── styles/           # 글로벌 스타일
```

## 주의사항

- 인증은 현재 userId를 RequestParam으로 전달 (추후 세션 기반으로 전환)
- 탈퇴한 유저의 게시글/댓글은 "탈퇴한 사용자"로 표시됨
- 프로필 기본 이미지는 프론트에서 처리 (profileImageUrl이 null이면 기본 이미지)
- S3 이미지 URL 형식: https://jipsamoye-bucket.s3.ap-northeast-2.amazonaws.com/{path}
