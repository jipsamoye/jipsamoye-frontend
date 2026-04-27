'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PetPostListItem, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import DetailImage from '@/components/common/DetailImage';
import Modal from '@/components/common/Modal';
import PostCard from '@/components/domain/PostCard';
import CommentSection from '@/components/domain/CommentSection';
import { HeartIcon, ShareIcon, LinkIcon } from '@/components/layout/icons';
import { showToast } from '@/components/common/Toast';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();
  const [post, setPost] = useState<PetPost | null>(null);
  const [authorPosts, setAuthorPosts] = useState<PetPostListItem[]>([]);
  const [liked, setLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PetPost>(`/api/posts/${id}`)
      .then((res) => {
        setPost(res.data);
        setCommentCount(res.data.commentCount ?? 0);
        api.get<PageResponse<PetPostListItem>>(`/api/users/${res.data.nickname}/posts?page=0&size=4`)
          .then((r) => setAuthorPosts(r.data.content.filter((p) => p.id !== Number(id))));
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) setShowPostMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await api.post<boolean>(`/api/posts/${id}/like`);
      setLiked(res.data);
      setPost((prev) => prev ? { ...prev, likeCount: prev.likeCount + (res.data ? 1 : -1) } : prev);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!user || !post) return;
    try {
      await api.delete(`/api/posts/${id}`);
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

  const isAuthor = user?.nickname === post.nickname;

  return (
    <div className="max-w-3xl mx-auto">

      {/* 브레드크럼 */}
      <div className="flex items-center gap-1 text-sm mb-3">
        <button
          onClick={() => router.push('/')}
          className="text-amber-500 hover:text-amber-600 font-medium transition-colors"
        >
          최신 자랑
        </button>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-amber-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      {/* 제목 */}
      <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-4">{post.title}</h1>

      {/* 메타 줄: 작성자(좌) + 통계·메뉴(우) + 구분선 */}
      <div className="flex items-center justify-between pb-5 mb-6 border-b border-gray-200">

        {/* 좌: 아바타 + 닉네임 + 날짜 */}
        <button
          type="button"
          onClick={() => router.push(`/users/${encodeURIComponent(post.nickname)}`)}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <Avatar src={post.profileImageUrl} size="sm" />
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{post.nickname}</p>
            <p className="text-xs text-gray-400">
              {new Date(post.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </button>

        {/* 우: ❤ · 💬 + 메뉴 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 mr-1">
            <span className="flex items-center gap-1 text-amber-500 font-medium tabular-nums">
              ❤ {post.likeCount}
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1 tabular-nums">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              {commentCount}
            </span>
          </div>

          {/* 메뉴 (수정/삭제 or 메시지) */}
          {user && (
            <div className="relative" ref={postMenuRef}>
              <button
                onClick={() => setShowPostMenu(!showPostMenu)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
              </button>
              {showPostMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 z-50">
                  {!isAuthor && (
                    <button
                      onClick={async () => {
                        setShowPostMenu(false);
                        try {
                          await api.post(`/api/dm/rooms?targetNickname=${encodeURIComponent(post.nickname)}`);
                        } catch { /* ignore */ }
                        router.push('/dm');
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      메시지 보내기
                    </button>
                  )}
                  {isAuthor && (
                    <>
                      <button
                        onClick={() => { setShowPostMenu(false); router.push(`/posts/${id}/edit`); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => { setShowPostMenu(false); handleDelete(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-gray-50"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 이미지 (세로 나열) */}
      <div className="flex flex-col gap-2 mb-6">
        {post.imageUrls.map((url, i) => (
          <DetailImage
            key={i}
            src={url}
            alt={`${post.title} ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="w-full rounded-2xl object-cover"
          />
        ))}
      </div>

      {/* 본문 */}
      <p className="text-gray-700 whitespace-pre-wrap mb-8">{post.content}</p>

      {/* 하단 큰 버튼: 공유하기 + 좋아요 */}
      <div className="flex gap-3 mb-10">
        <button
          onClick={() => setShowShareModal(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-gray-300 text-gray-700 font-semibold text-base hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
        >
          <ShareIcon />
          공유하기
        </button>
        <button
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-base transition-all duration-200 ${
            liked
              ? 'bg-amber-600 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          <HeartIcon filled={liked} />
          좋아요 <span className="tabular-nums">{post.likeCount}</span>
        </button>
      </div>

      {/* 댓글 섹션 */}
      <CommentSection
        postId={id}
        user={user}
        onCountChange={(delta) => setCommentCount((prev) => prev + delta)}
      />

      {/* 작성자의 다른 게시글 */}
      {authorPosts.length > 0 && (
        <section className="border-t border-gray-100 pt-8">
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
          <p className="text-sm text-gray-600 text-center">
            집사모여의 게시글을 공유해보세요!
          </p>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-white font-medium rounded-xl transition-all duration-200 w-full justify-center"
          >
            <LinkIcon />
            링크 복사하기
          </button>
        </div>
      </Modal>
    </div>
  );
}
