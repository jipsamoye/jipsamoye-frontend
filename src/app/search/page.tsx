'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PetPostListItem, PageResponse } from '@/types/api';
import PostCard from '@/components/domain/PostCard';
import { MagnifyingGlassIcon } from '@/components/layout/icons';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get<PageResponse<PetPostListItem>>(
        `/api/posts/search?q=${encodeURIComponent(keyword)}&page=0&size=20`
      );
      setPosts(res.data.content);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 검색창 */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <MagnifyingGlassIcon />
          </span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="게시글을 검색해보세요"
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      </div>

      {/* 검색 결과 */}
      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">검색 중...</div>
      ) : searched && posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">🔍</p>
          <p>검색 결과가 없어요</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
