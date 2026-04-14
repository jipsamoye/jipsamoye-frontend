'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PetPostListItem, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import Modal from '@/components/common/Modal';
import PostCard from '@/components/domain/PostCard';
import CommentSection from '@/components/domain/CommentSection';
import { HeartIcon, ShareIcon, EllipsisHorizontalIcon, LinkIcon } from '@/components/layout/icons';
import { showToast } from '@/components/common/Toast';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();
  const [post, setPost] = useState<PetPost | null>(null);
  const [authorPosts, setAuthorPosts] = useState<PetPostListItem[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PetPost>(`/api/posts/${id}`)
      .then((res) => {
        setPost(res.data);
        api.get<PageResponse<PetPostListItem>>(`/api/users/${res.data.nickname}/posts?page=0&size=4`)
          .then((r) => setAuthorPosts(r.data.content.filter((p) => p.id !== Number(id))));
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) setShowPostMenu(false);
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setShowActionMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await api.post<boolean>(`/api/posts/${id}/like?userId=${user.id}`);
      setLiked(res.data);
      setPost((prev) => prev ? { ...prev, likeCount: prev.likeCount + (res.data ? 1 : -1) } : prev);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!user || !post) return;
    try {
      await api.delete(`/api/posts/${id}?userId=${user.id}`);
      router.push('/');
    } catch { /* ignore */ }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('링크가 복사됐어요!');
      setShowShareModal(false);
    } catch {
      showToast('링크 복사에 실패했어요.');
    }
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  if (!post) return <div className="flex justify-center py-20 text-gray-400">게시글을 찾을 수 없어요</div>;

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            title="공유"
          >
            <ShareIcon />
          </button>
          <div className="relative" ref={postMenuRef}>
            <button
              onClick={() => setShowPostMenu(!showPostMenu)}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            >
              <EllipsisHorizontalIcon />
            </button>
            {showPostMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-50">
                <button
                  onClick={() => { setShowPostMenu(false); setShowShareModal(true); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LinkIcon />
                  공유하기
                </button>
                {!isAuthor && user && (
                  <button
                    onClick={async () => {
                      setShowPostMenu(false);
                      try {
                        await api.post(`/api/dm/rooms?userId=${user.id}&targetUserId=${post.userId}`);
                      } catch { /* ignore */ }
                      router.push('/dm');
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                    메시지 보내기
                  </button>
                )}
                {isAuthor && (
                  <>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    <button
                      onClick={() => { setShowPostMenu(false); router.push(`/posts/${id}/edit`); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => { setShowPostMenu(false); handleDelete(); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 이미지 (세로 나열) */}
      <div className="flex flex-col gap-2 mb-6">
        {post.imageUrls.map((url, i) => (
          <img key={i} src={url} alt={`${post.title} ${i + 1}`} className="w-full rounded-2xl object-cover" />
        ))}
      </div>

      {/* 제목 + 내용 */}
      <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-6">{post.content}</p>

      {/* 좋아요 + ··· 액션 박스 */}
      <div className="flex items-center gap-2 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all duration-200 ${
            liked
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-500'
              : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800'
          }`}
        >
          <HeartIcon filled={liked} />
          <span className="text-sm font-medium">{post.likeCount}</span>
        </button>
        <div className="relative" ref={actionMenuRef}>
          <button
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="flex items-center px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
          >
            <EllipsisHorizontalIcon />
          </button>
          {showActionMenu && (
            <div className="absolute left-0 bottom-full mb-1 w-40 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-50">
              <button
                onClick={() => { setShowActionMenu(false); handleCopyLink(); }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <LinkIcon />
                링크 복사하기
              </button>
              {!isAuthor && user && (
                <button
                  onClick={async () => {
                    setShowActionMenu(false);
                    try {
                      await api.post(`/api/dm/rooms?userId=${user.id}&targetUserId=${post.userId}`);
                    } catch { /* ignore */ }
                    router.push('/dm');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  메시지 보내기
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 댓글 섹션 */}
      <CommentSection postId={id} user={user} />

      {/* 작성자의 다른 게시글 */}
      {authorPosts.length > 0 && (
        <section className="border-t border-gray-100 dark:border-gray-800 pt-8">
          <h3 className="text-lg font-bold mb-4">{post.nickname}님의 다른 게시글</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {authorPosts.slice(0, 4).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* 공유 모달 */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="공유">
        <div className="flex flex-col items-center gap-5 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            집사모여의 게시글을 공유해보세요!
          </p>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-white font-medium rounded-2xl transition-all duration-200 w-full justify-center"
          >
            <LinkIcon />
            링크 복사하기
          </button>
        </div>
      </Modal>
    </div>
  );
}
