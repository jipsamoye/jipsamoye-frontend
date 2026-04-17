'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PresignedUrlResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useFormGuard } from '@/hooks/useFormGuard';
import Button from '@/components/common/Button';
import { showToast } from '@/components/common/Toast';
import { POST_CONFIG, ALLOWED_IMAGE_EXTS } from '@/lib/constants';
import { compressImage } from '@/lib/imageCompress';

const { TITLE_MAX, CONTENT_MAX, MAX_IMAGES, MAX_IMAGE_SIZE } = POST_CONFIG;

const TITLE_PRESETS = ['사진 공유해요', '우리 아이 자랑', '오늘의 산책', '귀여운 순간', '오늘의 멍냥'];

function charCountColor(len: number, max: number) {
  if (len >= max) return 'text-red-500';
  if (len >= max * 0.8) return 'text-amber-500';
  return 'text-gray-400';
}

const EMPTY_ARRAY: string[] = [];

interface ImageItem {
  id: string;
  localUrl: string;
  serverUrl: string | null;
  status: 'uploading' | 'done' | 'error';
}

interface PostEditorProps {
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialContent?: string;
  initialImageUrls?: string[];
  postId?: string;
}

let imageIdCounter = 0;

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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const originalData = useRef({ title: initialTitle, content: initialContent, imageUrls: initialImageUrls });

  // 수정 모드: 기존 이미지 URL을 ImageItem으로 변환
  useEffect(() => {
    originalData.current = { title: initialTitle, content: initialContent, imageUrls: initialImageUrls };
    setTitle(initialTitle);
    setContent(initialContent);
    if (initialImageUrls.length > 0) {
      setImages(initialImageUrls.map((url) => ({
        id: `init-${imageIdCounter++}`,
        localUrl: url,
        serverUrl: url,
        status: 'done' as const,
      })));
    }
  }, [initialTitle, initialContent, initialImageUrls]);

  // 메모리 정리: 로컬 URL 해제
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.localUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.localUrl);
        }
      });
    };
  }, []);

  const completedServerUrls = images.filter((i) => i.status === 'done' && i.serverUrl).map((i) => i.serverUrl!);
  const isUploading = images.some((i) => i.status === 'uploading');

  const isDirty = mode === 'create'
    ? title.trim() !== '' || content.trim() !== '' || images.length > 0
    : title !== originalData.current.title ||
      content !== originalData.current.content ||
      JSON.stringify(completedServerUrls) !== JSON.stringify(originalData.current.imageUrls);

  const guardMessage = mode === 'create' ? '작성을 취소하고 나가시겠어요?' : '수정을 취소하고 나가시겠어요?';

  useFormGuard(isDirty, guardMessage);

  const uploadSingleImage = useCallback(async (file: File, itemId: string) => {
    if (!user) return;

    try {
      const [compressed, res] = await Promise.all([
        compressImage(file, 'post'),
        api.post<PresignedUrlResponse>(`/api/images/presigned-url`, {
          dirName: 'posts',
          ext: 'webp',
        }),
      ]);

      await fetch(res.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: compressed,
      });

      setImages((prev) =>
        prev.map((img) => img.id === itemId ? { ...img, serverUrl: res.data.imageUrl, status: 'done' as const } : img)
      );
    } catch {
      setImages((prev) =>
        prev.map((img) => img.id === itemId ? { ...img, status: 'error' as const } : img)
      );
    }
  }, [user]);

  const createThumbnailUrl = async (file: File): Promise<string> => {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 192,
      resizeHeight: 192,
      resizeQuality: 'low',
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.5 });
    return URL.createObjectURL(blob);
  };

  const handleImageUpload = async (files: FileList) => {
    if (!user) return;
    const totalCount = images.length + files.length;
    if (totalCount > MAX_IMAGES) {
      showToast(`이미지는 최대 ${MAX_IMAGES}장까지 올릴 수 있어요`);
      return;
    }

    const validFiles: { file: File; itemId: string }[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      if (!ALLOWED_IMAGE_EXTS.includes(ext)) continue;
      if (file.size > MAX_IMAGE_SIZE) continue;
      validFiles.push({ file, itemId: `img-${imageIdCounter++}` });
    }

    // 모든 썸네일을 동시에 생성 (~15ms)
    const thumbnails = await Promise.all(
      validFiles.map(async ({ file, itemId }) => ({
        id: itemId,
        localUrl: await createThumbnailUrl(file),
        serverUrl: null as string | null,
        status: 'uploading' as const,
      }))
    );

    setImages((prev) => [...prev, ...thumbnails]);

    // 백그라운드로 압축+업로드 시작
    validFiles.forEach(({ file, itemId }) => uploadSingleImage(file, itemId));
  };

  const retryUpload = (itemId: string, file?: File) => {
    if (!file) return;
    setImages((prev) =>
      prev.map((img) => img.id === itemId ? { ...img, status: 'uploading' as const } : img)
    );
    uploadSingleImage(file, itemId);
  };

  const removeImage = (itemId: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === itemId);
      if (target?.localUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.localUrl);
      }
      return prev.filter((img) => img.id !== itemId);
    });
  };

  const handleSubmit = async () => {
    if (!user || !title.trim() || completedServerUrls.length === 0) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await api.post<PetPost>(`/api/posts`, {
          title,
          content,
          imageUrls: completedServerUrls,
        });
        setBlocked(false);
        router.push(`/posts/${res.data.id}`);
      } else {
        await api.patch<PetPost>(`/api/posts/${postId}`, {
          title,
          content,
          imageUrls: completedServerUrls,
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

      {/* 이미지 미리보기 + 상태 표시 */}
      {images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-6 pb-2">
          {images.map((img) => (
            <div key={img.id} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden">
              <img src={img.localUrl} alt="미리보기" className="w-full h-full object-cover" />

              {/* 업로드 중: 오버레이 + 스피너 */}
              {img.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* 에러: 오버레이 + 재시도 */}
              {img.status === 'error' && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <span className="text-white text-xs font-medium">실패</span>
                </div>
              )}

              {/* 삭제 버튼 (업로드 중이 아닐 때만) */}
              {img.status !== 'uploading' && (
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                >
                  ✕
                </button>
              )}
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

      {/* 빠른 제목 프리셋 */}
      {mode === 'create' && !title && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {TITLE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setTitle(preset)}
              className="px-3 py-1.5 text-xs rounded-full border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 dark:hover:bg-amber-950/20 dark:hover:border-amber-800 dark:hover:text-amber-400 transition-all duration-200"
            >
              {preset}
            </button>
          ))}
        </div>
      )}

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
          {title.trim() && completedServerUrls.length > 0 && !content.trim() && (
            <span className="text-xs text-gray-400">이대로 작성할 수 있어요! 🐾</span>
          )}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || isUploading || !title.trim() || completedServerUrls.length === 0}
          >
            {submitting ? '작성 중...' : isUploading ? '이미지 업로드 중...' : '작성하기'}
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
            disabled={submitting || isUploading || !title.trim() || completedServerUrls.length === 0}
          >
            {submitting ? '수정 중...' : isUploading ? '이미지 업로드 중...' : '수정하기'}
          </Button>
        </div>
      )}
    </div>
  );
}
