'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { compressImage, extFromMimeType } from '@/lib/imageCompress';
import { ALLOWED_IMAGE_EXTS, POST_CONFIG } from '@/lib/constants';
import type { PresignedUrlResponse, User } from '@/types/api';

/**
 * 프로필 이미지 업로드 훅.
 *
 * 파일 선택 즉시 blob 미리보기를 노출해 "업로드 직후 Lambda 썸네일 미생성 →
 * 404 캐시(60s) → 원본 폴백" 경쟁 구간을 화면에서 가린다. 서버 파이프라인
 * (S3 → Lambda 썸네일 → CDN)은 그대로 — 미리보기는 이 화면에서만 쓰는 다리.
 *
 * 흐름: 검증 → blob 미리보기 → compress('profile') → presigned → S3 PUT → PATCH /users/me
 * 실패 시 미리보기를 되돌리고 throw (검증 실패는 토스트용 한국어 메시지 포함).
 */
export function useProfileImageUpload() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewRef = useRef<string | null>(null);

  const setPreview = useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  }, []);

  // unmount 시 마지막 blob 해제
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const upload = useCallback(async (file: File): Promise<User> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      throw new Error('jpg·png·webp 이미지만 올릴 수 있어요');
    }
    if (file.size > POST_CONFIG.MAX_IMAGE_SIZE) {
      throw new Error('이미지는 10MB 이하만 올릴 수 있어요');
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const compressed = await compressImage(file, 'profile');
      const res = await api.post<PresignedUrlResponse>('/api/images/presigned-url', {
        dirName: 'profiles',
        ext: extFromMimeType(compressed.type),
      });
      const putRes = await fetch(res.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      });
      if (!putRes.ok) {
        throw new Error(`S3 업로드 실패 (${putRes.status})`);
      }
      const patched = await api.patch<User>('/api/users/me', {
        profileImageUrl: res.data.imageUrl,
      });
      return patched.data;
    } catch (err) {
      setPreview(null);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [setPreview]);

  return { previewUrl, uploading, upload };
}
