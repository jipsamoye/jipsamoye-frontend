'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import PostEditor from '@/components/domain/PostEditor';

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();

  const [postData, setPostData] = useState<{ title: string; content: string; imageUrls: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PetPost>(`/api/posts/${id}`)
      .then((res) => {
        if (user && res.data.nickname !== user.nickname) {
          router.push(`/posts/${id}`);
          return;
        }
        setPostData({
          title: res.data.title,
          content: res.data.content,
          imageUrls: res.data.imageUrls,
        });
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, user, router]);

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  if (!postData) {
    return null;
  }

  return (
    <PostEditor
      mode="edit"
      postId={id}
      initialTitle={postData.title}
      initialContent={postData.content}
      initialImageUrls={postData.imageUrls}
    />
  );
}
