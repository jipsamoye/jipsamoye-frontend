'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import PostCard from '@/components/domain/PostCard';

export default function LikedPostsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }

    api.get<PageResponse<PetPostListItem>>(`/api/users/me/likes?page=0&size=20`)
      .then((res) => setPosts(res.data.content))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 탭 */}
      <div className="border-b border-gray-100 mb-6">
        <div className="flex gap-6">
          <button className="pb-3 border-b-2 border-gray-900 text-sm font-medium text-gray-900">
            좋아요한 게시글
          </button>
        </div>
      </div>

      {/* 게시글 목록 */}
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">🐾</p>
          <p>아직 좋아요한 게시글이 없어요</p>
        </div>
      )}
    </div>
  );
}
