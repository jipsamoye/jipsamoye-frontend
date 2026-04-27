/**
 * dateRange.ts — 랭킹 페이지용 날짜 범위 유틸
 *
 * 규칙:
 * - native Date 만 사용 (dayjs/date-fns 추가 X)
 * - 주차 정의: ISO week (월요일 시작)
 * - 모든 end 는 exclusive (표시용 inclusive end 는 호출부에서 -1일 처리)
 * - KST 가정 (서버가 KST 로 응답)
 */

/**
 * date 가 속한 ISO 주 범위를 반환한다.
 * start: 해당 주 월요일 00:00:00
 * end:   start + 7일 (exclusive)
 *
 * 예) 2026-04-26(일) → start=2026-04-20(월), end=2026-04-27
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  // getDay(): 0=일, 1=월, ..., 6=토
  // ISO: 월=1 … 일=7 → 일요일은 7로 취급
  const day = d.getDay(); // 0=일
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 되돌아가는 오프셋
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

/**
 * 지정한 연·월의 범위를 반환한다.
 * start: 해당 월 1일 00:00:00
 * end:   다음 달 1일 (exclusive)
 *
 * 예) 2026-02 → start=2026-02-01, end=2026-03-01 (윤년 자동 처리)
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0); // month는 0-indexed이므로 +1 없이 그대로
  return { start, end };
}

/**
 * 라벨을 계산한다.
 *
 * weekly
 *   - isOngoing=true  → left: "MM.DD", right: "오늘"
 *   - isOngoing=false → left: "MM.DD", right: "MM.DD"
 *
 * monthly
 *   - start 의 연·월을 "YYYY.MM" 으로 반환 (right 는 빈 문자열)
 *   - isOngoing 여부와 관계없이 monthly 라벨은 단일 형태
 *
 * 주의: 라벨의 진실 원천은 서버 응답의 startDate/endDate 이므로
 *       클라이언트 계산 결과를 덮어쓰지 않는다.
 */
export function formatRangeLabel(
  start: Date,
  end: Date,
  type: 'weekly' | 'monthly',
  isOngoing: boolean,
): { left: string; right: string } {
  const pad = (n: number) => String(n).padStart(2, '0');

  if (type === 'monthly') {
    const m = start.getMonth() + 1;
    return { left: `${m}월`, right: '' };
  }

  // weekly: end 는 exclusive → 표시용 inclusive end = end - 1일
  const inclusiveEnd = new Date(end);
  inclusiveEnd.setDate(end.getDate() - 1);

  const fmtDate = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

  const left = fmtDate(start);
  const right = isOngoing ? '오늘' : fmtDate(inclusiveEnd);

  return { left, right };
}

/**
 * URL 쿼리의 date 파라미터(YYYY-MM-DD 또는 null) 를 Date 로 파싱한다.
 * 파싱 실패 또는 null 이면 오늘 날짜를 반환한다.
 */
export function parseDateParam(s: string | null): Date {
  if (!s) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return new Date();
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // 유효하지 않은 날짜(예: 02-30) 는 fallback
  if (isNaN(date.getTime())) return new Date();
  return date;
}

/**
 * Date → "YYYY-MM-DD" 문자열 변환
 */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 해당 날짜가 오늘보다 미래인지 반환한다 (시간 제외, 날짜 기준).
 */
export function isFuture(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return target > today;
}
