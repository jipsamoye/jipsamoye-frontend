'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, PetPostListItem, PageResponse, PresignedUrlResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import PostCard from '@/components/domain/PostCard';
import CoverImageEditor from '@/components/domain/CoverImageEditor';
import ProfileEditModal from '@/components/domain/ProfileEditModal';
import { ALLOWED_IMAGE_EXTS, POST_CONFIG } from '@/lib/constants';
import { compressImage } from '@/lib/imageCompress';

export default function ProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const decodedNickname = decodeURIComponent(nickname);
  const router = useRouter();
  const { user, updateUser } = useAuthContext();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 프로필 편집 모달
  const [showEditModal, setShowEditModal] = useState(false);

  // 커버 이미지 편집 모달
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);

  // 커버 풀너비 계산
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [coverStyle, setCoverStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const calcCover = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sidebarWidth = window.innerWidth >= 1024 ? 208 : 0;
      const leftOffset = rect.left - sidebarWidth;
      const rightOffset = window.innerWidth - rect.right;
      setCoverStyle({
        marginLeft: -leftOffset,
        marginRight: -rightOffset,
      });
    };
    calcCover();
    window.addEventListener('resize', calcCover);
    return () => window.removeEventListener('resize', calcCover);
  }, [loading]);

  // 이미지 업로드
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [coverFileForEditor, setCoverFileForEditor] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<User>(`/api/users/${decodedNickname}`)
      .then((res) => setProfile(res.data))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));

    api.get<PageResponse<PetPostListItem>>(`/api/users/${decodedNickname}/posts?page=0&size=20`)
      .then((res) => setPosts(res.data.content))
      .catch(() => {});
  }, [decodedNickname, router]);

  const handleFollow = async () => {
    if (!user) return;
    try {
      const res = await api.post<boolean>(`/api/users/${decodedNickname}/follow?userId=${user.id}`);
      setIsFollowing(res.data);
      setProfile((prev) => prev ? {
        ...prev,
        followerCount: prev.followerCount + (res.data ? 1 : -1)
      } : prev);
    } catch { /* ignore */ }
  };

  const uploadImage = async (file: File, dirName: string, preset: 'profile' | 'cover'): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) return null;
    if (file.size > POST_CONFIG.MAX_IMAGE_SIZE) return null;

    try {
      const compressed = await compressImage(file, preset);
      const res = await api.post<PresignedUrlResponse>(`/api/images/presigned-url?userId=${user.id}`, { dirName, ext: 'webp' });
      await fetch(res.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: compressed,
      });
      return res.data.imageUrl;
    } catch {
      return null;
    }
  };

  const handleCoverSave = async (blob: Blob) => {
    if (!user) return;
    setCoverSaving(true);
    const file = new File([blob], 'cover.webp', { type: 'image/webp' });
    const imageUrl = await uploadImage(file, 'covers', 'cover');
    if (!imageUrl) {
      setCoverSaving(false);
      return;
    }
    try {
      const res = await api.patch<User>(`/api/users/me?userId=${user.id}`, { coverImageUrl: imageUrl });
      setProfile(res.data);
      updateUser(res.data);
      setShowCoverEditor(false);
    } catch { /* ignore */ }
    setCoverSaving(false);
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    const imageUrl = await uploadImage(file, 'profiles', 'profile');
    if (!imageUrl) return;
    try {
      const res = await api.patch<User>(`/api/users/me?userId=${user.id}`, { profileImageUrl: imageUrl });
      setProfile(res.data);
      updateUser(res.data);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  if (!profile) return <div className="flex justify-center py-20 text-gray-400">유저를 찾을 수 없어요</div>;

  const isMe = user?.id === profile.id;

  return (
    <div ref={wrapperRef}>
      {/* 커버 */}
      <div
        className={`relative overflow-hidden -mt-6 ${profile.coverImageUrl ? 'h-80' : 'h-48'}`}
        style={coverStyle}
      >
        {profile.coverImageUrl ? (
          <img src={profile.coverImageUrl} alt="커버" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700" />
        )}
        {isMe && (
          <>
            <button
              onClick={() => coverFileInputRef.current?.click()}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-black/50 text-white rounded-lg text-sm hover:bg-black/70 transition-colors"
            >
              <span>+</span> 커버 추가하기
            </button>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCoverFileForEditor(URL.createObjectURL(file));
                  setShowCoverEditor(true);
                }
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {/* 프로필 정보 */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-6">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <Avatar src={profile.profileImageUrl} size="xl" />
            {isMe && (
              <>
                <button
                  onClick={() => profileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
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
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profile.nickname}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>팔로워 <strong className="text-gray-900 dark:text-white">{profile.followerCount}</strong></span>
              <span>팔로잉 <strong className="text-gray-900 dark:text-white">{profile.followingCount}</strong></span>
            </div>
            {/* 소셜 링크 */}
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex items-center gap-3 mt-2">
                {profile.socialLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {link.type === 'INSTAGRAM' && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    )}
                    {link.type === 'YOUTUBE' && (
                      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    )}
                    <span>{link.type === 'INSTAGRAM' ? '인스타그램' : '유튜브'}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMe ? (
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>프로필 편집</Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? 'outline' : 'primary'}
                  size="sm"
                  onClick={handleFollow}
                >
                  {isFollowing ? '팔로잉' : '팔로우'}
                </Button>
                <button
                  onClick={async () => {
                    if (!user || !profile) return;
                    try {
                      await api.post(`/api/dm/rooms?userId=${user.id}&targetUserId=${profile.id}`);
                    } catch { /* ignore */ }
                    router.push('/dm');
                  }}
                  className="p-2 rounded-xl border border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                  title="메시지"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 ml-28">{profile.bio}</p>
        )}
      </div>

      {/* 게시글 목록 */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium">게시글</span>
          <span className="text-sm text-gray-400">{profile.postCount}</span>
        </div>
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

      {/* 커버 이미지 편집 모달 */}
      <CoverImageEditor
        isOpen={showCoverEditor}
        onClose={() => { setShowCoverEditor(false); setCoverFileForEditor(null); }}
        onSave={handleCoverSave}
        saving={coverSaving}
        initialImage={coverFileForEditor}
      />

      {/* 프로필 편집 모달 */}
      {profile && user && (
        <ProfileEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          profile={profile}
          userId={user.id}
          onSaved={(updatedProfile) => { setProfile(updatedProfile); updateUser(updatedProfile); }}
        />
      )}
    </div>
  );
}
