'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PetPostListItem } from '@/types/api';
import Thumbnail from '@/components/common/Thumbnail';
import Avatar from '@/components/common/Avatar';
import ProfileHoverCard from '@/components/domain/ProfileHoverCard';

interface PostCardProps {
  post: PetPostListItem;
  index?: number;
}

export default function PostCard({ post, index = 99 }: PostCardProps) {
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  const goToProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/users/${encodeURIComponent(post.nickname)}`);
  };

  return (
    <Link href={`/posts/${post.id}`} className="block group">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02]">
        <div className="aspect-square bg-gray-200 overflow-hidden rounded-t-2xl relative">
          {post.thumbnailUrl ? (
            <>
              {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
              <Thumbnail
                src={post.thumbnailUrl}
                alt={post.title}
                sizes="(max-width: 768px) 50vw, 253px"
                loading={index < 8 ? 'eager' : 'lazy'}
                fetchPriority={index < 4 ? 'high' : 'auto'}
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
          <p className="font-semibold text-sm text-gray-900 truncate">{post.title}</p>
          <div className="flex items-center justify-between mt-2">
            <ProfileHoverCard nickname={post.nickname}>
              <button
                type="button"
                onClick={goToProfile}
                className="flex items-center gap-2 min-w-0 hover:opacity-70 transition-opacity"
                aria-label={`${post.nickname} 프로필 보기`}
              >
                <Avatar src={post.profileImageUrl ?? null} size="sm" />
                <span className="text-xs text-gray-500 truncate hover:text-gray-700">{post.nickname}</span>
              </button>
            </ProfileHoverCard>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium tabular-nums">
                ❤ {post.likeCount}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 font-medium tabular-nums">
                💬 {post.commentCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
