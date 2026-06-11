'use client';

import { User } from '@/types/api';
import { useComments } from '@/hooks/useComments';
import CommentThread from './CommentThread';

interface CommentSectionProps {
  postId: string;
  user: User | null;
  onCountChange?: (delta: number) => void;
}

export default function CommentSection({ postId, user, onCountChange }: CommentSectionProps) {
  const numericPostId = Number(postId);
  const {
    comments,
    hasNext,
    loading,
    loadMore,
    loadReplies,
    addComment,
    updateComment,
    deleteComment,
  } = useComments(numericPostId);

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
      hideAvatarOnMobile={true}
    />
  );
}
