'use client';

import { useMemo } from 'react';
import { Comment, CommentCreateRequest } from '@/types/api';
import { useThreadedComments, ThreadedCommentConfig } from './useThreadedComments';

const PAGE_SIZE = 20;
const REPLY_BATCH = 50;

export function useComments(petPostId: number) {
  const config: ThreadedCommentConfig<Comment> = useMemo(
    () => ({
      entityId: petPostId,
      listUrl: (page: number) =>
        `/api/comments/post/${petPostId}?page=${page}&size=${PAGE_SIZE}`,
      repliesUrl: (parentId: number) =>
        `/api/comments/${parentId}/replies?page=0&size=${REPLY_BATCH}`,
      createUrl: '/api/comments',
      itemUrl: (id: number) => `/api/comments/${id}`,
      buildCreateBody: (parentId: number | null, content: string): CommentCreateRequest => ({
        petPostId,
        parentId,
        mentionedUserId: null,
        content,
      }),
    }),
    [petPostId],
  );

  return useThreadedComments<Comment>(config);
}
