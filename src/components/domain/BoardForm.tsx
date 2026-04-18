'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { BoardCategory, BoardPost } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useFormGuard } from '@/hooks/useFormGuard';
import { showToast } from '@/components/common/Toast';
import BoardEditor from './BoardEditor';

interface BoardFormProps {
  mode: 'create' | 'edit';
  boardId?: number;
  initialCategory?: BoardCategory;
  initialTitle?: string;
  initialContent?: string;
}

const CATEGORY_OPTIONS: { value: BoardCategory; label: string }[] = [
  { value: 'GENERAL', label: '일반' },
  { value: 'QUESTION', label: '질문' },
];

const TITLE_MAX = 100;

export default function BoardForm({
  mode,
  boardId,
  initialCategory = 'GENERAL',
  initialTitle = '',
  initialContent = '',
}: BoardFormProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { setBlocked } = useNavigationGuard();

  const [category, setCategory] = useState<BoardCategory>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);

  const original = useRef({ category: initialCategory, title: initialTitle, content: initialContent });

  useEffect(() => {
    original.current = { category: initialCategory, title: initialTitle, content: initialContent };
    setCategory(initialCategory);
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialCategory, initialTitle, initialContent]);

  const isDirty =
    mode === 'create'
      ? title.trim() !== '' || !isContentEmpty(content)
      : category !== original.current.category ||
        title !== original.current.title ||
        content !== original.current.content;

  useFormGuard(isDirty, mode === 'create' ? '작성을 취소하고 나가시겠어요?' : '수정을 취소하고 나가시겠어요?');

  const canSubmit = !submitting && title.trim().length > 0 && !isContentEmpty(content);

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await api.post<BoardPost>('/api/boards', { category, title, content });
        setBlocked(false);
        router.push(`/board/${res.data.id}`);
      } else if (boardId) {
        await api.patch<BoardPost>(`/api/boards/${boardId}`, { category, title, content });
        setBlocked(false);
        router.push(`/board/${boardId}`);
      }
    } catch {
      showToast(mode === 'create' ? '작성에 실패했어요' : '수정에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center py-20 text-gray-400">로그인이 필요해요</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-5">글쓰기</h1>

      <div className="flex items-center gap-2 mb-4">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCategory(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${category === opt.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
        placeholder="제목을 입력해주세요"
        className="w-full h-12 px-4 mb-3 rounded-xl border border-gray-200 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
      />

      <BoardEditor value={content} onChange={setContent} />

      <div className="fixed bottom-0 left-0 right-0 lg:left-52 bg-white border-t border-gray-100 px-4 py-3 z-40">
        <div className="max-w-4xl mx-auto flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-8 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '처리 중...' : '작성 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

function isContentEmpty(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length === 0;
}
