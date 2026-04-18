'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Comment, PageResponse, User } from '@/types/api';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import { EllipsisVerticalIcon } from '@/components/layout/icons';

interface CommentSectionProps {
  postId: string;
  user: User | null;
}

export default function CommentSection({ postId, user }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: number; nickname: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const commentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PageResponse<Comment>>(`/api/posts/${postId}/comments?page=0&size=50`)
      .then((res) => setComments(res.data.content.map((c) => ({ ...c, replies: c.replies ?? [] }))))
      .catch(() => {});
  }, [postId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commentMenuRef.current && !commentMenuRef.current.contains(e.target as Node)) setOpenCommentMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    try {
      const res = await api.post<Comment>(`/api/posts/${postId}/comments`, { content: commentText });
      setComments((prev) => [{ ...res.data, replies: [] }, ...prev]);
      setCommentText('');
    } catch { /* ignore */ }
  };

  const handleReply = async (parentId: number) => {
    if (!user || !replyText.trim()) return;
    try {
      const res = await api.post<Comment>(`/api/posts/${postId}/comments?parentId=${parentId}`, { content: replyText });
      const newReply = { ...res.data, parentId, replies: [] };
      setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newReply] } : c));
      setReplyingTo(null);
      setReplyText('');
    } catch {
      const fakeReply: Comment = {
        id: Date.now(),
        content: replyText,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        parentId,
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replies: [...(c.replies ?? []), fakeReply] } : c));
      setReplyingTo(null);
      setReplyText('');
    }
  };

  const handleDeleteComment = async (commentId: number, parentId?: number | null) => {
    if (!user) return;
    try {
      await api.delete(`/api/comments/${commentId}`);
    } catch { /* ignore */ }
    if (parentId) {
      setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== commentId) } : c));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const handleEditComment = async (commentId: number, parentId?: number | null) => {
    if (!user || !editText.trim()) return;
    try {
      const res = await api.patch<Comment>(`/api/comments/${commentId}`, { content: editText });
      if (parentId) {
        setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replies: (c.replies ?? []).map((r) => r.id === commentId ? { ...res.data, parentId, replies: [] } : r) } : c));
      } else {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...res.data, replies: c.replies } : c));
      }
      setEditingId(null);
      setEditText('');
    } catch { /* ignore */ }
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
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder="댓글 달기"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
            />
            <Button size="sm" onClick={handleComment}>댓글</Button>
          </div>
        </div>
      )}

      {/* 댓글 목록 */}
      <div className="flex flex-col gap-4 mb-12">
        {comments.map((comment) => (
          <div key={comment.id}>
            {/* 부모 댓글 */}
            <div className="flex gap-3">
              <Avatar src={comment.profileImageUrl} size="sm" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.nickname}</span>
                    <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {user?.nickname === comment.nickname && editingId !== comment.id && (
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
                            onClick={() => { setOpenCommentMenuId(null); setEditingId(comment.id); setEditText(comment.content); }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => { setOpenCommentMenuId(null); handleDeleteComment(comment.id); }}
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
                    <Button size="sm" onClick={() => handleEditComment(comment.id)}>저장</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                        <span>0</span>
                      </button>
                      {user && (
                        <button
                          onClick={() => { setReplyingTo({ id: comment.id, nickname: comment.nickname }); setReplyText(''); }}
                          className="text-xs text-gray-400 hover:text-amber-500 transition-all duration-200"
                        >
                          답글
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 대댓글 목록 */}
            {(comment.replies ?? []).length > 0 && (
              <div className="ml-12 mt-3 flex flex-col gap-3 border-l-2 border-gray-100 pl-4">
                {(comment.replies ?? []).map((reply) => (
                  <div key={reply.id} className="flex gap-3">
                    <Avatar src={reply.profileImageUrl} size="xs" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{reply.nickname}</span>
                        <span className="text-xs text-gray-400">{new Date(reply.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {editingId === reply.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 px-3 py-1 rounded border border-gray-200 bg-transparent text-sm focus:outline-none"
                          />
                          <Button size="sm" onClick={() => handleEditComment(reply.id, comment.id)}>저장</Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 mt-1">{reply.content}</p>
                      )}
                      {user?.nickname === reply.nickname && editingId !== reply.id && (
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => { setEditingId(reply.id); setEditText(reply.content); }} className="text-xs text-gray-400 hover:text-gray-600">수정</button>
                          <button onClick={() => handleDeleteComment(reply.id, comment.id)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 답글 입력창 */}
            {replyingTo?.id === comment.id && user && (
              <div className="ml-12 mt-3 flex gap-3">
                <Avatar src={user.profileImageUrl} size="xs" />
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-500 font-medium">@{replyingTo.nickname}</span>
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
                      placeholder="답글을 입력하세요"
                      className="w-full px-4 py-2 rounded-xl border border-gray-100 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
                      style={{ paddingLeft: `${12 + (replyingTo.nickname.length + 1) * 7 + 8}px` }}
                      autoFocus
                    />
                  </div>
                  <Button size="sm" onClick={() => handleReply(comment.id)}>등록</Button>
                  <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>취소</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
