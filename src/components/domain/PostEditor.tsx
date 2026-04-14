'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PresignedUrlResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useFormGuard } from '@/hooks/useFormGuard';
import Button from '@/components/common/Button';
import { showToast } from '@/components/common/Toast';
import { POST_CONFIG, ALLOWED_IMAGE_EXTS } from '@/lib/constants';

const { TITLE_MAX, CONTENT_MAX, MAX_IMAGES, MAX_IMAGE_SIZE } = POST_CONFIG;

function charCountColor(len: number, max: number) {
  if (len >= max) return 'text-red-500';
  if (len >= max * 0.8) return 'text-amber-500';
  return 'text-gray-400';
}

const EMPTY_ARRAY: string[] = [];

interface PostEditorProps {
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialContent?: string;
  initialImageUrls?: string[];
  postId?: string;
}

export default function PostEditor({
  mode,
  initialTitle = '',
  initialContent = '',
  initialImageUrls = EMPTY_ARRAY,
  postId,
}: PostEditorProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { setBlocked } = useNavigationGuard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleToastShown = useRef(false);
  const contentToastShown = useRef(false);

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [titleFocused, setTitleFocused] = useState(false);
  const [contentFocused, setContentFocused] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(initialImageUrls);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const originalData = useRef({ title: initialTitle, content: initialContent, imageUrls: initialImageUrls });

  // Update originalData when initial values change (edit mode data fetch)
  useEffect(() => {
    originalData.current = { title: initialTitle, content: initialContent, imageUrls: initialImageUrls };
    setTitle(initialTitle);
    setContent(initialContent);
    setImageUrls(initialImageUrls);
  }, [initialTitle, initialContent, initialImageUrls]);

  const isDirty = mode === 'create'
    ? title.trim() !== '' || content.trim() !== '' || imageUrls.length > 0
    : title !== originalData.current.title ||
      content !== originalData.current.content ||
      JSON.stringify(imageUrls) !== JSON.stringify(originalData.current.imageUrls);

  const guardMessage = mode === 'create' ? '작성을 취소하고 나가시겠어요?' : '수정을 취소하고 나가시겠어요?';

  useFormGuard(isDirty, guardMessage);

  const handleImageUpload = async (files: FileList) => {
    if (!user) return;
    if (imageUrls.length + files.length > MAX_IMAGES) {
      showToast(`이미지는 최대 ${MAX_IMAGES}장까지 올릴 수 있어요`);
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      if (!ALLOWED_IMAGE_EXTS.includes(ext)) continue;
      if (file.size > MAX_IMAGE_SIZE) continue;

      try {
        const res = await api.post<PresignedUrlResponse>(`/api/images/presigned-url?userId=${user.id}`, {
          dirName: 'posts',
          ext,
        });

        await fetch(res.data.presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        newUrls.push(res.data.imageUrl);
      } catch {
        // ignore
      }
    }

    setImageUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !title.trim() || imageUrls.length === 0) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await api.post<PetPost>(`/api/posts?userId=${user.id}`, {
          title,
          content,
          imageUrls,
        });
        setBlocked(false);
        router.push(`/posts/${res.data.id}`);
      } else {
        await api.patch<PetPost>(`/api/posts/${postId}?userId=${user.id}`, {
          title,
          content,
          imageUrls,
        });
        setBlocked(false);
        router.push(`/posts/${postId}`);
      }
    } catch {
      showToast(mode === 'create' ? '게시글 작성에 실패했어요' : '게시글 수정에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center py-20 text-gray-400">로그인이 필요해요</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 이미지 업로드 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400 transition-all duration-200 mb-6"
      >
        <div className="text-4xl mb-2">+</div>
        <p className="text-sm text-gray-500">JPG / PNG / WEBP</p>
        <p className="text-xs text-gray-400">1장 당 10MB 이내 · 최대 5장</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
        />
      </div>

      {uploading && <p className="text-sm text-amber-500 mb-4">이미지 업로드 중...</p>}

      {/* 업로드된 이미지 미리보기 */}
      {imageUrls.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-6 pb-2">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden">
              <img src={url} alt={`미리보기 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 제목 */}
      <div className="relative mb-4">
        <input
          value={title}
          onChange={(e) => {
            const v = e.target.value.slice(0, TITLE_MAX);
            if (v.length >= TITLE_MAX && !titleToastShown.current) {
              showToast('제목은 30자까지 입력할 수 있어요!');
              titleToastShown.current = true;
            }
            setTitle(v);
          }}
          placeholder="제목을 입력해 주세요"
          maxLength={TITLE_MAX}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          className="w-full text-2xl font-bold pb-4 border-b border-gray-100 dark:border-gray-800 bg-transparent focus:outline-none placeholder-gray-300 dark:placeholder-gray-600 pr-16"
        />
        {titleFocused && (
          <span className={`absolute right-0 bottom-5 text-xs ${charCountColor(title.length, TITLE_MAX)}`}>
            {title.length}/{TITLE_MAX}
          </span>
        )}
      </div>

      {/* 내용 */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => {
            const v = e.target.value.slice(0, CONTENT_MAX);
            if (v.length >= CONTENT_MAX && !contentToastShown.current) {
              showToast('내용은 500자까지 입력할 수 있어요!');
              contentToastShown.current = true;
            }
            setContent(v);
          }}
          placeholder={mode === 'create' ? '내용은 선택이에요! 이미지와 제목만으로도 충분해요 🐾' : '내용을 입력해 주세요'}
          maxLength={CONTENT_MAX}
          rows={12}
          onFocus={() => setContentFocused(true)}
          onBlur={() => setContentFocused(false)}
          className="w-full bg-transparent resize-none focus:outline-none text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600"
        />
        {contentFocused && (
          <div className={`text-right text-xs -mt-2 mb-2 ${charCountColor(content.length, CONTENT_MAX)}`}>
            {content.length}/{CONTENT_MAX}
          </div>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800 mb-8" />

      {/* 버튼 */}
      {mode === 'create' ? (
        <div className="flex flex-col items-end gap-2">
          {title.trim() && imageUrls.length > 0 && !content.trim() && (
            <span className="text-xs text-gray-400">이대로 작성할 수 있어요! 🐾</span>
          )}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || imageUrls.length === 0}
          >
            {submitting ? '작성 중...' : '작성하기'}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => { setBlocked(false); router.push(`/posts/${postId}`); }}
          >
            취소
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || imageUrls.length === 0}
          >
            {submitting ? '수정 중...' : '수정하기'}
          </Button>
        </div>
      )}
    </div>
  );
}
