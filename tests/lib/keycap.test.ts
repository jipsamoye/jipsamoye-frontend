import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  KEYCAP_SWITCHES, DEFAULT_SWITCH_ID, keycapSoundUrl,
  getStoredSwitchId, storeSwitchId,
  getStoredMuted, storeMuted,
  getHasPressed, markPressed,
} from '@/lib/keycap';

describe('KEYCAP_SWITCHES', () => {
  it('7종이며 갈축(brown)이 첫 번째(기본값)다', () => {
    expect(KEYCAP_SWITCHES).toHaveLength(7);
    expect(KEYCAP_SWITCHES[0].id).toBe('brown');
    expect(DEFAULT_SWITCH_ID).toBe('brown');
    expect(KEYCAP_SWITCHES.map((s) => s.id)).toEqual([
      'brown', 'blue', 'red', 'navy', 'cream', 'jade', 'black',
    ]);
  });

  it('라벨은 프로토타입 확정안(짧은 이름)이다', () => {
    expect(KEYCAP_SWITCHES.map((s) => s.label)).toEqual([
      '갈축', '청축', '적축', '네이비', '크림', '제이드', '흑축',
    ]);
  });

  it('keycapSoundUrl은 public 자산 경로를 만든다', () => {
    expect(keycapSoundUrl('brown', 'down')).toBe('/sounds/keycap/brown-down.wav');
    expect(keycapSoundUrl('jade', 'up')).toBe('/sounds/keycap/jade-up.wav');
  });
});

describe('localStorage 설정', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('축: 기본 brown, 저장·복원 roundtrip', () => {
    expect(getStoredSwitchId()).toBe('brown');
    storeSwitchId('jade');
    expect(getStoredSwitchId()).toBe('jade');
    expect(localStorage.getItem('keycap.switch')).toBe('jade');
  });

  it('저장된 축이 목록에 없는 값이면 기본값으로 폴백한다', () => {
    localStorage.setItem('keycap.switch', 'topre');
    expect(getStoredSwitchId()).toBe('brown');
  });

  it('음소거: 기본 false(소리 켜짐), 저장·복원 roundtrip', () => {
    expect(getStoredMuted()).toBe(false);
    storeMuted(true);
    expect(getStoredMuted()).toBe(true);
    storeMuted(false);
    expect(getStoredMuted()).toBe(false);
  });

  it('눌러본 적: 기본 false, markPressed 후 true', () => {
    expect(getHasPressed()).toBe(false);
    markPressed();
    expect(getHasPressed()).toBe(true);
    expect(localStorage.getItem('keycap.pressed')).toBe('1');
  });

  it('localStorage가 던져도(사파리 프라이빗 등) 조용히 기본값으로 동작한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(getStoredSwitchId()).toBe('brown');
    expect(getStoredMuted()).toBe(false);
    expect(getHasPressed()).toBe(false);
    expect(() => storeSwitchId('blue')).not.toThrow();
    expect(() => storeMuted(true)).not.toThrow();
    expect(() => markPressed()).not.toThrow();
  });
});
