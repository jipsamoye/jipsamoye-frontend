type ImagePreset = 'post' | 'profile' | 'cover';

const PRESETS: Record<ImagePreset, { maxWidth: number; maxHeight?: number; maxSizeMB: number }> = {
  post: { maxWidth: 1920, maxSizeMB: 0.5 },
  profile: { maxWidth: 400, maxSizeMB: 0.1 },
  cover: { maxWidth: 1200, maxHeight: 300, maxSizeMB: 0.3 },
};

const QUALITY_DEFAULT = 0.8;
const QUALITY_RETRY = 0.6;

export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const { maxWidth, maxHeight, maxSizeMB } = PRESETS[preset];

  // 이미 WebP이고 크기가 충분히 작으면 스킵
  if (file.type === 'image/webp' && file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  // 디코딩 + 리사이즈를 한 번에 처리
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxWidth / bitmap.width, (maxHeight ?? bitmap.height) / bitmap.height, 1);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP 인코딩
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY_DEFAULT });

  // 용량 초과 시 한 번만 재시도
  if (blob.size > maxSizeMB * 1024 * 1024) {
    blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY_RETRY });
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
  });
}
