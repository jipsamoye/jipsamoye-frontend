'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useFigurineJob } from '@/hooks/useFigurineJob';
import { buildFigurineShareUrl } from '@/lib/figurineShare';
import { uploadPostImage } from '@/lib/uploadImage';
import { openLoginModal } from '@/lib/loginModal';
import { showToast } from '@/components/common/Toast';
import { preloadImage } from '@/lib/preloadImage';
import FigurineLoading from '@/components/domain/FigurineLoading';
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
  const [revealReady, setRevealReady] = useState(false);
  // AI 단계 카피의 기준 시각. 업로드가 끝나고 생성 요청을 보내는 시점에 잡는다.
  // 마운트 시각으로 초기화해, 어떤 경로로든 값이 비어 경과가 폭주하는 일이 없게 한다.
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 결과 이미지가 캐시에 준비된 뒤에만 결과 화면으로 전환 — 빈 화면·점진 렌더 방지
  useEffect(() => {
    if (phase !== 'completed' || !job?.resultImageUrl) return;
    let cancelled = false;
    preloadImage(job.resultImageUrl).then(() => {
      if (!cancelled) setRevealReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, job?.resultImageUrl]);

  // 다시 만들기/초기화 시 다음 결과를 위해 리셋
  useEffect(() => {
    if (phase === 'idle') setRevealReady(false);
  }, [phase]);

  // objectURL 누수 방지
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyFile = (selected: File): boolean => {
    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      showToast('jpg, jpeg, png, webp 이미지만 올릴 수 있어요');
      return false;
    }
    if (selected.size > POST_CONFIG.MAX_IMAGE_SIZE) {
      showToast('10MB 이하 이미지만 올릴 수 있어요');
      return false;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!applyFile(selected)) e.target.value = '';
  };

  const openFilePicker = () => {
    // 비로그인이면 파일 선택창 대신 로그인 모달로 유도
    if (!user) {
      openLoginModal();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!user) {
      openLoginModal();
      return;
    }
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) applyFile(dropped);
  };

  const handleGenerate = async () => {
    if (!file || uploading) return;
    if (!user) {
      openLoginModal();
      return;
    }
    setUploading(true);
    try {
      const sourceImageUrl = await uploadPostImage(file);
      // 업로드가 끝난 시점부터 센다. 버튼 누른 시각으로 재면 업로드에 걸린 만큼
      // 단계가 앞질러 가서, AI가 막 시작했는데 "레진 붓는 중"이 뜬다.
      setStartedAt(Date.now());
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

  const handleShare = async () => {
    if (!job?.resultImageUrl) return;
    const shareUrl = buildFigurineShareUrl(job.resultImageUrl, window.location.origin);

    if (navigator.share) {
      try {
        await navigator.share({ title: 'AI 키캡 피규어 — 집사모여', url: shareUrl });
      } catch {
        // 공유 시트를 닫은 경우(AbortError) — 안내 불필요
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('링크가 복사됐어요!');
    } catch {
      showToast('링크 복사에 실패했어요.');
    }
  };

  const handleRetry = () => {
    reset();
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 사진 압축 · S3 업로드 · 생성 요청 구간. AI 작업은 아직 시작 전이다.
  const preparing = uploading || phase === 'creating';

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-gray-900">AI 키캡 피규어</h1>
      <p className="mt-2 text-sm text-gray-600">
        우리 애 사진을 올리면 아티산 키캡 위 미니 피규어로 만들어 드려요.
      </p>

      {phase === 'idle' && !preparing && (
        <section className="mt-6">
          {/* 자랑하기(PostEditor) 업로드와 동일한 드롭존 패턴 — 화면 간 일관성을
              iOS 시트 위치 고정(중앙 버튼 트리거)보다 우선한 결정 */}
          <div
            onClick={openFilePicker}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400 transition-all duration-200"
          >
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */}
                <img
                  src={previewUrl}
                  alt="선택한 사진 미리보기"
                  className="mx-auto max-h-80 rounded-xl object-contain"
                />
                <p className="mt-3 text-xs text-gray-400">클릭해서 다른 사진 선택</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">+</div>
                <p className="text-sm text-gray-500">JPG / PNG / WEBP</p>
                <p className="text-xs text-gray-400">10MB 이내 · 1장</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="사진 선택"
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()}
              className="hidden"
            />
          </div>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            disabled={!file}
            onClick={handleGenerate}
          >
            키캡 피규어 만들기
          </button>
        </section>
      )}

      {/* 버튼을 누른 즉시 여기로 전환된다 — 업로드가 끝나기를 기다리지 않는다 */}
      {(preparing || phase === 'generating' || (phase === 'completed' && !revealReady)) && (
        <FigurineLoading previewUrl={previewUrl} startedAt={startedAt} preparing={preparing} />
      )}

      {(phase === 'posting' || phase === 'posted' || (phase === 'completed' && revealReady)) && job?.resultImageUrl && (
        <section className="mt-6 animate-[fadeIn_0.5s_ease-out]">
          {/* eslint-disable-next-line @next/next/no-img-element -- 방금 생성된 결과라 Lambda 썸네일이 없을 수 있어 원본을 직접 표시 */}
          <img
            src={job.resultImageUrl}
            alt="완성된 AI 키캡 피규어"
            decoding="async"
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
            disabled={phase === 'posting'}
            onClick={handleShare}
          >
            링크로 공유하기
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
    </div>
  );
}
