'use client';

import { useMemo } from 'react';
import { BoardComment, BoardCommentCreateRequest } from '@/types/api';
import { useThreadedComments, ThreadedCommentConfig } from './useThreadedComments';

const PAGE_SIZE = 20;
const REPLY_BATCH = 50;

export function useBoardComments(boardId: number) {
  const config: ThreadedCommentConfig<BoardComment> = useMemo(
    () => ({
      entityId: boardId,
      listUrl: (page: number) =>
        `/api/board-comments/board/${boardId}?page=${page}&size=${PAGE_SIZE}`,
      repliesUrl: (parentId: number) =>
        `/api/board-comments/${parentId}/replies?page=0&size=${REPLY_BATCH}`,
      createUrl: '/api/board-comments',
      itemUrl: (id: number) => `/api/board-comments/${id}`,
      buildCreateBody: (parentId: number | null, content: string): BoardCommentCreateRequest => ({
        boardId,
        parentId,
        mentionedUserId: null,
        content,
      }),
    }),
    [boardId],
  );

  return useThreadedComments<BoardComment>(config);
}
