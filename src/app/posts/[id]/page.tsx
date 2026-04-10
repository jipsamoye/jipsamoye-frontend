'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PetPostListItem, Comment, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import PostCard from '@/components/domain/PostCard';
import { HeartIcon } from '@/components/layout/icons';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();
  const [post, setPost] = useState<PetPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authorPosts, setAuthorPosts] = useState<PetPostListItem[]>([]);
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    api.get<PetPost>(`/api/posts/${id}`)
      .then((res) => {
        setPost(res.data);
        api.get<PageResponse<PetPostListItem>>(`/api/users/${res.data.nickname}/posts?page=0&size=4`)
          .then((r) => setAuthorPosts(r.data.content.filter((p) => p.id !== Number(id))));
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));

    api.get<PageResponse<Comment>>(`/api/posts/${id}/comments?page=0&size=50`)
      .then((res) => setComments(res.data.content))
      .catch(() => {});
  }, [id, router]);

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await api.post<boolean>(`/api/posts/${id}/like?userId=${user.id}`);
      setLiked(res.data);
      setPost((prev) => prev ? { ...prev, likeCount: prev.likeCount + (res.data ? 1 : -1) } : prev);
    } catch { /* ignore */ }
  };

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    try {
      const res = await api.post<Comment>(`/api/posts/${id}/comments?userId=${user.id}`, { content: commentText });
      setComments((prev) => [res.data, ...prev]);
      setCommentText('');
    } catch { /* ignore */ }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user) return;
    try {
      await api.delete(`/api/comments/${commentId}?userId=${user.id}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* ignore */ }
  };

  const handleEditComment = async (commentId: number) => {
    if (!user || !editText.trim()) return;
    try {
      const res = await api.patch<Comment>(`/api/comments/${commentId}?userId=${user.id}`, { content: editText });
      setComments((prev) => prev.map((c) => c.id === commentId ? res.data : c));
      setEditingId(null);
      setEditText('');
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!user || !post) return;
    try {
      await api.delete(`/api/posts/${id}?userId=${user.id}`);
      router.push('/');
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">로딩 중...</div>;
  if (!post) return <div className="flex justify-center py-20 text-gray-400">게시글을 찾을 수 없습니다.</div>;

  const isAuthor = user?.id === post.userId;

  return (
    <div className="max-w-3xl mx-auto">
      {/* 작성자 정보 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3" onClick={() => router.push(`/users/${post.nickname}`)} role="button">
          <Avatar src={post.profileImageUrl} size="md" />
          <div>
            <p className="font-medium">{post.nickname}</p>
            <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>
        {isAuthor && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/posts/${id}/edit`)}>수정</Button>
            <Button variant="ghost" size="sm" onClick={handleDelete}>삭제</Button>
          </div>
        )}
      </div>

      {/* 이미지 (세로 나열) */}
      <div className="flex flex-col gap-2 mb-6">
        {post.imageUrls.map((url, i) => (
          <img key={i} src={url} alt={`${post.title} ${i + 1}`} className="w-full rounded-xl object-cover" />
        ))}
      </div>

      {/* 제목 + 내용 */}
      <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-6">{post.content}</p>

      {/* 좋아요 */}
      <div className="flex items-center gap-2 mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleLike} className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors">
          <HeartIcon filled={liked} />
          <span className="text-sm">{post.likeCount}</span>
        </button>
      </div>

      {/* 댓글 입력 */}
      {user && (
        <div className="flex gap-3 mb-6">
          <Avatar src={user.profileImageUrl} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder="댓글을 입력하세요"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <Button size="sm" onClick={handleComment}>등록</Button>
          </div>
        </div>
      )}

      {/* 댓글 목록 */}
      <div className="flex flex-col gap-4 mb-12">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar src={comment.profileImageUrl} size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{comment.nickname}</span>
                <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              {editingId === comment.id ? (
                <div className="flex gap-2 mt-1">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none"
                  />
                  <Button size="sm" onClick={() => handleEditComment(comment.id)}>저장</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
              )}
              {user?.id === comment.userId && editingId !== comment.id && (
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setEditingId(comment.id); setEditText(comment.content); }} className="text-xs text-gray-400 hover:text-gray-600">수정</button>
                  <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 작성자의 다른 게시글 */}
      {authorPosts.length > 0 && (
        <section className="border-t border-gray-200 dark:border-gray-800 pt-8">
          <h3 className="text-lg font-bold mb-4">{post.nickname}님의 다른 게시글</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {authorPosts.slice(0, 4).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
