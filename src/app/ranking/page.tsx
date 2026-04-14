'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PetPostListItem } from '@/types/api';
import { dummyPopularPosts } from '@/lib/dummyData';
import PostCard from '@/components/domain/PostCard';

export default function RankingPage() {
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<PetPostListItem[]>('/api/posts/popular')
      .then((res) => setPosts(res.data.length > 0 ? res.data : dummyPopularPosts))
      .catch(() => setPosts(dummyPopularPosts))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 font-[family-name:var(--font-jua)]">인기 게시글 순위</h1>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('weekly')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            tab === 'weekly'
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          주간
        </button>
        <button
          onClick={() => setTab('monthly')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            tab === 'monthly'
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          월간
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">🏆</p>
          <p>아직 인기 게시글이 없어요</p>
        </div>
      )}
    </div>
  );
}
