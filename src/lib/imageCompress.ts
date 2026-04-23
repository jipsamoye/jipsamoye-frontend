type ImagePreset = 'post' | 'profile' | 'cover';

interface PresetConfig {
  maxWidth: number;
  maxHeight?: number;
  maxSizeBytes: number;
  minQuality: number;
}

const PRESETS: Record<ImagePreset, PresetConfig> = {
  post:    { maxWidth: 1600, maxSizeBytes: 2 * 1024 * 1024, minQuality: 0.90 },
  profile: { maxWidth: 800,  maxSizeBytes: 500 * 1024,      minQuality: 0.85 },
  cover:   { maxWidth: 1920, maxHeight: 640, maxSizeBytes: 1 * 1024 * 1024, minQuality: 0.85 },
};

const WEB_SAFE_TYPES = new Set(['image/jpeg', 'image/webp', 'image/png']);
const MIN_DIMENSION = 360;
const DOWNSCALE_STEP = 0.8;
const QUALITY_START = 0.90;

/**
 * MIME → S3 object 확장자. `compressImage` 가 fast path에서 원본(JPEG/PNG)을
 * 그대로 돌려줄 수 있어, 호출부가 presigned URL 요청 시 실제 타입에 맞춰 ext를
 * 동적으로 전달해야 한다. 메타/바이트 불일치를 방지.
 */
export function extFromMimeType(type: string): string {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    default:           return 'webp';
  }
}

/**
 * 목표 용량에 수렴할 때까지 quality 조정 → 해상도 축소 순으로 시도.
 *
 * 최적화 3단 구조:
 *  1. 첫 인코딩으로 용량 측정
 *  2. 초과 시 "스마트 예측"으로 목표 quality 한 번에 계산 → 1회 재인코딩
 *  3. 그래도 초과 시 해상도 축소 (minQuality ≥ 0.85 환경에선 거의 발생 안 함)
 *
 * Canvas의 `imageSmoothingQuality: 'high'` 로 리샘플링 품질 강제 —
 * 기본값 'low'는 bilinear 저품질이라 털 같은 고주파 디테일에서 aliasing 발생.
 */
export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const cfg = PRESETS[preset];

  // Fast path: web-safe 포맷(JPEG/WebP/PNG) + 용량/해상도 모두 적정 → 원본 그대로 통과.
  // 재인코딩 단계를 생략해 double-lossy 누적을 막는다 (fur noodle artifact 원천 방지).
  if (WEB_SAFE_TYPES.has(file.type) && file.size <= cfg.maxSizeBytes) {
    let probe: ImageBitmap | null = null;
    try {
      probe = await createImageBitmap(file);
      const fits = probe.width <= cfg.maxWidth &&
                   (!cfg.maxHeight || probe.height <= cfg.maxHeight);
      if (fits) return file;
    } catch {
      // probe 디코드 실패 — 드물게 손상/스푸핑 파일. 과거(WebP-only early-return)
      // 동작과 호환되게 원본을 그대로 돌려준다. Fallback 경로도 동일하게 실패하므로
      // 에러 전파보다 원본 통과가 덜 파괴적.
      return file;
    } finally {
      probe?.close();
    }
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

  // Fallback: 여전히 초과면 해상도 축소 (minQuality 0.85 환경에선 거의 발생 안 함)
  while (blob.size > cfg.maxSizeBytes) {
    const nextWidth = Math.round(width * DOWNSCALE_STEP);
    const nextHeight = Math.round(height * DOWNSCALE_STEP);
    if (nextWidth < MIN_DIMENSION) break;
    width = nextWidth;
    height = nextHeight;
    quality = Math.max(cfg.minQuality, 0.85);
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
