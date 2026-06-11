import { describe, it, expect, beforeEach, vi } from 'vitest';

const showToastMock = vi.fn();
vi.mock('@/components/common/Toast', () => ({
  showToast: (text: string) => showToastMock(text),
}));

import { api, setUnauthorizedHandler } from '@/lib/api';

function mockFetchOnce(body: unknown, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    status,
    json: async () => body,
  });
}

describe('api request wrapper', () => {
  beforeEach(() => {
    showToastMock.mockClear();
    setUnauthorizedHandler(() => {});
  });

  it('성공 응답이면 data를 그대로 돌려준다', async () => {
    const payload = { status: 200, code: 'SUCCESS', message: 'ok', data: { id: 1, nickname: '집사' } };
    global.fetch = mockFetchOnce(payload) as unknown as typeof fetch;

    const res = await api.get<{ id: number; nickname: string }>('/api/auth/me');

    expect(res.data).toEqual({ id: 1, nickname: '집사' });
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('모든 요청에 credentials: "include" 를 포함한다', async () => {
    const fetchMock = mockFetchOnce({ status: 200, code: 'SUCCESS', message: '', data: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.get('/api/posts');

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe('include');
  });

  it('상대 경로로 fetch를 호출한다 (next.config rewrite로 같은 출처 처리)', async () => {
    const fetchMock = mockFetchOnce({ status: 200, code: 'SUCCESS', message: '', data: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.get('/api/posts');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('/api/posts');
    expect(url).not.toMatch(/^https?:\/\//);
  });

  it('POST 요청도 절대 URL 없이 상대 경로로 호출한다', async () => {
    const fetchMock = mockFetchOnce({ status: 201, code: 'CREATED', message: '', data: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.post('/api/posts/1/like');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('/api/posts/1/like');
    expect(url).not.toMatch(/^https?:\/\//);
  });

  it('POST/PATCH는 body를 JSON 문자열로 직렬화한다', async () => {
    const fetchMock = mockFetchOnce({ status: 201, code: 'CREATED', message: '', data: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.post('/api/posts', { title: '자랑' });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ title: '자랑' }));
  });

  it('401 응답이면 토스트를 띄우고 unauthorizedHandler를 호출한 뒤 UNAUTHORIZED 에러를 throw 한다', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 401,
      json: async () => ({ status: 401, code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', data: null }),
    }) as unknown as typeof fetch;

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(api.post('/api/posts', { title: 't' })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });

    expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('silent 옵션이 true면 401 응답에도 토스트를 띄우지 않지만 unauthorizedHandler 와 throw 는 유지한다', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 401,
      json: async () => ({ status: 401, code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', data: null }),
    }) as unknown as typeof fetch;

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(api.get('/api/auth/me', { silent: true })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });

    expect(showToastMock).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('비즈니스 에러(code !== SUCCESS/CREATED) 는 토스트 없이 응답을 throw 한다', async () => {
    global.fetch = mockFetchOnce({
      status: 200,
      code: 'INVALID_INPUT',
      message: '제목을 입력해 주세요',
      data: null,
    }) as unknown as typeof fetch;

    await expect(api.post('/api/posts', {})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('204 No Content 응답이면 json()을 호출하지 않고 data: null, code: SUCCESS로 resolve한다', async () => {
    const jsonMock = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 204,
      statusText: 'No Content',
      json: jsonMock,
    }) as unknown as typeof fetch;

    const res = await api.delete('/api/posts/1');

    expect(res.code).toBe('SUCCESS');
    expect(res.data).toBeNull();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it('비-JSON 5xx 응답이면 raw SyntaxError가 새어나오지 않고 HTTP_ERROR envelope로 reject한다', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }) as unknown as typeof fetch;

    await expect(api.get('/api/posts')).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 502,
    });
  });

  it('HTTP_ERROR envelope에는 SyntaxError 인스턴스가 포함되지 않는다', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await api.get('/api/posts');
    } catch (e) {
      caught = e;
    }

    expect(caught).not.toBeInstanceOf(SyntaxError);
    expect(caught).toMatchObject({ code: 'HTTP_ERROR', status: 502, message: 'Bad Gateway' });
  });
});
