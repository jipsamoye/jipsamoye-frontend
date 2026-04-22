import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasSessionHint, clearSessionHint } from '@/lib/auth';

function wipeCookies() {
  document.cookie.split('; ').forEach((c) => {
    const [name] = c.split('=');
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
}

describe('hasSessionHint', () => {
  beforeEach(() => {
    wipeCookies();
  });

  it('쿠키가 하나도 없으면 false 를 반환한다', () => {
    expect(hasSessionHint()).toBe(false);
  });

  it('has_session=1 이 있으면 true 를 반환한다', () => {
    document.cookie = 'has_session=1; Path=/';
    expect(hasSessionHint()).toBe(true);
  });

  it('has_session= (빈 값) 이면 false 를 반환한다 — 백엔드 삭제 실수 방어', () => {
    document.cookie = 'has_session=; Path=/';
    expect(hasSessionHint()).toBe(false);
  });

  it('has_session=yes 처럼 값이 1 이 아니어도 true 를 반환한다 — 값 유연성', () => {
    document.cookie = 'has_session=yes; Path=/';
    expect(hasSessionHint()).toBe(true);
  });

  it('다른 쿠키와 혼재해도 정확히 감지한다', () => {
    document.cookie = '_ga=GA1.1.foo; Path=/';
    document.cookie = 'has_session=1; Path=/';
    document.cookie = 'theme=dark; Path=/';
    expect(hasSessionHint()).toBe(true);
  });

  it('이름이 접두 일치만 하는 다른 쿠키에는 오탐되지 않는다', () => {
    document.cookie = 'my_has_session=1; Path=/';
    expect(hasSessionHint()).toBe(false);
  });

  it('다른 쿠키의 값 안에 has_session= 문자열이 섞여도 오탐되지 않는다', () => {
    // foo 쿠키의 값으로 has_session=... 가 들어가는 경계 매칭 테스트
    document.cookie = 'foo=has_session_trick; Path=/';
    expect(hasSessionHint()).toBe(false);
  });

  it('clearSessionHint() 호출 후에는 false 가 된다', () => {
    document.cookie = 'has_session=1; Path=/';
    expect(hasSessionHint()).toBe(true);

    clearSessionHint();
    expect(hasSessionHint()).toBe(false);
  });
});

describe('clearSessionHint', () => {
  it('localhost 대비와 운영 대비 두 가지 속성으로 쿠키를 덮어쓴다', () => {
    const setSpy = vi.spyOn(document, 'cookie', 'set');

    clearSessionHint();

    expect(setSpy).toHaveBeenCalledTimes(2);

    const first = String(setSpy.mock.calls[0][0]);
    const second = String(setSpy.mock.calls[1][0]);

    // 첫 번째: localhost 대비 — Domain/Secure 없음
    expect(first).toContain('has_session=');
    expect(first).toContain('Max-Age=0');
    expect(first).toContain('Path=/');
    expect(first).not.toContain('Domain=');
    expect(first).not.toContain('Secure');

    // 두 번째: 운영 대비 — 백엔드와 동일 속성 (선행 점 없는 Domain)
    expect(second).toContain('Domain=jipsamoye.com');
    expect(second).not.toContain('Domain=.jipsamoye.com');
    expect(second).toContain('Secure');
    expect(second).toContain('SameSite=Lax');
    expect(second).toContain('Max-Age=0');

    setSpy.mockRestore();
  });
});
