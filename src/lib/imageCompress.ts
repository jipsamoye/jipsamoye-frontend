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

/**
 * 목표 용량에 수렴할 때까지 quality 조정 → 해상도 축소 순으로 시도.
 *
 * 최적화 3단 구조:
 *  1. 첫 인코딩으로 용량 측정
 *  2. 초과 시 "스마트 예측"으로 목표 quality 한 번에 계산 → 1회 재인코딩
 *  3. 그래도 초과 시 해상도 축소 (minQuality ≥ 0.70 환경에선 거의 발생 안 함)
 *
 * Canvas의 `imageSmoothingQuality: 'high'` 로 리샘플링 품질 강제 —
 * 기본값 'low'는 bilinear 저품질이라 털 같은 고주파 디테일에서 aliasing 발생.
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

  // 스마트 quality 예측 — 여러 번 깎지 않고 한 번에 목표 근처로 수렴
  // 파일 크기는 quality에 대해 대략 log 관계라 log2(ratio) × 0.15 만큼 깎음
  if (blob.size > cfg.maxSizeBytes) {
    const ratio = blob.size / cfg.maxSizeBytes;
    quality = Math.max(
      cfg.minQuality,
      QUALITY_START - Math.log2(ratio) * 0.15,
    );
    blob = await renderBlob(bitmap, width, height, quality);
  }

  // Fallback: 여전히 초과면 해상도 축소 (minQuality 0.80 환경에선 거의 발생 안 함)
  while (blob.size > cfg.maxSizeBytes) {
    const nextWidth = Math.round(width * DOWNSCALE_STEP);
    const nextHeight = Math.round(height * DOWNSCALE_STEP);
    if (nextWidth < MIN_DIMENSION) break;
    width = nextWidth;
    height = nextHeight;
    quality = Math.max(cfg.minQuality, 0.75);
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/webp', quality });
}
