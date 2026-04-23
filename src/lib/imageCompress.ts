type ImagePreset = 'post' | 'profile' | 'cover';

interface PresetConfig {
  maxWidth: number;
  maxHeight?: number;
  maxSizeBytes: number;
  minQuality: number;
}

const PRESETS: Record<ImagePreset, PresetConfig> = {
  post:    { maxWidth: 2048, maxSizeBytes: 1024 * 1024, minQuality: 0.80 },
  profile: { maxWidth: 400,  maxSizeBytes: 60 * 1024,   minQuality: 0.45 },
  cover:   { maxWidth: 1200, maxHeight: 400, maxSizeBytes: 150 * 1024, minQuality: 0.3 },
};

const MIN_DIMENSION = 360;
const DOWNSCALE_STEP = 0.8;
const QUALITY_START = 0.85;
const QUALITY_DECREMENT = 0.15;

/**
 * 목표 용량에 수렴할 때까지 quality 감소 → 해상도 축소 → 반복
 * 고해상도 원본이어도 반드시 maxSizeBytes 이하(or 거의)로 떨어짐
 */
export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const cfg = PRESETS[preset];

  // 이미 WebP + 충분히 작으면 스킵
  if (file.type === 'image/webp' && file.size <= cfg.maxSizeBytes) {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  // 초기 해상도: maxWidth/Height 에 맞춰 스케일
  const initialScale = Math.min(
    cfg.maxWidth / bitmap.width,
    (cfg.maxHeight ?? bitmap.height) / bitmap.height,
    1,
  );
  let width = Math.round(bitmap.width * initialScale);
  let height = Math.round(bitmap.height * initialScale);
  let quality = QUALITY_START;

  let blob: Blob = await renderBlob(bitmap, width, height, quality);

  // 목표 용량까지 수렴
  while (blob.size > cfg.maxSizeBytes) {
    // 1순위: quality 낮춰보기
    if (quality - QUALITY_DECREMENT >= cfg.minQuality) {
      quality -= QUALITY_DECREMENT;
      blob = await renderBlob(bitmap, width, height, quality);
      continue;
    }

    // 2순위: 해상도 축소 후 quality 리셋
    const nextWidth = Math.round(width * DOWNSCALE_STEP);
    const nextHeight = Math.round(height * DOWNSCALE_STEP);
    if (nextWidth < MIN_DIMENSION) break; // 너무 작아지면 중단
    width = nextWidth;
    height = nextHeight;
    quality = Math.max(cfg.minQuality, 0.7);
    blob = await renderBlob(bitmap, width, height, quality);
  }

  bitmap.close();

  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
  });
}

async function renderBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/webp', quality });
}
