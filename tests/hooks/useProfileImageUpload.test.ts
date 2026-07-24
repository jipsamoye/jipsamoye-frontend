import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiMock, compressImageMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  compressImageMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/imageCompress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/imageCompress')>();
  return { ...actual, compressImage: compressImageMock };
});

import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { POST_CONFIG } from '@/lib/constants';
import type { User } from '@/types/api';

const ok = <T,>(data: T) => ({ status: 200, code: 'SUCCESS', message: '', data });

const PRESIGNED = {
  presignedUrl: 'https://jipsamoye-bucket.s3.ap-northeast-2.amazonaws.com/profiles/1/uuid.webp?sig=x',
  imageUrl: 'https://images.jipsamoye.com/profiles/1/uuid.webp',
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    nickname: '집사',
    profileImageUrl: PRESIGNED.imageUrl,
    ...overrides,
  } as User;
}

function makeFile(name = 'cat.jpg', type = 'image/jpeg'): File {
  return new File(['x'], name, { type });
}

describe('useProfileImageUpload', () => {
  const createObjectURL = vi.fn(() => 'blob:https://jipsamoye.com/preview-1');
  const revokeObjectURL = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    compressImageMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();

    vi.stubGlobal('URL', Object.assign(globalThis.URL, {
      createObjectURL,
      revokeObjectURL,
    }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    // 기본 해피패스 목: 압축은 파일 그대로 통과, presigned 발급 + PATCH 성공
    compressImageMock.mockImplementation(async (file: File) => file);
    apiMock.post.mockResolvedValue(ok(PRESIGNED));
    apiMock.patch.mockResolvedValue(ok(makeUser()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('허용되지 않은 확장자면 즉시 실패하고 미리보기·API 호출이 없다', async () => {
    const { result } = renderHook(() => useProfileImageUpload());

    await act(async () => {
      await expect(result.current.upload(makeFile('cat.gif', 'image/gif')))
        .rejects.toThrow('jpg·png·webp');
    });

    expect(result.current.previewUrl).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('10MB 초과 파일이면 즉시 실패한다', async () => {
    const file = makeFile();
    Object.defineProperty(file, 'size', { value: POST_CONFIG.MAX_IMAGE_SIZE + 1 });
    const { result } = renderHook(() => useProfileImageUpload());

    await act(async () => {
      await expect(result.current.upload(file)).rejects.toThrow('10MB');
    });

    expect(result.current.previewUrl).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('업로드 시작 즉시 blob 미리보기가 뜨고, 진행 중엔 uploading=true', async () => {
    // 압축을 수동 resolve로 잡아둬서 "진행 중" 상태를 관찰
    let resolveCompress!: (f: File) => void;
    compressImageMock.mockImplementation(
      () => new Promise<File>((resolve) => { resolveCompress = resolve; }),
    );
    const file = makeFile();
    const { result } = renderHook(() => useProfileImageUpload());

    let uploadPromise!: Promise<User>;
    act(() => { uploadPromise = result.current.upload(file); });

    // 네트워크가 끝나기 전인데 이미 미리보기 + uploading 상태
    expect(result.current.previewUrl).toBe('blob:https://jipsamoye.com/preview-1');
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(result.current.uploading).toBe(true);

    await act(async () => {
      resolveCompress(file);
      await uploadPromise;
    });
    expect(result.current.uploading).toBe(false);
  });

  it('성공 시 presigned→S3 PUT→PATCH 순서로 호출하고 갱신된 User를 반환한다', async () => {
    const file = makeFile();
    const { result } = renderHook(() => useProfileImageUpload());

    let updated!: User;
    await act(async () => { updated = await result.current.upload(file); });

    expect(apiMock.post).toHaveBeenCalledWith('/api/images/presigned-url', {
      dirName: 'profiles',
      ext: 'jpg',
    });
    expect(fetchMock).toHaveBeenCalledWith(PRESIGNED.presignedUrl, expect.objectContaining({
      method: 'PUT',
      body: file,
    }));
    expect(apiMock.patch).toHaveBeenCalledWith('/api/users/me', {
      profileImageUrl: PRESIGNED.imageUrl,
    });
    expect(updated.profileImageUrl).toBe(PRESIGNED.imageUrl);
    // 성공 후에도 미리보기는 유지 (썸네일 생성 지연 창을 blob이 가림)
    expect(result.current.previewUrl).toBe('blob:https://jipsamoye.com/preview-1');
  });

  it('S3 PUT 실패 시 미리보기를 되돌리고(revoke) 에러를 던진다', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { result } = renderHook(() => useProfileImageUpload());

    await act(async () => {
      await expect(result.current.upload(makeFile())).rejects.toThrow();
    });

    expect(result.current.previewUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://jipsamoye.com/preview-1');
    expect(result.current.uploading).toBe(false);
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('재업로드 시 이전 blob URL을 revoke하고, unmount 시에도 revoke한다', async () => {
    createObjectURL
      .mockReturnValueOnce('blob:https://jipsamoye.com/preview-1')
      .mockReturnValueOnce('blob:https://jipsamoye.com/preview-2');
    const { result, unmount } = renderHook(() => useProfileImageUpload());

    await act(async () => { await result.current.upload(makeFile()); });
    await act(async () => { await result.current.upload(makeFile()); });

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://jipsamoye.com/preview-1');
    expect(result.current.previewUrl).toBe('blob:https://jipsamoye.com/preview-2');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://jipsamoye.com/preview-2');
  });
});
