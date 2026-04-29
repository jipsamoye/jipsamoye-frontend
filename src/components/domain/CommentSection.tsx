'use client';

import { useState, useEffect, useRef } from 'react';
import { Comment, User } from '@/types/api';
import { formatDate } from '@/lib/utils';
import { useComments } from '@/hooks/useComments';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import { EllipsisVerticalIcon } from '@/components/layout/icons';

interface CommentSectionProps {
  postId: string;
  user: User | null;
  onCountChange?: (delta: number) => void;
}

interface ReplyingTo {
  rootId: number;
  parentId: number;
  targetNickname: string;
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

  const [commentText, setCommentText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [replyText, setReplyText] = useState('');
  const commentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commentMenuRef.current && !commentMenuRef.current.contains(e.target as Node)) {
        setOpenCommentMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddParent = async () => {
    if (!user || !commentText.trim()) return;
    try {
      await addComment({ rootId: null, parentId: null, content: commentText });
      setCommentText('');
      onCountChange?.(1);
    } catch { /* ignore */ }
  };

  const handleAddReply = async () => {
    if (!user || !replyingTo || !replyText.trim()) return;
    try {
      await addComment({
        rootId: replyingTo.rootId,
        parentId: replyingTo.parentId,
        content: replyText,
      });
      setReplyingTo(null);
      setReplyText('');
      onCountChange?.(1);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!user) return;
    try {
      const delta = await deleteComment(id);
      if (delta !== 0) onCountChange?.(delta);
    } catch { /* ignore */ }
  };

  const handleEdit = async (id: number) => {
    if (!user || !editText.trim()) return;
    try {
      await updateComment(id, editText);
      setEditingId(null);
      setEditText('');
    } catch { /* ignore */ }
  };

  const startReply = (rootId: number, parentId: number, targetNickname: string) => {
    setReplyingTo({ rootId, parentId, targetNickname });
    setReplyText('');
  };

  const renderMaskedBody = () => (
    <p className="text-sm text-gray-400 italic mt-1">삭제된 댓글입니다</p>
  );

  const renderContent = (c: Comment, isReply: boolean) => {
    if (c.isMasked) return renderMaskedBody();
    return (
      <p className="text-sm text-gray-700 mt-1">
        {isReply && c.mentionedNickname && (
          <span className="text-amber-500 font-medium mr-1">@{c.mentionedNickname}</span>
        )}
        {c.content}
      </p>
    );
  };

  return (
    <>
      {/* 댓글 입력 */}
      {user && (
        <div className="flex gap-3 mb-6">
          <Avatar src={user.profileImageUrl} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParent()}
              placeholder="댓글 달기"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
            />
            <Button size="sm" className="flex-shrink-0" onClick={handleAddParent}>댓글</Button>
          </div>
        </div>
      )}

      {/* 댓글 목록 */}
      <div className="flex flex-col gap-4 mb-12">
        {comments.map((comment) => {
          const replies = comment.replies ?? [];
          const moreCount = comment.replyCount - replies.length;
          const canActOnParent = !comment.isMasked && user?.nickname === comment.nickname;
          const showReplyInputForThisRoot = replyingTo?.rootId === comment.id;

          return (
            <div key={comment.id} id={`comment-${comment.id}`}>
              {/* 부모 댓글 */}
              <div className="flex gap-3">
                <Avatar src={comment.profileImageUrl} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.nickname}</span>
                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    </div>
                    {canActOnParent && editingId !== comment.id && (
                      <div className="relative" ref={openCommentMenuId === comment.id ? commentMenuRef : undefined}>
                        <button
                          onClick={() => setOpenCommentMenuId(openCommentMenuId === comment.id ? null : comment.id)}
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                        >
                          <EllipsisVerticalIcon />
                        </button>
                        {openCommentMenuId === comment.id && (
                          <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 z-50">
                            <button
                              onClick={() => { setOpenCommentMenuId(null); setEditingId(comment.id); setEditText(comment.content ?? ''); }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => { setOpenCommentMenuId(null); handleDelete(comment.id); }}
                              className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-50"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 px-3 py-1 rounded border border-gray-200 bg-transparent text-sm focus:outline-none"
                      />
                      <Button size="sm" onClick={() => handleEdit(comment.id)}>저장</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  ) : (
                    <>
                      {renderContent(comment, false)}
                      {!comment.isMasked && user && (
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => startReply(comment.id, comment.id, comment.nickname)}
                            className="text-xs text-gray-400 hover:text-amber-500 transition-all duration-200"
                          >
                            답글
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 답글 목록 */}
              {replies.length > 0 && (
                <div className="ml-12 mt-3 flex flex-col gap-3 border-l-2 border-gray-100 pl-4">
                  {replies.map((reply) => {
                    const canActOnReply = user?.nickname === reply.nickname && !reply.isMasked;
                    return (
                      <div key={reply.id} id={`comment-${reply.id}`} className="flex gap-3">
                        <Avatar src={reply.profileImageUrl} size="xs" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{reply.nickname}</span>
                            <span className="text-xs text-gray-400">{formatDate(reply.createdAt)}</span>
                          </div>
                          {editingId === reply.id ? (
                            <div className="flex gap-2 mt-1">
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 px-3 py-1 rounded border border-gray-200 bg-transparent text-sm focus:outline-none"
                              />
                              <Button size="sm" onClick={() => handleEdit(reply.id)}>저장</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                            </div>
                          ) : (
                            renderContent(reply, true)
                          )}
                          {!reply.isMasked && (
                            <div className="flex items-center gap-3 mt-1">
                              {user && editingId !== reply.id && (
                                <button
                                  onClick={() => startReply(comment.id, reply.id, reply.nickname)}
                                  className="text-xs text-gray-400 hover:text-amber-500 transition-all duration-200"
                                >
                                  답글
                                </button>
                              )}
                              {canActOnReply && editingId !== reply.id && (
                                <>
                                  <button
                                    onClick={() => { setEditingId(reply.id); setEditText(reply.content ?? ''); }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => handleDelete(reply.id)}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                  >
                                    삭제
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* "N개 더보기" 버튼 */}
              {moreCount > 0 && (
                <div className="ml-12 mt-2">
                  <button
                    onClick={() => loadReplies(comment.id)}
                    className="text-xs text-gray-400 hover:text-amber-500 transition-all duration-200"
                  >
                    답글 {moreCount}개 더보기
                  </button>
                </div>
              )}

              {/* 답글 입력창 */}
              {showReplyInputForThisRoot && user && (
                <div className="ml-12 mt-3 flex gap-3">
                  <Avatar src={user.profileImageUrl} size="xs" />
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-500 font-medium">
                        @{replyingTo!.targetNickname}
                      </span>
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddReply()}
                        placeholder="답글을 입력하세요"
                        className="w-full px-4 py-2 rounded-xl border border-gray-100 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
                        style={{ paddingLeft: `${12 + (replyingTo!.targetNickname.length + 1) * 7 + 8}px` }}
                        autoFocus
                      />
                    </div>
                    <Button size="sm" className="flex-shrink-0" onClick={handleAddReply}>등록</Button>
                    <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>취소</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 댓글 더보기 */}
        {hasNext && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-amber-500 transition-all duration-200 disabled:opacity-50"
            >
              댓글 더보기
            </button>
          </div>
        )}
      </div>
    </>
  );
}
