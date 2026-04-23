# 스켈레톤 UI 확대 적용 — 추후 작업

## 배경

홈·자유게시판 목록엔 스켈레톤이 적용돼있고, Phase 1으로 **랭킹·검색·좋아요 페이지**에도 `PostCardSkeleton` 그리드를 적용 완료 (`2026-04-23` 배포).

나머지 페이지(상세·프로필·DM·게시판 상세)는 여전히 `"불러오는 중..."` 텍스트만 뜨는 상태. 일관성 + 체감 속도 관점에서 스켈레톤으로 전환 필요.

## 현재 상태 (2026-04-23 기준)

### ✅ 적용 완료

| 위치 | 스켈레톤 종류 |
|---|---|
| `src/app/page.tsx` (홈) | `PopularSliderSkeleton` + `PostCardSkeleton × 8` |
| `src/app/board/page.tsx` (자유게시판 목록) | 개별 `Skeleton` 조합 |
| `src/app/ranking/page.tsx` | `PostCardSkeleton × 8` |
| `src/app/search/page.tsx` | `PostCardSkeleton × 8` |
| `src/app/liked/page.tsx` | `PostCardSkeleton × 8` (탭 유지) |
| `components/domain/PostCard.tsx` | 이미지 로드 전 `animate-pulse` 배경 |
| `components/domain/PopularSlider.tsx` | 동일 (FadeImage 내부) |
| `components/domain/BoardEditor.tsx` | TipTap 에디터 로딩 시 블록 펄스 |

### ❌ 미적용 (현재 `"불러오는 중..."` 텍스트)

| 위치 | 참조 라인 |
|---|---|
| `src/app/users/[nickname]/page.tsx:134` | 프로필 페이지 전체 |
| `src/app/posts/[id]/page.tsx:77` | 게시글 상세 전체 |
| `src/app/board/[id]/page.tsx:68` | 자유게시판 상세 전체 |
| `src/app/dm/page.tsx:141` | DM 페이지 전체 |

## Phase 2 — 상세 페이지 (공수 ~30분)

### 대상 페이지
- `/posts/[id]` — 게시글 상세
- `/board/[id]` — 자유게시판 상세

### 할 일

1. `src/components/common/Skeleton.tsx`에 `PostDetailSkeleton` 추가:
   ```tsx
   export function PostDetailSkeleton() {
     return (
       <div className="max-w-3xl mx-auto">
         {/* 작성자 정보 */}
         <div className="flex items-center gap-3 mb-6">
           <Skeleton className="w-10 h-10 rounded-full" />
           <div className="flex-1">
             <Skeleton className="h-4 w-32 mb-2" />
             <Skeleton className="h-3 w-24" />
           </div>
         </div>
         {/* 이미지 */}
         <Skeleton className="w-full aspect-square rounded-2xl mb-6" />
         {/* 제목 */}
         <Skeleton className="h-8 w-3/4 mb-4" />
         {/* 본문 */}
         <Skeleton className="h-4 w-full mb-2" />
         <Skeleton className="h-4 w-full mb-2" />
         <Skeleton className="h-4 w-2/3 mb-6" />
         {/* 액션 버튼 */}
         <div className="flex gap-2 mb-8">
           <Skeleton className="h-10 w-20 rounded-xl" />
           <Skeleton className="h-10 w-10 rounded-xl" />
         </div>
       </div>
     );
   }
   ```

2. `src/app/posts/[id]/page.tsx:77` 수정:
   ```tsx
   // 변경 전
   if (loading) return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
   // 변경 후
   if (loading) return <PostDetailSkeleton />;
   ```

3. `src/app/board/[id]/page.tsx:68` 동일 패턴 적용.
   - 자유게시판은 이미지가 없을 수 있으니 `BoardDetailSkeleton` 따로 만들거나 `PostDetailSkeleton`에 `variant="board"` prop 추가 고려.

4. 테스트: 해당 페이지 진입 시 "불러오는 중..." 없이 스켈레톤 → 실제 콘텐츠로 전환되는지 확인.

## Phase 3 — 프로필 + DM (공수 ~45분)

### 3-A. 프로필 페이지 `/users/[nickname]`

**할 일:**

1. `Skeleton.tsx`에 `ProfileSkeleton` 추가:
   ```tsx
   export function ProfileSkeleton() {
     return (
       <div>
         {/* 커버 영역 */}
         <Skeleton className="w-full h-80 rounded-none" />
         {/* 프로필 영역 */}
         <div className="max-w-4xl mx-auto px-4 -mt-16 relative">
           <Skeleton className="w-32 h-32 rounded-full border-4 border-white" />
           <Skeleton className="h-6 w-40 mt-4 mb-2" />
           <Skeleton className="h-4 w-60 mb-4" />
           <div className="flex gap-4 mb-8">
             <Skeleton className="h-4 w-20" />
             <Skeleton className="h-4 w-20" />
             <Skeleton className="h-4 w-20" />
           </div>
         </div>
         {/* 게시글 그리드 */}
         <div className="max-w-4xl mx-auto px-4">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {Array.from({ length: 8 }).map((_, i) => (
               <PostCardSkeleton key={i} />
             ))}
           </div>
         </div>
       </div>
     );
   }
   ```

2. `src/app/users/[nickname]/page.tsx:134` 수정:
   ```tsx
   if (loading) return <ProfileSkeleton />;
   ```

### 3-B. DM 페이지 `/dm`

**할 일:**

1. `Skeleton.tsx`에 `DmSkeleton` 추가 — 좌측 채팅방 목록 스켈레톤:
   ```tsx
   export function DmSkeleton() {
     return (
       <div className="flex h-[calc(100vh-4rem)]">
         <aside className="w-80 border-r border-gray-100 p-4 space-y-3">
           {Array.from({ length: 5 }).map((_, i) => (
             <div key={i} className="flex items-center gap-3 p-2">
               <Skeleton className="w-10 h-10 rounded-full" />
               <div className="flex-1">
                 <Skeleton className="h-4 w-24 mb-2" />
                 <Skeleton className="h-3 w-32" />
               </div>
             </div>
           ))}
         </aside>
         <main className="flex-1 flex items-center justify-center text-gray-400">
           대화를 선택해주세요
         </main>
       </div>
     );
   }
   ```

2. `src/app/dm/page.tsx:141` 수정.

## Phase 4 — 공통 그리드 헬퍼 DRY 리팩터 (선택)

현재 4곳에 같은 패턴이 반복됨:

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {Array.from({ length: 8 }).map((_, i) => <PostCardSkeleton key={i} />)}
</div>
```

5곳 이상 반복되면 `PostCardGridSkeleton` 추가 고려:

```tsx
export function PostCardGridSkeleton({
  count = 8,
  className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
}: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => <PostCardSkeleton key={i} />)}
    </div>
  );
}
```

지금은 DRY 임계점 넘지 않음. Phase 2~3 후 재평가.

## 우선순위 추천

1. **Phase 2 먼저** — 상세 페이지 첫 진입 체감이 가장 큼 (이미지 큰 페이지)
2. **Phase 3-A** — 프로필 페이지 (그리드 + 프로필 영역 복합 → 스켈레톤 효과 큼)
3. **Phase 3-B** — DM (상대적으로 덜 자주 진입, 가장 마지막)
4. **Phase 4** — DRY 리팩터 (5+ 군데 반복되면 도입)

## 참고

- 기본 유닛 `Skeleton` 컴포넌트: `src/components/common/Skeleton.tsx:5`
- 카드 구조 맞춘 `PostCardSkeleton`: `src/components/common/Skeleton.tsx:13`
- 슬라이더 `PopularSliderSkeleton`: `src/components/common/Skeleton.tsx:23`
- Tailwind 펄스: `animate-pulse bg-gray-100`
- 원형/모서리 처리: `rounded-full`, `rounded-2xl`, `rounded-xl` 등
