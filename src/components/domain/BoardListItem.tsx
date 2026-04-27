'use client';

import Link from 'next/link';
import { BoardListItem as BoardListItemType } from '@/types/api';
import { timeAgoOrDate } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';

interface Props {
  item: BoardListItemType;
}

const CATEGORY_LABEL: Record<BoardListItemType['category'], string> = {
  NOTICE: '공지',
  GENERAL: '일반',
  QUESTION: '질문',
};

const CATEGORY_STYLE: Record<BoardListItemType['category'], string> = {
  NOTICE: 'bg-emerald-50 text-emerald-600',
  GENERAL: 'bg-gray-100 text-gray-600',
  QUESTION: 'bg-amber-50 text-amber-600',
};

export default function BoardListItem({ item }: Props) {
  return (
    <Link
      href={`/board/${item.id}`}
      className="flex items-start gap-4 py-4 border-b border-gray-100 hover:bg-gray-50/60 px-2 -mx-2 rounded-lg transition-colors"
    >
      {/* 좌: 카테고리 배지 */}
      <span className={`flex-shrink-0 inline-flex items-center justify-center w-14 h-7 rounded-full text-xs font-semibold ${CATEGORY_STYLE[item.category]}`}>
        {CATEGORY_LABEL[item.category]}
      </span>

      {/* 중: 제목 + 댓글수 + 내용 미리보기 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
          {item.commentCount > 0 && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              <span>{item.commentCount}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{item.contentPreview}</p>
      </div>

      {/* 우: Avatar + 닉네임 (상단) / 날짜 (하단) */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1 text-xs">
        <div className="flex items-center gap-1.5">
          <Avatar src={item.profileImageUrl ?? null} size="xs" />
          <span className="text-gray-600 font-medium">{item.nickname}</span>
        </div>
        <span className="text-gray-400">{timeAgoOrDate(item.createdAt)}</span>
      </div>
    </Link>
  );
}
