'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, PetPostListItem, PageResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import PostCard from '@/components/domain/PostCard';

export default function ProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const decodedNickname = decodeURIComponent(nickname);
  const router = useRouter();
  const { user } = useAuthContext();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<PetPostListItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-20 text-gray-400">로딩 중...</div>;
  if (!profile) return <div className="flex justify-center py-20 text-gray-400">유저를 찾을 수 없습니다.</div>;

  const isMe = user?.id === profile.id;

  return (
    <div>
      {/* 커버 */}
      <div className="h-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 rounded-xl mb-[-3rem]" />

      {/* 프로필 정보 */}
      <div className="relative px-6 mb-8">
        <div className="flex items-end gap-4">
          <div className="-mt-8">
            <Avatar src={profile.profileImageUrl} size="xl" />
          </div>
          <div className="flex-1 pb-2">
            <h1 className="text-xl font-bold">{profile.nickname}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>팔로워 <strong className="text-gray-900 dark:text-white">{profile.followerCount}</strong></span>
              <span>팔로잉 <strong className="text-gray-900 dark:text-white">{profile.followingCount}</strong></span>
            </div>
          </div>
          <div className="pb-2">
            {isMe ? (
              <Button variant="outline" size="sm">프로필 편집</Button>
            ) : (
              <Button
                variant={isFollowing ? 'outline' : 'primary'}
                size="sm"
                onClick={handleFollow}
              >
                {isFollowing ? '팔로잉' : '팔로우'}
              </Button>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">{profile.bio}</p>
        )}
      </div>

      {/* 게시글 목록 */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
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
    </div>
  );
}
