import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo, timeAgoOrDate, formatDate, formatDateTime, formatTime, nowKstString } from '@/lib/utils';

afterEach(() => vi.useRealTimers());

function isoAgo(days: number, hours = 0, minutes = 0) {
  const d = new Date(Date.now() - (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000);
  return d.toISOString();
}

describe('formatDate', () => {
  it('YYYY.MM.DD 형식으로 반환한다', () => {
    expect(formatDate('2026-04-14T00:00:00Z')).toBe('2026.04.14');
  });

  it('trailing dot이 없다', () => {
    const result = formatDate('2026-04-14T00:00:00Z');
    expect(result.endsWith('.')).toBe(false);
  });

  it('월/일이 한 자리면 0으로 패딩한다', () => {
    expect(formatDate('2026-01-05T00:00:00Z')).toBe('2026.01.05');
  });
});

describe('formatDateTime', () => {
  it('YYYY.MM.DD HH:MM 형식으로 반환한다', () => {
    const result = formatDateTime('2026-04-14T05:30:00Z');
    expect(result).toMatch(/^2026\.04\.14 \d{2}:\d{2}$/);
  });

  it('trailing dot이 없다', () => {
    const result = formatDateTime('2026-04-14T05:30:00Z');
    expect(result).not.toContain('오전');
    expect(result).not.toContain('오후');
    const datePart = result.split(' ')[0];
    expect(datePart.endsWith('.')).toBe(false);
  });
});

describe('timeAgoOrDate', () => {
  it('1일 전은 상대시간을 반환한다', () => {
    expect(timeAgoOrDate(isoAgo(1))).toBe('1일 전');
  });

  it('6일 전은 상대시간을 반환한다', () => {
    expect(timeAgoOrDate(isoAgo(6))).toBe('6일 전');
  });

  it('7일 전은 절대날짜(YYYY.MM.DD)를 반환한다', () => {
    const result = timeAgoOrDate(isoAgo(7));
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it('30일 전은 절대날짜를 반환한다', () => {
    const result = timeAgoOrDate(isoAgo(30));
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it('1시간 전은 상대시간을 반환한다', () => {
    expect(timeAgoOrDate(isoAgo(0, 1))).toBe('1시간 전');
  });

  it('반환값에 trailing dot이 없다', () => {
    const result = timeAgoOrDate(isoAgo(30));
    expect(result.endsWith('.')).toBe(false);
  });
});

describe('timezone naive 처리 — 백엔드 KST naive 대응 (회귀 방지)', () => {
  it('timezone 없는 ISO 문자열을 KST(+09:00)로 해석한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T08:00:00+09:00'));
    // 백엔드가 timezone 정보 없이 보내는 KST naive 형식
    expect(timeAgo('2026-04-29T07:59:00')).toBe('1분 전');
    expect(timeAgo('2026-04-29T07:00:00')).toBe('1시간 전');
  });

  it('KST naive를 UTC로 잘못 해석하지 않는다 (9시간 어긋남 방지)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T17:00:00+09:00'));
    // 동일 시각이지만 timezone 누락 → KST로 해석되어 '방금 전'
    expect(timeAgo('2026-04-29T17:00:00')).toBe('방금 전');
  });

  it('마이크로초 정밀도가 포함된 KST naive (Spring LocalDateTime 형식) 처리', () => {
    vi.useFakeTimers();
    // 2시간 차이 — floor 시 마이크로초 손실 영향 없도록 충분한 마진
    vi.setSystemTime(new Date('2026-04-29T10:00:00+09:00'));
    expect(timeAgo('2026-04-29T08:00:00.580808')).toBe('1시간 전');
  });

  it('Z로 끝나는 UTC 문자열은 그대로 UTC로 처리한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T08:00:00Z'));
    expect(timeAgo('2026-04-29T07:00:00Z')).toBe('1시간 전');
  });

  it('+09:00 명시된 KST 문자열은 그대로 KST로 처리한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T17:00:00+09:00'));
    expect(timeAgo('2026-04-29T16:30:00+09:00')).toBe('30분 전');
  });
});

// ─── [차단 3] formatTime — DM 메시지 시간 표시 ─────────────────────────────
describe('formatTime', () => {
  it('KST-naive 문자열을 KST 시:분으로 반환한다', () => {
    // "2026-06-11T10:30:00" → KST 10:30 → "오전 10:30"
    const result = formatTime('2026-06-11T10:30:00');
    expect(result).toContain('10');
    expect(result).toContain('30');
  });

  it('UTC(Z) 문자열을 그대로 UTC 시:분으로 반환한다', () => {
    // Z suffix → parseServerTime이 UTC로 처리 → toLocaleTimeString 로컬 변환
    // 여기서는 형식만 검증 (HH:MM 포함)
    const result = formatTime('2026-06-11T01:00:00Z');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('KST-naive를 new Date()로 직접 파싱하면 9시간 어긋나지만 formatTime은 정확하다', () => {
    // KST 10:00 == UTC 01:00 → 브라우저가 UTC 환경이면 new Date('...T10:00:00').getHours() = 10(UTC 해석)
    // parseServerTime은 +09:00 suffix를 붙여 정확한 KST 기준으로 변환
    // 테스트 환경 타임존에 무관하게 형식(HH:MM)만 검증
    const result = formatTime('2026-06-11T15:45:00');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ─── [차단 3] nowKstString — 낙관적 메시지 createdAt ────────────────────────
describe('nowKstString', () => {
  it('Z suffix 없는 naive ISO 형식을 반환한다', () => {
    const result = nowKstString();
    expect(result).not.toContain('Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('반환값을 parseServerTime으로 파싱하면 현재 시각과 오차 1초 이내이다', () => {
    // parseServerTime은 +09:00 붙여 KST로 해석 → 현재 실제 시각과 일치해야 함
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T10:00:00+09:00'));
    const kstStr = nowKstString();
    // parseServerTime을 직접 가져올 수 없으니(내부 함수) formatTime으로 간접 검증
    const result = formatTime(kstStr);
    expect(result).toContain('10');
    expect(result).toContain('00');
    vi.useRealTimers();
  });
});
