'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import { api } from '@/lib/api';
import { BoardPost } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import { HeartIcon, EyeIcon, EllipsisHorizontalIcon } from '@/components/layout/icons';
import { timeAgo } from '@/lib/utils';
import BoardCommentSection from '@/components/domain/BoardCommentSection';
import { showToast } from '@/components/common/Toast';

const CATEGORY_LABEL = { GENERAL: '일반', QUESTION: '질문' } as const;
const CATEGORY_STYLE = {
  GENERAL: 'bg-gray-100 text-gray-600',
  QUESTION: 'bg-amber-50 text-amber-600',
} as const;

export default function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();
  const [post, setPost] = useState<BoardPost | null>(null);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<BoardPost>(`/api/boards/${id}`)
      .then((res) => setPost(res.data))
      .catch(() => router.replace('/board'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLike = async () => {
    if (!user || !post) return;
    try {
      const res = await api.post<boolean>(`/api/boards/${post.id}/like`);
      setLiked(res.data);
      setPost((prev) => prev ? { ...prev, likeCount: prev.likeCount + (res.data ? 1 : -1) } : prev);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    try {
      await api.delete(`/api/boards/${post.id}`);
      showToast('삭제됐어요');
      router.push('/board');
    } catch {
      showToast('삭제에 실패했어요');
    }
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  if (!post) return <div className="flex justify-center py-20 text-gray-400">글을 찾을 수 없어요</div>;

  const isAuthor = user?.nickname === post.nickname;
  const sanitized = typeof window !== 'undefined' ? DOMPurify.sanitize(post.content) : post.content;

  return (
    <article className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center justify-center w-14 h-7 rounded-full text-xs font-semibold ${CATEGORY_STYLE[post.category]}`}>
          {CATEGORY_LABEL[post.category]}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4 break-words">{post.title}</h1>

      <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Avatar src={post.profileImageUrl} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{post.nickname}</p>
            <p className="text-xs text-gray-400">
              {timeAgo(post.createdAt)} · 조회 {post.viewCount}
            </p>
          </div>
        </div>
        {isAuthor && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <EllipsisHorizontalIcon />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-20">
                <button
                  onClick={() => { setShowMenu(false); router.push(`/board/${post.id}/edit`); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  onClick={() => { setShowMenu(false); handleDelete(); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-50"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="prose prose-sm max-w-none mb-8 break-words [&_img]:rounded-xl [&_a]:text-amber-500"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />

      <div className="flex items-center justify-center pb-8 border-b border-gray-100">
        <button
          onClick={handleLike}
          disabled={!user}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-colors
            ${liked
              ? 'border-amber-300 bg-amber-50 text-amber-600'
              : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-500'
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <HeartIcon filled={liked} />
          <span className="text-sm font-medium">{post.likeCount}</span>
        </button>
        <span className="mx-4 flex items-center gap-1.5 text-sm text-gray-400">
          <EyeIcon />
          {post.viewCount}
        </span>
      </div>

      <BoardCommentSection boardId={post.id} user={user} />
    </article>
  );
}
