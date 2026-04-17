type ImagePreset = 'post' | 'profile' | 'cover';

const PRESETS: Record<ImagePreset, { maxWidth: number; maxHeight?: number; maxSizeMB: number }> = {
  post: { maxWidth: 1280, maxSizeMB: 0.5 },
  profile: { maxWidth: 400, maxSizeMB: 0.1 },
  cover: { maxWidth: 1200, maxHeight: 300, maxSizeMB: 0.3 },
};

const QUALITY_STEPS = [0.8, 0.6, 0.4, 0.3];
const DOWNSCALE_FACTOR = 0.7;

export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const { maxWidth, maxHeight, maxSizeMB } = PRESETS[preset];
  const maxBytes = maxSizeMB * 1024 * 1024;

  // 이미 WebP이고 크기가 충분히 작으면 스킵
  if (file.type === 'image/webp' && file.size <= maxBytes) {
    return file;
  }

  // 디코딩 + 리사이즈를 한 번에 처리
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxWidth / bitmap.width, (maxHeight ?? bitmap.height) / bitmap.height, 1);
  let width = Math.round(bitmap.width * scale);
  let height = Math.round(bitmap.height * scale);

  let canvas = new OffscreenCanvas(width, height);
  let ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // quality 단계적 하락으로 목표 크기까지 압축
  let blob: Blob | undefined;
  for (const quality of QUALITY_STEPS) {
    blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.size <= maxBytes) break;
  }

  // 그래도 초과하면 해상도 축소 후 재시도
  if (blob!.size > maxBytes) {
    width = Math.round(width * DOWNSCALE_FACTOR);
    height = Math.round(height * DOWNSCALE_FACTOR);
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d')!;
    const smallBitmap = await createImageBitmap(blob!);
    ctx.drawImage(smallBitmap, 0, 0, width, height);
    smallBitmap.close();
    blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.5 });
  }

  return new File([blob!], file.name.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
  });
}
