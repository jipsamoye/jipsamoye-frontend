export const PRELOAD_TIMEOUT_MS = 8_000;

/**
 * 이미지를 브라우저 캐시에 미리 로드한다.
 *
 * 화면 전환 트리거 용도라 실패·타임아웃에도 resolve한다 — 호출부는 완료를 기다렸다가
 * 전환만 하면 되고, 실제 표시는 <img>가 담당한다(캐시 히트 시 즉시 그려짐).
 */
export function preloadImage(url: string, timeoutMs: number = PRELOAD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    const img = new Image();
    img.onload = () => {
      // 디코딩까지 끝내야 마운트 시 페인트가 끊기지 않는다. decode 미지원/실패 시에도 전환은 진행.
      if (typeof img.decode === 'function') {
        img.decode().then(done, done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  });
}
