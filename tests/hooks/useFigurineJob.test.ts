import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FigurineJob } from '@/types/api';

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  toastMock: { showToast: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/common/Toast', () => toastMock);

import { useFigurineJob, POLL_INTERVAL_MS, MAX_POLLS } from '@/hooks/useFigurineJob';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makeJob = (overrides: Partial<FigurineJob> = {}): FigurineJob => ({
  jobId: 1,
  status: 'PENDING',
  resultImageUrl: null,
  failReason: null,
  petPostId: null,
  ...overrides,
});

describe('useFigurineJob — 생성/폴링', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    toastMock.showToast.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start: POST /api/figurines 성공 시 phase=generating, job 저장', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());

    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/figurines', {
      sourceImageUrl: 'https://cdn/posts/1/a.webp',
    });
    expect(result.current.phase).toBe('generating');
    expect(result.current.job?.jobId).toBe(1);
  });

  it('start 실패(400): 토스트 안내 후 phase=idle 복귀', async () => {
    apiMock.post.mockRejectedValueOnce({
      status: 400, code: 'BAD_REQUEST', message: '본인이 업로드한 이미지만 사용할 수 있어요', data: null,
    });
    const { result } = renderHook(() => useFigurineJob());

    await act(async () => {
      await result.current.start('https://evil/img.jpg');
    });

    expect(toastMock.showToast).toHaveBeenCalledWith('본인이 업로드한 이미지만 사용할 수 있어요');
    expect(result.current.phase).toBe('idle');
  });

  it('폴링: 2.5초 간격으로 GET, PROCESSING이면 계속, COMPLETED면 phase=completed', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    apiMock.get.mockResolvedValueOnce(successRes(makeJob({ status: 'PROCESSING' })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/figurines/1', { silent: true });
    expect(result.current.phase).toBe('generating');
    expect(result.current.job?.status).toBe('PROCESSING');

    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'COMPLETED', resultImageUrl: 'https://cdn/results/1.png' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.phase).toBe('completed');
    expect(result.current.job?.resultImageUrl).toBe('https://cdn/results/1.png');

    // 종료 후 추가 폴링 없음
    const callsAfterDone = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAfterDone);
  });

  it('폴링: FAILED 수신 시 phase=failed + failReason 노출', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'FAILED', failReason: '이미지 생성에 실패했어요' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.errorMessage).toBe('이미지 생성에 실패했어요');
  });

  it('일시 네트워크 오류는 계속 재시도하고, 백스톱 초과 시 phase=failed(타임아웃 안내)', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_POLLS);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.errorMessage).toContain('너무 오래');
    expect(apiMock.get).toHaveBeenCalledTimes(MAX_POLLS);
  });

  it('unmount 시 폴링이 멈춘다', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockResolvedValue(successRes(makeJob({ status: 'PROCESSING' })));
    const { result, unmount } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    unmount();
    const callsAtUnmount = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAtUnmount);
  });

  it('reset: 폴링 중단 + job/phase 초기화', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    apiMock.get.mockResolvedValue(successRes(makeJob({ status: 'PROCESSING' })));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.job).toBeNull();

    const callsAtReset = apiMock.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(apiMock.get.mock.calls.length).toBe(callsAtReset);
  });

  it('겹치는 start(): 새 start가 이전 폴링 세대를 무효화한다', async () => {
    // 첫 번째 start의 POST는 지연 resolve, 두 번째는 즉시 resolve
    let resolveFirst: (v: unknown) => void = () => {};
    apiMock.post
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(successRes(makeJob({ jobId: 2 })));

    const { result } = renderHook(() => useFigurineJob());

    let firstStart: Promise<void>;
    act(() => {
      firstStart = result.current.start('https://cdn/posts/1/a.webp');
    });
    await act(async () => {
      await result.current.start('https://cdn/posts/1/b.webp');
    });
    // 이제 첫 번째 POST가 뒤늦게 resolve — 이전 세대이므로 무시되어야 함
    await act(async () => {
      resolveFirst(successRes(makeJob({ jobId: 1 })));
      await firstStart!;
    });

    expect(result.current.job?.jobId).toBe(2);

    // 폴링은 jobId=2 한 루프만 돌아야 함
    apiMock.get.mockResolvedValue(successRes(makeJob({ jobId: 2, status: 'PROCESSING' })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith('/api/figurines/2', { silent: true });
  });

  it('완료 후 재시도 start(): 이전 job이 즉시 초기화되고, 실패 시 idle + job=null', async () => {
    apiMock.post.mockResolvedValueOnce(successRes(makeJob()));
    const { result } = renderHook(() => useFigurineJob());
    await act(async () => {
      await result.current.start('https://cdn/posts/1/a.webp');
    });
    apiMock.get.mockResolvedValueOnce(
      successRes(makeJob({ status: 'COMPLETED', resultImageUrl: 'https://cdn/results/1.png' }))
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.phase).toBe('completed');

    // 재시도 — 새 POST 실패
    apiMock.post.mockRejectedValueOnce({ status: 400, code: 'BAD_REQUEST', message: '잘못된 요청', data: null });
    await act(async () => {
      await result.current.start('https://cdn/posts/1/b.webp');
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.job).toBeNull();
  });
});
