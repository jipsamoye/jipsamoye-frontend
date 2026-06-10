import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { User } from '@/types/api';

// ── Toast 모킹 ────────────────────────────────────────────────────────────────
const { showToastMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
}));

vi.mock('@/components/common/Toast', () => ({
  showToast: showToastMock,
  default: () => null,
}));

// ── 테스트용 User 샘플 ─────────────────────────────────────────────────────────
const sampleUser: User = {
  nickname: '집사갑',
  bio: '냥이 셋 키우는 집사',
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 5,
  followerCount: 10,
  followingCount: 3,
  totalLikeCount: 42,
  ranking: 7,
  createdAt: '2026-01-01T00:00:00Z',
};

// window.location을 교체 가능하도록 재정의하는 헬퍼
function stubLocation(origin = 'http://localhost:3000') {
  const loc = { origin, href: '' };
  Object.defineProperty(window, 'location', {
    value: loc,
    writable: true,
    configurable: true,
  });
  return loc;
}

describe('startNaverLogin', () => {
  beforeEach(() => {
    showToastMock.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('clientId가 빈 값(env 미설정)이면 showToast를 호출하고 href를 변경하지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_NAVER_CLIENT_ID', '');
    const loc = stubLocation();

    // 모듈 캐시를 지워 env 변경이 반영되게 한다
    vi.resetModules();
    const { startNaverLogin } = await import('@/lib/naverAuth');

    startNaverLogin();

    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(loc.href).toBe('');
  });

  it('clientId가 있으면 state를 sessionStorage에 저장하고 네이버 authorize URL로 이동한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_NAVER_CLIENT_ID', 'TEST_CLIENT_ID');
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-state-uuid' as `${string}-${string}-${string}-${string}-${string}` });
    const loc = stubLocation('http://localhost:3000');

    vi.resetModules();
    const { startNaverLogin, NAVER_STATE_KEY } = await import('@/lib/naverAuth');

    startNaverLogin();

    // sessionStorage에 state 저장 여부
    expect(sessionStorage.getItem(NAVER_STATE_KEY)).toBe('fixed-state-uuid');

    // href가 네이버 authorize URL로 시작하는지
    expect(loc.href).toMatch(/^https:\/\/nid\.naver\.com\/oauth2\.0\/authorize/);

    // 쿼리 파라미터 확인
    const url = new URL(loc.href);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('TEST_CLIENT_ID');
    expect(url.searchParams.get('redirect_uri')).toContain('/auth/naver/callback');
    expect(url.searchParams.get('state')).toBe('fixed-state-uuid');
  });
});

describe('requestNaverLogin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function getRequestNaverLogin() {
    vi.resetModules();
    const mod = await import('@/lib/naverAuth');
    return mod.requestNaverLogin;
  }

  function mockFetch(ok: boolean, status: number, body: object) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('성공 응답이면 { ok:true, isNewUser, user } 를 반환한다', async () => {
    const fetchMock = mockFetch(true, 200, {
      code: 'SUCCESS',
      data: { isNewUser: true, user: sampleUser },
    });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('code123', 'state456');

    expect(result).toEqual({ ok: true, isNewUser: true, user: sampleUser });

    // fetch 호출 검증
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/naver/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    const reqBody = JSON.parse(init.body as string) as { code: string; state: string };
    expect(reqBody.code).toBe('code123');
    expect(reqBody.state).toBe('state456');
  });

  it('isNewUser:false 성공 응답이면 { ok:true, isNewUser:false, user } 를 반환한다', async () => {
    mockFetch(true, 200, {
      code: 'SUCCESS',
      data: { isNewUser: false, user: sampleUser },
    });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: true, isNewUser: false, user: sampleUser });
  });

  it('401 + NAVER_TOKEN_EXCHANGE_FAILED → { ok:false, code:"NAVER_TOKEN_EXCHANGE_FAILED" }', async () => {
    mockFetch(false, 401, { code: 'NAVER_TOKEN_EXCHANGE_FAILED', data: null });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: false, code: 'NAVER_TOKEN_EXCHANGE_FAILED' });
  });

  it('502 + NAVER_API_ERROR → { ok:false, code:"NAVER_API_ERROR" }', async () => {
    mockFetch(false, 502, { code: 'NAVER_API_ERROR', data: null });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: false, code: 'NAVER_API_ERROR' });
  });

  it('fetch가 throw하면 { ok:false, code:"NETWORK_ERROR" } 를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: false, code: 'NETWORK_ERROR' });
  });

  // [Blocker 항목 1] res.ok=true 인데 body.data=null인 경우
  // 구현의 `if (res.ok && body.data)` 가드가 실제로 필요함을 검증한다.
  // 이 테스트가 없으면 `res.ok &&` 조건을 제거해도 다른 테스트가 통과해버린다.
  it('res.ok=true 이지만 body.data=null 이면 { ok:false, ... } 를 반환한다', async () => {
    mockFetch(true, 200, { code: 'SUCCESS', data: null });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe('SUCCESS');
  });

  // [Major 항목 3] res.ok=false + res.json() 자체가 throw하는 경우 (프록시 HTML 502 등)
  // try 블록 내에서 res.json()이 파싱 실패 시 catch로 떨어져 NETWORK_ERROR를 반환하는 동작을 고정한다.
  it('res.ok=false + json 파싱 실패(HTML 응답 등) → { ok:false, code:"NETWORK_ERROR" }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    }));

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: false, code: 'NETWORK_ERROR' });
  });

  // [Minor 항목 5] res.ok=false + body에 code 필드 없음 → 'UNKNOWN' fallback
  it('res.ok=false + body에 code 필드 없음 → { ok:false, code:"UNKNOWN" }', async () => {
    mockFetch(false, 400, { data: null });

    const requestNaverLogin = await getRequestNaverLogin();
    const result = await requestNaverLogin('c', 's');

    expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
  });
});
