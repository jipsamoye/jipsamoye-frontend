'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PresignedUrlResponse } from '@/types/api';
import { storage } from '@/lib/storage';
import { ALLOWED_IMAGE_EXTS, POST_CONFIG } from '@/lib/constants';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const userId = storage.getUserId();
    if (!userId) return null;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) return null;
    if (file.size > POST_CONFIG.MAX_IMAGE_SIZE) return null;

    setUploading(true);
    try {
      const res = await api.post<PresignedUrlResponse>(`/api/images/presigned-url?userId=${userId}`, {
        dirName: 'posts',
        ext,
      });

      await fetch(res.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      return res.data.imageUrl;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadImage, uploading };
}
