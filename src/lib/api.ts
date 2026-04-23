import { ApiResponse } from '@/types/api';
import { showToast } from '@/components/common/Toast';

const API_BASE_URL = '';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

interface RequestExtras {
  silent?: boolean;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
  { silent = false }: RequestExtras = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (res.status === 401) {
    if (!silent) showToast('로그인하고 이용해 주세요');
    unauthorizedHandler?.();
    throw { status: 401, code: 'UNAUTHORIZED', message: '로그인이 필요합니다.', data: null } as ApiResponse<null>;
  }

  const data: ApiResponse<T> = await res.json();

  if (data.code !== 'SUCCESS' && data.code !== 'CREATED') {
    throw data;
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string, extras?: RequestExtras) => request<T>(endpoint, undefined, extras),

  post: <T>(endpoint: string, body?: unknown, extras?: RequestExtras) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, extras),

  patch: <T>(endpoint: string, body?: unknown, extras?: RequestExtras) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }, extras),

  delete: <T>(endpoint: string, extras?: RequestExtras) =>
    request<T>(endpoint, { method: 'DELETE' }, extras),
};
