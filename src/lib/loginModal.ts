/**
 * 로그인 모달 전역 열기 통로.
 *
 * 모달 자체는 ClientLayout이 소유한다(state + 렌더). 헤더 밖의 컴포넌트가
 * 모달을 열 방법이 없어, api.ts의 setUnauthorizedHandler와 같은
 * handler-registry 패턴으로 열기만 위임받는다.
 */
let loginModalHandler: (() => void) | null = null;

export function setLoginModalHandler(handler: (() => void) | null) {
  loginModalHandler = handler;
}

export function openLoginModal() {
  loginModalHandler?.();
}
