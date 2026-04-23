import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressImage } from '@/lib/imageCompress';

// 지정한 mime + size(byte) + 이름을 가진 File 생성. 실제 픽셀 데이터는 필요 없음.
function makeFile(type: string, size: number, name: string): File {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

// createImageBitmap 모킹: 해상도/close 구현만 있으면 충분
function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width,
      height,
      close: vi.fn(),
    })),
  );
}

// OffscreenCanvas + convertToBlob 모킹: fallback 경로에서 WebP Blob 반환
// quality 에 따라 가짜 크기를 달리해 수렴 로직이 멈추게 함
function stubOffscreenCanvas(outputSize: number) {
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: vi.fn(),
  };
  class FakeCanvas {
    constructor(public width: number, public height: number) {}
    getContext() { return ctx; }
    convertToBlob() {
      return Promise.resolve(new Blob([new Uint8Array(outputSize)], { type: 'image/webp' }));
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeCanvas as unknown as typeof OffscreenCanvas);
}

describe('compressImage — Fast Path (early return)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('JPEG 300KB 1400×1050 post 프리셋 → 원본 그대로 반환', async () => {
    stubBitmap(1400, 1050);
    const file = makeFile('image/jpeg', 300 * 1024, 'dog.jpg');
    const result = await compressImage(file, 'post');
    expect(result).toBe(file);
    expect(result.type).toBe('image/jpeg');
  });

  it('WebP 200KB 1200×900 post 프리셋 → 원본 그대로 반환', async () => {
    stubBitmap(1200, 900);
    const file = makeFile('image/webp', 200 * 1024, 'cat.webp');
    const result = await compressImage(file, 'post');
    expect(result).toBe(file);
    expect(result.type).toBe('image/webp');
  });

  it('PNG 100KB 400×400 profile 프리셋 → 원본 그대로 반환', async () => {
    stubBitmap(400, 400);
    const file = makeFile('image/png', 100 * 1024, 'avatar.png');
    const result = await compressImage(file, 'profile');
    expect(result).toBe(file);
    expect(result.type).toBe('image/png');
  });

  it('JPEG 500KB 1920×640 cover 프리셋 (maxHeight 경계) → 원본 그대로 반환', async () => {
    stubBitmap(1920, 640);
    const file = makeFile('image/jpeg', 500 * 1024, 'cover.jpg');
    const result = await compressImage(file, 'cover');
    expect(result).toBe(file);
  });
});

describe('compressImage — Fallback 경로 (재인코딩)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('해상도 초과 (4032×3024) post 프리셋 → WebP 변환 + .webp 확장자', async () => {
    stubBitmap(4032, 3024);
    stubOffscreenCanvas(400 * 1024); // 1MB cap 미만이라 수렴 루프 1회 종료
    const file = makeFile('image/jpeg', 1 * 1024 * 1024, 'bigdog.jpg');
    const result = await compressImage(file, 'post');
    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('bigdog.webp');
    expect(result).not.toBe(file);
  });

  it('용량 초과 (3MB JPEG) post 프리셋 → fallback 진입 + WebP 변환', async () => {
    stubBitmap(1400, 1050); // 해상도는 OK 지만 용량 초과
    stubOffscreenCanvas(500 * 1024);
    const file = makeFile('image/jpeg', 3 * 1024 * 1024, 'big.jpg');
    const result = await compressImage(file, 'post');
    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('big.webp');
  });

  it('HEIC 포맷 (image/heic) → fast path 우회 → WebP 변환', async () => {
    stubBitmap(3000, 2250);
    stubOffscreenCanvas(600 * 1024);
    const file = makeFile('image/heic', 2 * 1024 * 1024, 'iphone.heic');
    const result = await compressImage(file, 'post');
    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('iphone.webp');
  });

  it('profile 프리셋: 1MB PNG → cap(500KB) 초과로 fallback 진입', async () => {
    stubBitmap(500, 500);
    stubOffscreenCanvas(200 * 1024);
    const file = makeFile('image/png', 1 * 1024 * 1024, 'heavy-avatar.png');
    const result = await compressImage(file, 'profile');
    expect(result.type).toBe('image/webp');
  });
});
