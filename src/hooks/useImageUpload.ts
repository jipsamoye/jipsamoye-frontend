'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PresignedUrlResponse } from '@/types/api';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const userId = localStorage.getItem('userId');
    if (!userId) return null;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedExts.includes(ext)) return null;
    if (file.size > 10 * 1024 * 1024) return null;

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
