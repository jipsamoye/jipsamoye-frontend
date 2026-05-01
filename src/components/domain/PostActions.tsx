'use client';

import { HeartIcon, ShareIcon } from '@/components/layout/icons';

interface PostActionsProps {
  likeCount: number;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
}

export default function PostActions({ likeCount, liked, onLike, onShare }: PostActionsProps) {
  return (
    <div className="flex justify-center gap-3 mb-10">
      <button
        type="button"
        onClick={onShare}
        className="inline-flex items-center justify-center gap-2 px-7 py-2.5 min-h-[44px] rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
      >
        <ShareIcon />
        공유하기
      </button>
      <button
        type="button"
        onClick={onLike}
        className={`inline-flex items-center justify-center gap-1.5 px-6 py-2.5 min-h-[44px] rounded-xl font-medium text-sm shadow-sm shadow-amber-200 transition-all duration-200 ${
          liked
            ? 'bg-amber-600 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
      >
        <HeartIcon filled={liked} />
        좋아요 <span className="tabular-nums opacity-90">{likeCount}</span>
      </button>
    </div>
  );
}
