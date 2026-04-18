'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { BoardComment, PageResponse, User } from '@/types/api';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import { EllipsisVerticalIcon } from '@/components/layout/icons';
import { timeAgo } from '@/lib/utils';

interface Props {
  boardId: number | string;
  user: User | null;
}

export default function BoardCommentSection({ boardId, user }: Props) {
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PageResponse<BoardComment>>(`/api/boards/${boardId}/comments?page=0&size=50`, { silent: true })
      .then((res) => setComments(res.data.content))
      .catch(() => {});
  }, [boardId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async () => {
    if (!user || !input.trim()) return;
    try {
      const res = await api.post<BoardComment>(`/api/boards/${boardId}/comments`, { content: input });
      setComments((prev) => [res.data, ...prev]);
      setInput('');
    } catch {
      // ignore
    }
  };

  const handleEdit = async (id: number) => {
    if (!editText.trim()) return;
    try {
      const res = await api.patch<BoardComment>(`/api/board-comments/${id}`, { content: editText });
      setComments((prev) => prev.map((c) => (c.id === id ? res.data : c)));
      setEditingId(null);
      setEditText('');
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/board-comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-10">
      <h3 className="text-lg font-bold text-gray-900 mb-4">댓글 {comments.length}</h3>

      {user && (
        <div className="flex gap-3 mb-6">
          <Avatar src={user.profileImageUrl} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSubmit()}
              placeholder="댓글을 입력해주세요"
              maxLength={500}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <Button size="sm" onClick={handleSubmit}>등록</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {comments.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">첫 번째 댓글을 남겨보세요</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar src={comment.profileImageUrl} size="sm" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{comment.nickname}</span>
                  <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
                </div>
                {user?.nickname === comment.nickname && editingId !== comment.id && (
                  <div className="relative" ref={openMenuId === comment.id ? menuRef : undefined}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <EllipsisVerticalIcon />
                    </button>
                    {openMenuId === comment.id && (
                      <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-20">
                        <button
                          onClick={() => { setOpenMenuId(null); setEditingId(comment.id); setEditText(comment.content); }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => { setOpenMenuId(null); handleDelete(comment.id); }}
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
                    maxLength={500}
                    className="flex-1 px-3 py-1 rounded border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <Button size="sm" onClick={() => handleEdit(comment.id)}>저장</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{comment.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
