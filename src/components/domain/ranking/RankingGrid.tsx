'use client';

import PostCard from '@/components/domain/PostCard';
import { PostCardSkeleton } from '@/components/common/Skeleton';
import { PetPostListItem } from '@/types/api';

interface RankingGridProps {
  posts: PetPostListItem[];
  initialLoading: boolean;
}

/**
 * 랭킹 게시글 그리드
 * - PostCard 4열 그리드
 * - 초기 로딩: skeleton 8개
 * - 빈 상태: "이 기간에 인기 게시글이 없어요"
 */
export default function RankingGrid({ posts, initialLoading }: RankingGridProps) {
  if (initialLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-4">🏆</p>
        <p className="text-sm">이 기간에 인기 게시글이 없어요</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {posts.map((post, i) => (
        <PostCard key={post.id} post={post} index={i} />
      ))}
    </div>
  );
}
