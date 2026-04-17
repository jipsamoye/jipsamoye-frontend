import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
}));

import { useComments } from '@/hooks/useComments';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });
const emptyPage = successRes({ content: [], totalPages: 0, totalElements: 0, currentPage: 0, size: 20, hasNext: false });

describe('useComments', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  it('addComment 는 userId 파라미터 없이 /api/posts/{id}/comments 로 POST 한다', async () => {
    apiMock.get.mockResolvedValueOnce(emptyPage);
    apiMock.post.mockResolvedValueOnce(successRes({
      id: 1,
      content: '귀엽네요',
      nickname: '츄르맨',
      profileImageUrl: null,
      parentId: null,
      createdAt: '',
      updatedAt: '',
    }));

    const { result } = renderHook(() => useComments(42));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addComment('귀엽네요');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/posts/42/comments', { content: '귀엽네요' });
    const calledUrl = apiMock.post.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('userId=');
  });

  it('updateComment/deleteComment 도 userId 파라미터를 붙이지 않는다', async () => {
    apiMock.get.mockResolvedValueOnce(emptyPage);
    apiMock.patch.mockResolvedValueOnce(successRes({
      id: 1, content: '수정본', nickname: '츄르맨', profileImageUrl: null, parentId: null, createdAt: '', updatedAt: '',
    }));
    apiMock.delete.mockResolvedValueOnce(successRes(null));

    const { result } = renderHook(() => useComments(42));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateComment(1, '수정본');
      await result.current.deleteComment(1);
    });

    expect(apiMock.patch).toHaveBeenCalledWith('/api/comments/1', { content: '수정본' });
    expect(apiMock.delete).toHaveBeenCalledWith('/api/comments/1');
  });
});
