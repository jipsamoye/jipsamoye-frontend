import { api } from '@/lib/api';
import { compressImage, extFromMimeType } from '@/lib/imageCompress';
import type { PresignedUrlResponse } from '@/types/api';

/**
 * 단일 이미지 업로드 헬퍼 (PostEditor.uploadSingleImage 패턴).
 *
 * 흐름: compress('post') → POST /api/images/presigned-url → S3 PUT → imageUrl 반환.
 * - 압축 결과가 fast path로 원본(JPEG/PNG)일 수 있어, ext/Content-Type을 실제
 *   타입에 맞춰야 S3 메타와 바이트가 일치(메타/바이트 불일치 방지). 따라서 직렬 호출.
 * - presigned 발급은 api 래퍼(credentials include)로, S3 PUT은 fetch로 직접.
 *
 * @returns 업로드된 이미지의 CDN/S3 URL
 * @throws presigned 발급 또는 S3 PUT 실패 시 (401은 api 래퍼가 전역 처리 후 throw)
 */
export async function uploadPostImage(file: File): Promise<string> {
  const compressed = await compressImage(file, 'post');

  const res = await api.post<PresignedUrlResponse>('/api/images/presigned-url', {
    dirName: 'posts',
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

  return res.data.imageUrl;
}
