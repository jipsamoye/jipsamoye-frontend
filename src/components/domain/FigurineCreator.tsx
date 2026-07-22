'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useFigurineJob } from '@/hooks/useFigurineJob';
import { uploadPostImage } from '@/lib/uploadImage';
import { showToast } from '@/components/common/Toast';
import DetailImage from '@/components/common/DetailImage';
import { ALLOWED_IMAGE_EXTS, POST_CONFIG } from '@/lib/constants';
import type { ApiResponse } from '@/types/api';

const PRIMARY_BUTTON =
  'w-full px-6 py-3 bg-amber-500 text-white rounded-xl text-base font-medium hover:bg-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const OUTLINE_BUTTON =
  'w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-base font-medium hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

export default function FigurineCreator() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { job, phase, errorMessage, start, publish, reset } = useFigurineJob();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // objectURL 누수 방지
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      showToast('jpg, jpeg, png, webp 이미지만 올릴 수 있어요');
      e.target.value = '';
      return;
    }
    if (selected.size > POST_CONFIG.MAX_IMAGE_SIZE) {
      showToast('10MB 이하 이미지만 올릴 수 있어요');
      e.target.value = '';
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleGenerate = async () => {
    if (!file || uploading) return;
    if (!user) {
      showToast('로그인하고 이용해 주세요');
      return;
    }
    setUploading(true);
    try {
      const sourceImageUrl = await uploadPostImage(file);
      await start(sourceImageUrl);
    } catch (err) {
      // 401은 api 래퍼가 전역 처리(토스트+모달)하므로 중복 안내 금지
      if ((err as ApiResponse<null>)?.status !== 401) {
        showToast('사진 업로드에 실패했어요. 다시 시도해 주세요.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    const petPostId = await publish();
    if (petPostId != null) {
      router.push(`/posts/${petPostId}`);
    }
  };

  const handleRetry = () => {
    reset();
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const busy = uploading || phase === 'creating';

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">AI 키캡 피규어</h1>
      <p className="mt-2 text-sm text-gray-600">
        우리 애 사진을 올리면 아티산 키캡 위 미니 피규어로 만들어 드려요.
      </p>

      {(phase === 'idle' || phase === 'creating') && (
        <section className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="사진 선택"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center w-full aspect-square max-h-96 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors overflow-hidden"
          >
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */
              <img src={previewUrl} alt="선택한 사진 미리보기" className="w-full h-full object-contain" />
            ) : (
              <span>사진을 선택해 주세요</span>
            )}
          </button>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            disabled={!file || busy}
            onClick={handleGenerate}
          >
            {busy ? '요청 중…' : '키캡 피규어 만들기'}
          </button>
        </section>
      )}

      {phase === 'generating' && (
        <section className="flex flex-col items-center mt-10 text-center">
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */
            <img src={previewUrl} alt="원본 사진" className="w-40 h-40 rounded-2xl object-cover opacity-60" />
          )}
          <div
            className="mt-6 w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-base font-medium text-gray-900">키캡 피규어를 만들고 있어요…</p>
          <p className="mt-1 text-sm text-gray-500">
            보통 1분 안에 완성돼요. 이 화면을 벗어나면 진행 상황을 볼 수 없어요.
          </p>
        </section>
      )}

      {(phase === 'completed' || phase === 'posting' || phase === 'posted') && job?.resultImageUrl && (
        <section className="mt-6">
          <DetailImage
            src={job.resultImageUrl}
            alt="완성된 AI 키캡 피규어"
            loading="eager"
            className="w-full rounded-2xl"
          />
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            disabled={phase !== 'completed'}
            onClick={handlePublish}
          >
            {phase === 'posting' ? '게시 중…' : phase === 'posted' ? '게시 완료' : '자랑 피드에 게시하기'}
          </button>
          <button
            type="button"
            className={`${OUTLINE_BUTTON} mt-2`}
            disabled={phase !== 'completed'}
            onClick={handleRetry}
          >
            다른 사진으로 다시 만들기
          </button>
        </section>
      )}

      {phase === 'failed' && (
        <section className="flex flex-col items-center mt-10 text-center">
          <p className="text-base font-medium text-gray-900">앗, 생성에 실패했어요</p>
          <p className="mt-1 text-sm text-gray-500">{errorMessage}</p>
          <button type="button" className={`${PRIMARY_BUTTON} mt-6 max-w-xs`} onClick={handleRetry}>
            다른 사진으로 다시 시도
          </button>
        </section>
      )}
    </main>
  );
}
