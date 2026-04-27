import { describe, it, expect } from 'vitest';
import {
  getWeekRange,
  getMonthRange,
  formatRangeLabel,
  parseDateParam,
  toIsoDate,
  isFuture,
} from '@/lib/dateRange';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function date(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ── getWeekRange ──────────────────────────────────────────────────────────────
describe('getWeekRange', () => {
  it('월요일 진입 → 같은 날이 start', () => {
    const { start, end } = getWeekRange(date(2026, 4, 20)); // 2026-04-20 월
    expect(toIsoDate(start)).toBe('2026-04-20');
    expect(toIsoDate(end)).toBe('2026-04-27');
  });

  it('일요일 진입 → 직전 월요일이 start', () => {
    const { start, end } = getWeekRange(date(2026, 4, 26)); // 2026-04-26 일
    expect(toIsoDate(start)).toBe('2026-04-20');
    expect(toIsoDate(end)).toBe('2026-04-27');
  });

  it('토요일 진입 → 같은 주 월요일이 start', () => {
    const { start, end } = getWeekRange(date(2026, 4, 25)); // 2026-04-25 토
    expect(toIsoDate(start)).toBe('2026-04-20');
    expect(toIsoDate(end)).toBe('2026-04-27');
  });

  it('12월 → 1월 경계를 넘는 주 (12월 28일 월 → 1월 3일)', () => {
    // 2026-12-28(월) → end=2027-01-04
    const { start, end } = getWeekRange(date(2026, 12, 30)); // 수요일
    expect(toIsoDate(start)).toBe('2026-12-28');
    expect(toIsoDate(end)).toBe('2027-01-04');
  });

  it('end 는 start + 7일 (exclusive)', () => {
    const { start, end } = getWeekRange(date(2026, 4, 21));
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });
});

// ── getMonthRange ─────────────────────────────────────────────────────────────
describe('getMonthRange', () => {
  it('일반 월: 1일 ~ 다음 달 1일', () => {
    const { start, end } = getMonthRange(2026, 4);
    expect(toIsoDate(start)).toBe('2026-04-01');
    expect(toIsoDate(end)).toBe('2026-05-01');
  });

  it('12월 → 1월 경계', () => {
    const { start, end } = getMonthRange(2026, 12);
    expect(toIsoDate(start)).toBe('2026-12-01');
    expect(toIsoDate(end)).toBe('2027-01-01');
  });

  it('윤년 2월 (2028): end=2028-03-01', () => {
    const { start, end } = getMonthRange(2028, 2);
    expect(toIsoDate(start)).toBe('2028-02-01');
    expect(toIsoDate(end)).toBe('2028-03-01');
  });

  it('평년 2월 (2026): end=2026-03-01', () => {
    const { start, end } = getMonthRange(2026, 2);
    expect(toIsoDate(start)).toBe('2026-02-01');
    expect(toIsoDate(end)).toBe('2026-03-01');
  });
});

// ── formatRangeLabel ──────────────────────────────────────────────────────────
describe('formatRangeLabel', () => {
  it('weekly isOngoing=true → right="오늘"', () => {
    const s = date(2026, 4, 20);
    const e = date(2026, 4, 27);
    const { left, right } = formatRangeLabel(s, e, 'weekly', true);
    expect(left).toBe('04.20');
    expect(right).toBe('오늘');
  });

  it('weekly isOngoing=false → right=inclusive end (MM.DD)', () => {
    const s = date(2026, 4, 13);
    const e = date(2026, 4, 20); // exclusive → inclusive=04.19
    const { left, right } = formatRangeLabel(s, e, 'weekly', false);
    expect(left).toBe('04.13');
    expect(right).toBe('04.19');
  });

  it('monthly → "X월" 형태, right 는 빈 문자열', () => {
    const s = date(2026, 4, 1);
    const e = date(2026, 5, 1);
    const { left, right } = formatRangeLabel(s, e, 'monthly', false);
    expect(left).toBe('4월');
    expect(right).toBe('');
  });

  it('monthly isOngoing=true 도 동일 형태', () => {
    const s = date(2026, 4, 1);
    const e = date(2026, 5, 1);
    const { left } = formatRangeLabel(s, e, 'monthly', true);
    expect(left).toBe('4월');
  });

  it('12월 말~1월 초 weekly 경계', () => {
    const s = date(2026, 12, 28);
    const e = date(2027, 1, 4); // exclusive → inclusive=01.03
    const { left, right } = formatRangeLabel(s, e, 'weekly', false);
    expect(left).toBe('12.28');
    expect(right).toBe('01.03');
  });
});

// ── parseDateParam ────────────────────────────────────────────────────────────
describe('parseDateParam', () => {
  it('null → 오늘 날짜 반환 (연도만 비교)', () => {
    const result = parseDateParam(null);
    const today = new Date();
    expect(result.getFullYear()).toBe(today.getFullYear());
  });

  it('유효한 날짜 문자열 파싱', () => {
    const result = parseDateParam('2026-04-20');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // 0-indexed
    expect(result.getDate()).toBe(20);
  });

  it('잘못된 형식 → 오늘 날짜 fallback', () => {
    const result = parseDateParam('invalid');
    const today = new Date();
    expect(result.getFullYear()).toBe(today.getFullYear());
  });

  it('월간 date=YYYY-MM-01 파싱', () => {
    const result = parseDateParam('2026-02-01');
    expect(toIsoDate(result)).toBe('2026-02-01');
  });
});

// ── toIsoDate ─────────────────────────────────────────────────────────────────
describe('toIsoDate', () => {
  it('YYYY-MM-DD 형식 반환', () => {
    expect(toIsoDate(date(2026, 4, 7))).toBe('2026-04-07');
  });

  it('12월 → 두 자리 월', () => {
    expect(toIsoDate(date(2026, 12, 31))).toBe('2026-12-31');
  });
});

// ── isFuture ──────────────────────────────────────────────────────────────────
describe('isFuture', () => {
  it('오늘 날짜는 미래가 아님', () => {
    const today = new Date();
    expect(isFuture(today)).toBe(false);
  });

  it('과거 날짜는 false', () => {
    expect(isFuture(date(2000, 1, 1))).toBe(false);
  });

  it('미래 날짜는 true', () => {
    expect(isFuture(date(2099, 12, 31))).toBe(true);
  });
});
