'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, PetPostListItem, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useOpenDm } from '@/hooks/useOpenDm';
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import Avatar from '@/components/common/Avatar';
import PostCard from '@/components/domain/PostCard';
import ProfileEditModal from '@/components/domain/ProfileEditModal';
import { showLoginRequiredToast, showToast } from '@/components/common/Toast';

export default function ProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const decodedNickname = decodeURIComponent(nickname);
  const router = useRouter();
  const openDm = useOpenDm();
  const { user, updateUser } = useAuthContext();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<User>(`/api/users/${decodedNickname}`)
      .then((res) => {
        setProfile(res.data);
        setIsFollowing(res.data.isFollowing ?? false);
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));

    api.get<PageResponse<PetPostListItem>>(`/api/users/${decodedNickname}/posts?page=0&size=20`)
      .then((res) => setPosts(res.data.content))
      .catch(() => {});
  }, [decodedNickname, router]);

  const handleFollow = async () => {
    if (!user) {
      showLoginRequiredToast('follow');
      return;
    }
    try {
      const res = await api.post<boolean>(`/api/users/${decodedNickname}/follow`);
      setIsFollowing(res.data);
      setProfile((prev) => prev ? {
        ...prev,
        followerCount: prev.followerCount + (res.data ? 1 : -1),
      } : prev);
    } catch { /* ignore */ }
  };

  const { previewUrl, uploading, upload: uploadProfileImage } = useProfileImageUpload();

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file || !user || !profile) return;
    try {
      const updated = await uploadProfileImage(file);
      setProfile(updated);
      updateUser(updated);
    } catch (err) {
      // 검증 실패(확장자·용량)는 훅이 한국어 메시지를 담아 던짐. API 에러는 일반 문구.
      showToast(err instanceof Error ? err.message : '프로필 이미지 변경에 실패했어요');
    }
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  if (!profile) return <div className="flex justify-center py-20 text-gray-400">유저를 찾을 수 없어요</div>;

  const isMe = user?.nickname === profile.nickname;

  return (
    <div>
      {/* 프로필 카드 (시안 mockup-pet-profile.html 적용) */}
      <article className="bg-white border border-amber-200 rounded-3xl p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-7">
          {/* 좌측: 큰 원형 이미지 + 닉네임 */}
          <div className="flex flex-col items-center order-1 md:flex-shrink-0 md:w-44">
            <div className="relative">
              <Avatar src={previewUrl ?? profile.profileImageUrl} size="2xl" />
              {uploading && (
                <div className="absolute inset-0 w-40 h-40 rounded-full bg-black/30 flex items-center justify-center" aria-label="프로필 이미지 업로드 중">
                  <div className="w-8 h-8 rounded-full border-[3px] border-white/40 border-t-white animate-spin" />
                </div>
              )}
              {isMe && (
                <>
                  <button
                    onClick={() => profileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-1 right-1 w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    aria-label="프로필 이미지 변경"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                    </svg>
                  </button>
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProfileImageUpload}
                  />
                </>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900 truncate max-w-full">{profile.nickname}</h1>
          </div>

          {/* 가운데: 자기소개 + 소셜 + 통계 */}
          <div className="flex-1 min-w-0 flex flex-col gap-4 order-3 md:order-2">
            {/* 자기소개 */}
            <div className="bg-gray-50 rounded-2xl px-5 py-4 text-sm text-gray-800 leading-relaxed min-h-[80px] max-h-[200px] overflow-y-auto">
              {profile.bio ? (
                profile.bio.split('\n').map((line, i) => <p key={i}>{line}</p>)
              ) : (
                <p className="text-gray-400">아직 자기소개가 없어요</p>
              )}
            </div>

            {/* 소셜 링크 */}
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {profile.socialLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {link.type === 'INSTAGRAM' ? (
                      <span className="w-4 h-4 rounded bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white text-[8px] font-bold">📷</span>
                    ) : (
                      <span className="w-4 h-4 rounded bg-red-500 flex items-center justify-center text-white text-[8px] font-bold">▶</span>
                    )}
                    <span className="truncate max-w-[160px]">{link.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </a>
                ))}
              </div>
            )}

            {/* 통계 박스 */}
            <div className="rounded-2xl border-2 border-amber-200 bg-white">
              <div className="flex divide-x divide-amber-100">
                <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2.5 py-3 md:py-4 px-1">
                  <span className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">
                    <span className="text-amber-500">❤</span> 받은하트
                  </span>
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-amber-50 text-amber-700 text-xs md:text-sm font-bold tabular-nums whitespace-nowrap">{profile.totalLikeCount.toLocaleString()}개</span>
                </div>
                <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2.5 py-3 md:py-4 px-1">
                  <span className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">
                    <span className="text-amber-500">👥</span> 구독자
                  </span>
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-amber-50 text-amber-700 text-xs md:text-sm font-bold tabular-nums whitespace-nowrap">{profile.followerCount.toLocaleString()}명</span>
                </div>
                <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2.5 py-3 md:py-4 px-1">
                  <span className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">
                    <span className="text-amber-500">🏆</span> 랭킹
                  </span>
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-amber-50 text-amber-700 text-xs md:text-sm font-bold tabular-nums whitespace-nowrap">{profile.ranking !== null ? `${profile.ranking.toLocaleString()}위` : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 액션 버튼 */}
          <div className="flex flex-row md:flex-col gap-2 order-2 md:order-3 md:flex-shrink-0 md:w-32">
            {isMe ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl border-2 border-amber-400 text-amber-600 font-semibold text-sm hover:bg-amber-50 transition-colors"
              >
                프로필 편집
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 ${
                    isFollowing
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'border-2 border-amber-400 text-amber-600 hover:bg-amber-50'
                  }`}
                >
                  {isFollowing ? '구독 중' : '📣 구독하기'}
                </button>
                {/* 메시지 버튼: 본인이 아니면 구독 여부와 무관하게 항상 노출 */}
                <button
                  onClick={() => {
                    if (!user) {
                      showLoginRequiredToast('message');
                      return;
                    }
                    if (!profile) return;
                    // 기존 방이면 roomId로, 없으면 draft 대화로 연다.
                    // 프로필 이미지를 함께 넘겨 draft 대화창 헤더 아바타를 즉시 표시.
                    void openDm(profile.nickname, profile.profileImageUrl);
                  }}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  💬 메시지
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      {/* 게시물 (PostCard 그대로) */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-900 mb-5">
          게시물 <span className="tabular-nums text-amber-600">{profile.postCount.toLocaleString()}</span>
        </h2>
        {posts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">🐾</p>
            <p>아직 게시글이 없어요</p>
          </div>
        )}
      </div>

      {/* 프로필 편집 모달 */}
      {profile && user && (
        <ProfileEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          profile={profile}
          onSaved={(updatedProfile) => { setProfile(updatedProfile); updateUser(updatedProfile); }}
        />
      )}
    </div>
  );
}
