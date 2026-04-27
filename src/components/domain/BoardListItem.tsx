'use client';

import Link from 'next/link';
import { BoardListItem as BoardListItemType } from '@/types/api';
import { timeAgoOrDate } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';

interface Props {
  item: BoardListItemType;
}

const CATEGORY_LABEL: Record<BoardListItemType['category'], string> = {
  GENERAL: '일반',
  QUESTION: '질문',
};

const CATEGORY_STYLE: Record<BoardListItemType['category'], string> = {
  GENERAL: 'bg-gray-100 text-gray-600',
  QUESTION: 'bg-amber-50 text-amber-600',
};

export default function BoardListItem({ item }: Props) {
  return (
    <Link
      href={`/board/${item.id}`}
      className="flex items-start gap-3 py-4 border-b border-gray-100 hover:bg-gray-50/60 px-2 -mx-2 rounded-lg transition-colors"
    >
      <Avatar src={item.profileImageUrl ?? null} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`flex-shrink-0 inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-semibold ${CATEGORY_STYLE[item.category]}`}>
            {CATEGORY_LABEL[item.category]}
          </span>
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {item.title}
            {item.commentCount > 0 && (
              <span className="ml-1 text-amber-500">{item.commentCount}</span>
            )}
          </h3>
        </div>
        <p className="text-xs text-gray-500 truncate">{item.contentPreview}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span className="font-medium text-gray-600">{item.nickname}</span>
          <span>·</span>
          <span>{timeAgoOrDate(item.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
