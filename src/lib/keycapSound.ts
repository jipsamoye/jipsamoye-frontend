import { keycapSoundUrl, type KeycapSwitchId } from './keycap';

/**
 * 키캡 소리 재생 엔진 (모듈 싱글턴).
 *
 * AudioContext는 반드시 playKeycapSound 안에서 lazy 생성한다 — 브라우저 자동재생
 * 정책상 사용자 제스처(pointerdown/keydown) 핸들러의 동기 구간에서 만들어야
 * running 상태가 되고, 페이지 로드 시 만들면 첫 소리를 놓친다 (기획 스펙 제약 2).
 * warmKeycapSound는 네트워크 fetch만 미리 해두는 용도라 AudioContext를 만들지 않는다.
 */

let ctx: AudioContext | null = null;
const rawCache = new Map<string, Promise<ArrayBuffer | null>>();
const decodedCache = new Map<string, Promise<AudioBuffer | null>>();

/**
 * 실패(null)로 끝난 엔트리는 캐시에서 지운다 — 남겨두면 첫 클릭 순간의 일시적
 * 오프라인이나 배포 중 404 한 번으로 그 소리가 새로고침 전까지 영영 안 난다.
 * 그 사이 같은 url로 새 시도가 들어와 캐시가 교체됐다면 건드리지 않는다.
 */
function forgetIfFailed<T>(
  cache: Map<string, Promise<T | null>>,
  url: string,
  pending: Promise<T | null>,
  value: T | null,
): T | null {
  if (!value && cache.get(url) === pending) cache.delete(url);
  return value;
}

function fetchRaw(url: string): Promise<ArrayBuffer | null> {
  const cached = rawCache.get(url);
  if (cached) return cached;

  const pending: Promise<ArrayBuffer | null> = fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .catch(() => null)
    .then((raw) => forgetIfFailed(rawCache, url, pending, raw));

  rawCache.set(url, pending);
  return pending;
}

function decodeBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = decodedCache.get(url);
  if (cached) return cached;

  const pending: Promise<AudioBuffer | null> = fetchRaw(url)
    // decodeAudioData가 ArrayBuffer를 detach하는 브라우저가 있어 복사본을 넘긴다
    .then((raw) => (raw && ctx ? ctx.decodeAudioData(raw.slice(0)) : null))
    .catch(() => null)
    .then((buffer) => forgetIfFailed(decodedCache, url, pending, buffer));

  decodedCache.set(url, pending);
  return pending;
}

export function warmKeycapSound(id: KeycapSwitchId): void {
  if (typeof fetch !== 'function') return;
  void fetchRaw(keycapSoundUrl(id, 'down'));
  void fetchRaw(keycapSoundUrl(id, 'up'));
}

export function playKeycapSound(id: KeycapSwitchId, dir: 'down' | 'up'): void {
  if (typeof AudioContext !== 'function') return;
  // 여기까지는 동기 — 제스처 컨텍스트 안에서 생성/resume 되어야 한다
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();

  void decodeBuffer(keycapSoundUrl(id, dir))
    .then((buffer) => {
      if (!buffer || !ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    })
    .catch(() => {
      // 소리는 보조 기능 — 어떤 실패도 화면을 깨지 않는다
    });
}

/** 테스트 전용 — 모듈 싱글턴 상태 초기화 */
export function resetKeycapSoundForTest(): void {
  ctx = null;
  rawCache.clear();
  decodedCache.clear();
}
