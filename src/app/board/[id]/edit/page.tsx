'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { BoardPost } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import BoardForm from '@/components/domain/BoardForm';

export default function EditBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [post, setPost] = useState<BoardPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    api.get<BoardPost>(`/api/boards/${id}`)
      .then((res) => {
        if (user && res.data.nickname !== user.nickname) {
          router.replace(`/board/${id}`);
          return;
        }
        setPost(res.data);
      })
      .catch(() => router.replace('/board'))
      .finally(() => setLoading(false));
  }, [id, user, authLoading, router]);

  if (loading || !post) {
    return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  return (
    <BoardForm
      mode="edit"
      boardId={post.id}
      initialCategory={post.category}
      initialTitle={post.title}
      initialContent={post.content}
    />
  );
}
