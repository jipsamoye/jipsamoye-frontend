'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchPosts } from '@/hooks/usePosts';
import PostCard from '@/components/domain/PostCard';
import { PostCardSkeleton } from '@/components/common/Skeleton';
import { MagnifyingGlassIcon } from '@/components/layout/icons';

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const { posts, loading, hasNext, search } = useSearchPosts(query);
  const observerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      setNotice('두 글자 이상 입력해주세요');
      return;
    }
    setNotice('');
    setQuery(trimmed);
  };

  // 커밋된 검색어가 유효하면 새 검색 실행
  useEffect(() => {
    if (query.trim().length < 2) return;
    search(true);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한 스크롤
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !loading) search(false);
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [search, hasNext, loading]);

  const searched = query.trim().length >= 2;

  return (
    <div>
      {/* 검색창 */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <button
            type="button"
            onClick={handleSubmit}
            aria-label="검색"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <MagnifyingGlassIcon />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit();
            }}
            placeholder="게시글을 검색해보세요"
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
          />
        </div>
        {notice && (
          <p className="mt-2 text-sm text-amber-600">{notice}</p>
        )}
      </div>

      {/* 검색 결과 */}
      {searched && loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : searched && !loading && posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">🔍</p>
          <p>검색 결과가 없어요</p>
        </div>
      ) : posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 24px), calc(25vw - 92px)"
              />
            ))}
          </div>
          <div ref={observerRef} className="h-10" />
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
