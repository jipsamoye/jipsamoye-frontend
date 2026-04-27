import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgoOrDate, formatDate, formatDateTime } from '@/lib/utils';

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
