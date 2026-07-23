import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLoginModalHandler, openLoginModal } from '@/lib/loginModal';

describe('loginModal', () => {
  beforeEach(() => {
    setLoginModalHandler(null);
  });

  it('핸들러 등록 후 openLoginModal 호출 시 핸들러가 실행된다', () => {
    const handler = vi.fn();
    setLoginModalHandler(handler);

    openLoginModal();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('핸들러 미등록 상태에서는 openLoginModal이 조용히 무시된다', () => {
    expect(() => openLoginModal()).not.toThrow();
  });

  it('null로 해제하면 이전 핸들러가 더 이상 호출되지 않는다', () => {
    const handler = vi.fn();
    setLoginModalHandler(handler);
    setLoginModalHandler(null);

    openLoginModal();

    expect(handler).not.toHaveBeenCalled();
  });

  it('새 핸들러를 등록하면 이전 핸들러를 대체한다', () => {
    const first = vi.fn();
    const second = vi.fn();
    setLoginModalHandler(first);
    setLoginModalHandler(second);

    openLoginModal();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
