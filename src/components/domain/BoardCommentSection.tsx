'use client';

import { User } from '@/types/api';
import { useBoardComments } from '@/hooks/useBoardComments';
import { COMMENT_MAX } from '@/lib/constants';
import CommentThread from './CommentThread';

interface BoardCommentSectionProps {
  boardId: number | string;
  user: User | null;
  onCountChange?: (delta: number) => void;
}

export default function BoardCommentSection({ boardId, user, onCountChange }: BoardCommentSectionProps) {
  const numericBoardId = Number(boardId);
  const {
    comments,
    hasNext,
    loading,
    loadMore,
    loadReplies,
    addComment,
    updateComment,
    deleteComment,
  } = useBoardComments(numericBoardId);

  return (
    <CommentThread
      comments={comments}
      hasNext={hasNext}
      loading={loading}
      loadMore={loadMore}
      loadReplies={loadReplies}
      addComment={addComment}
      updateComment={updateComment}
      deleteComment={deleteComment}
      user={user}
      onCountChange={onCountChange}
      commentMaxLength={COMMENT_MAX}
      hideAvatarOnMobile={false}
    />
  );
}
