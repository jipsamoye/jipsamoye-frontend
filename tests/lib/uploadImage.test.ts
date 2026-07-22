import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { apiMock, compressMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  compressMock: { compressImage: vi.fn(), extFromMimeType: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/imageCompress', () => compressMock);

import { uploadPostImage } from '@/lib/uploadImage';

const file = new File(['raw'], 'cat.jpg', { type: 'image/jpeg' });
const compressed = new File(['zip'], 'cat.webp', { type: 'image/webp' });

describe('uploadPostImage', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    compressMock.compressImage.mockReset();
    compressMock.extFromMimeType.mockReset();

    compressMock.compressImage.mockResolvedValue(compressed);
    compressMock.extFromMimeType.mockReturnValue('webp');
    apiMock.post.mockResolvedValue({
      status: 200, code: 'SUCCESS', message: '',
      data: { presignedUrl: 'https://s3/presigned', imageUrl: 'https://cdn/posts/1/a.webp' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('압축 → presigned 발급 → S3 PUT 순서로 진행하고 imageUrl을 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const url = await uploadPostImage(file);

    expect(compressMock.compressImage).toHaveBeenCalledWith(file, 'post');
    expect(apiMock.post).toHaveBeenCalledWith('/api/images/presigned-url', {
      dirName: 'posts',
      ext: 'webp',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://s3/presigned', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: compressed,
    });
    expect(url).toBe('https://cdn/posts/1/a.webp');
  });

  it('압축 결과 타입 기준으로 ext를 정한다 (fast path 원본 JPEG 통과 시 jpg)', async () => {
    const passthrough = new File(['raw'], 'cat.jpg', { type: 'image/jpeg' });
    compressMock.compressImage.mockResolvedValue(passthrough);
    compressMock.extFromMimeType.mockReturnValue('jpg');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    await uploadPostImage(file);

    expect(compressMock.extFromMimeType).toHaveBeenCalledWith('image/jpeg');
    expect(apiMock.post).toHaveBeenCalledWith('/api/images/presigned-url', {
      dirName: 'posts',
      ext: 'jpg',
    });
  });

  it('S3 PUT 실패 시 상태코드를 담아 에러를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(uploadPostImage(file)).rejects.toThrow('S3 업로드 실패 (403)');
  });

  it('presigned 발급 실패 시 에러를 그대로 전파하고 S3 PUT을 시도하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    apiMock.post.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: '', data: null });

    await expect(uploadPostImage(file)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
