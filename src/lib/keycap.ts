/**
 * AI 키캡 누르기 — 축 메타데이터와 사용자 설정(localStorage).
 * 소리 자산 출처: kbsim © Thomas Lai (MIT) + Freesound el_boss (CC0).
 * 고지 전문: public/sounds/keycap/LICENSE.txt
 */

export type KeycapSwitchId = 'brown' | 'blue' | 'red' | 'navy' | 'cream' | 'jade' | 'black';

export interface KeycapSwitch {
  id: KeycapSwitchId;
  /** 칩에 표시하는 짧은 이름 (모바일 375px에서 두 줄 4+3 배치 기준) */
  label: string;
  /** 칩 앞 색 점 — Tailwind가 정적 스캔할 수 있게 완성된 클래스 문자열로 둔다 */
  dotClass: string;
}

// 순서 고정 — 첫 번째(갈축)가 기본값이라는 기획 결정에 의존한다
export const KEYCAP_SWITCHES: readonly KeycapSwitch[] = [
  { id: 'brown', label: '갈축', dotClass: 'bg-[#a16207]' },
  { id: 'blue', label: '청축', dotClass: 'bg-[#3b82f6]' },
  { id: 'red', label: '적축', dotClass: 'bg-[#ef4444]' },
  { id: 'navy', label: '네이비', dotClass: 'bg-[#1e40af]' },
  { id: 'cream', label: '크림', dotClass: 'bg-[#eab308]' },
  { id: 'jade', label: '제이드', dotClass: 'bg-[#10b981]' },
  { id: 'black', label: '흑축', dotClass: 'bg-[#1f2937]' },
];

export const DEFAULT_SWITCH_ID: KeycapSwitchId = KEYCAP_SWITCHES[0].id;

export function keycapSoundUrl(id: KeycapSwitchId, dir: 'down' | 'up'): string {
  return `/sounds/keycap/${id}-${dir}.wav`;
}

const SWITCH_KEY = 'keycap.switch';
const MUTED_KEY = 'keycap.muted';
const PRESSED_KEY = 'keycap.pressed';

// 프라이빗 모드·저장소 차단 환경에서 기능 전체가 죽지 않게 전부 try/catch
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시 — 이번 세션 동안만 기억되는 것으로 충분
  }
}

export function getStoredSwitchId(): KeycapSwitchId {
  const stored = read(SWITCH_KEY);
  return KEYCAP_SWITCHES.some((s) => s.id === stored)
    ? (stored as KeycapSwitchId)
    : DEFAULT_SWITCH_ID;
}

export function storeSwitchId(id: KeycapSwitchId): void {
  write(SWITCH_KEY, id);
}

export function getStoredMuted(): boolean {
  return read(MUTED_KEY) === '1';
}

export function storeMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? '1' : '0');
}

export function getHasPressed(): boolean {
  return read(PRESSED_KEY) === '1';
}

export function markPressed(): void {
  write(PRESSED_KEY, '1');
}
