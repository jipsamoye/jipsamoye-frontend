const HINT_NAME = 'has_session';

export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => {
    if (!c.startsWith(`${HINT_NAME}=`)) return false;
    return c.slice(HINT_NAME.length + 1).length > 0;
  });
}

export function clearSessionHint(): void {
  if (typeof document === 'undefined') return;
  const base = `${HINT_NAME}=; Max-Age=0; Path=/`;
  // localhost 개발 대비 (Domain/Secure 없이)
  document.cookie = base;
  // 운영 대비 (로그인 시 심은 속성과 동일)
  document.cookie = `${base}; Domain=jipsamoye.com; Secure; SameSite=Lax`;
}
