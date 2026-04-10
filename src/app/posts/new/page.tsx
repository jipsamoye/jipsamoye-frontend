'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PetPost, PresignedUrlResponse } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Button from '@/components/common/Button';

export default function NewPostPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (files: FileList) => {
    if (!user) return;
    if (imageUrls.length + files.length > 5) {
      alert('이미지는 최대 5장까지 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;
      if (file.size > 10 * 1024 * 1024) continue;

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
    if (!user || !title.trim() || !content.trim() || imageUrls.length === 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<PetPost>(`/api/posts?userId=${user.id}`, {
        title,
        content,
        imageUrls,
      });
      router.push(`/posts/${res.data.id}`);
    } catch {
      alert('게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center py-20 text-gray-400">로그인이 필요합니다.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 이미지 업로드 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 transition-colors mb-6"
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
            <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
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
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력해주세요"
        maxLength={100}
        className="w-full text-2xl font-bold pb-4 mb-4 border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
      />

      {/* 내용 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용을 입력해주세요."
        maxLength={5000}
        rows={12}
        className="w-full bg-transparent resize-none focus:outline-none text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 mb-8"
      />

      {/* 작성 버튼 */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim() || imageUrls.length === 0}
        >
          {submitting ? '작성 중...' : '작성하기'}
        </Button>
      </div>
    </div>
  );
}
