import { User } from '@/types/api';
import { showToast } from '@/components/common/Toast';

/** sessionStorage 키: CSRF 방지용 state 저장 */
export const NAVER_STATE_KEY = 'naver_oauth_state';

const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';

/**
 * 네이버 로그인 시작 — state 생성·저장 후 네이버 authorize 페이지로 이동.
 * redirect_uri는 네이버 개발자센터 등록값과 정확히 일치해야 한다
 * (등록: https://jipsamoye.com/auth/naver/callback, http://localhost:3000/auth/naver/callback).
 */
export function startNaverLogin(): void {
  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  if (!clientId) {
    showToast('네이버 로그인 설정이 필요합니다.');
    return;
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem(NAVER_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/naver/callback`,
    state,
  });

  window.location.href = `${NAVER_AUTHORIZE_URL}?${params}`;
}

export type NaverLoginResult =
  | { ok: true; isNewUser: boolean; user: User }
  | { ok: false; code: string };

interface NaverLoginResponse {
  code: string;
  data: { isNewUser: boolean; user: User } | null;
}

/**
 * 콜백에서 받은 code/state를 백엔드에 전달해 가입/로그인 처리.
 *
 * 공유 api.ts 래퍼를 쓰지 않고 raw fetch를 쓰는 이유: api.ts는 모든 401을
 * 가로채 generic 토스트 + unauthorizedHandler를 실행하고 에러 code를
 * 'UNAUTHORIZED'로 덮어쓴다. 그러면 NAVER_TOKEN_EXCHANGE_FAILED(401) vs
 * NAVER_API_ERROR(502)를 구분할 수 없다. 여기서는 body.code를 그대로 읽어
 * 호출부가 케이스별로 분기할 수 있게 한다.
 */
export async function requestNaverLogin(code: string, state: string): Promise<NaverLoginResult> {
  try {
    const res = await fetch('/api/auth/naver/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, state }),
    });

    const body: NaverLoginResponse = await res.json();

    if (res.ok && body.data) {
      return { ok: true, isNewUser: body.data.isNewUser, user: body.data.user };
    }
    return { ok: false, code: body.code ?? 'UNKNOWN' };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}
