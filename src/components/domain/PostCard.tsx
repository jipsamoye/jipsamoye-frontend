import Link from 'next/link';
import { PetPostListItem } from '@/types/api';
import { HeartIcon, EyeIcon } from '@/components/layout/icons';

interface PostCardProps {
  post: PetPostListItem;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link href={`/posts/${post.id}`} className="block group">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden transition-transform group-hover:scale-[1.02]">
        <div className="aspect-square bg-gray-200 dark:bg-gray-700 overflow-hidden">
          {post.thumbnailUrl ? (
            <img
              src={post.thumbnailUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
              🐾
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="font-medium text-sm truncate">{post.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <HeartIcon />
              {post.likeCount}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{post.nickname}</p>
        </div>
      </div>
    </Link>
  );
}
