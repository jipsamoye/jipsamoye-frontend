import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preloadImage, PRELOAD_TIMEOUT_MS } from '@/lib/preloadImage';

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  decode = vi.fn(() => Promise.resolve());
  constructor() {
    FakeImage.instances.push(this);
  }
}

const lastImage = () => FakeImage.instances[FakeImage.instances.length - 1];

describe('preloadImage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeImage.instances = [];
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('로드 + 디코딩 완료 시 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    expect(lastImage().src).toBe('https://cdn/results/1.png');
    lastImage().onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('decode 실패해도 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    lastImage().decode.mockRejectedValueOnce(new Error('decode fail'));
    lastImage().onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('로드 실패(onerror) 시에도 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    lastImage().onerror?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('onload/onerror가 안 와도 타임아웃 후 resolve된다', async () => {
    const p = preloadImage('https://cdn/results/1.png');
    vi.advanceTimersByTime(PRELOAD_TIMEOUT_MS);
    await expect(p).resolves.toBeUndefined();
  });
});
