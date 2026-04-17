'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PetPostListItem } from '@/types/api';
import { HeartIcon, EyeIcon } from '@/components/layout/icons';

interface PostCardProps {
  post: PetPostListItem;
  index?: number;
}

export default function PostCard({ post, index = 99 }: PostCardProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Link href={`/posts/${post.id}`} className="block group">
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02]">
        <div className="aspect-square bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-t-2xl relative">
          {post.thumbnailUrl ? (
            <>
              {!loaded && <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />}
              <img
                src={post.thumbnailUrl}
                alt={post.title}
                loading={index < 8 ? 'eager' : 'lazy'}
                fetchPriority={index < 4 ? 'high' : undefined}
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
              🐾
            </div>
          )}
        </div>
        <div className="p-3.5">
          <p className="font-medium text-sm truncate">{post.title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{post.nickname}</span>
            <span className="flex items-center gap-1">
              <HeartIcon />
              {post.likeCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
