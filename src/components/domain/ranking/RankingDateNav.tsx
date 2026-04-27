'use client';

import MonthPicker from '@/components/domain/ranking/MonthPicker';
import { formatRangeLabel } from '@/lib/dateRange';

interface RankingDateNavProps {
  type: 'weekly' | 'monthly';
  /** 서버 응답의 startDate (YYYY-MM-DD) */
  startDate: string;
  /** 서버 응답의 endDate (YYYY-MM-DD, UI 표시용 inclusive end) */
  endDate: string;
  /** 진행 중인 기간 여부 — true 이면 ▶ disabled, right 라벨 "오늘" */
  isOngoing: boolean;
  /** ▶ 화살표 활성 여부 (isOngoing=true 이면 false) */
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** monthly 일 때 월 선택 콜백 */
  onSelectMonth: (year: number, month: number) => void;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * ◀ 라벨 ▶ 날짜 네비게이션 컨테이너
 * - weekly: "MM.DD - MM.DD" 또는 "MM.DD - 오늘"
 * - monthly: "X월" + chevron-down (클릭 시 MonthPicker popover 오픈)
 */
export default function RankingDateNav({
  type,
  startDate,
  endDate,
  isOngoing,
  canGoNext,
  onPrev,
  onNext,
  onSelectMonth,
}: RankingDateNavProps) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  // endDate 는 서버가 inclusive end 로 내려주므로 exclusive 변환 없이 라벨 계산
  // formatRangeLabel 의 end 가 exclusive 이므로 +1일 해서 전달
  const exclusiveEnd = new Date(end);
  exclusiveEnd.setDate(end.getDate() + 1);

  const { left, right } = formatRangeLabel(start, exclusiveEnd, type, isOngoing);

  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;

  const weeklyLabel = (
    <span className="text-sm font-semibold text-gray-900">
      {left}
      {right && (
        <>
          <span className="mx-1 text-gray-400">-</span>
          <span className={isOngoing ? 'text-green-600' : ''}>{right}</span>
        </>
      )}
    </span>
  );

  const monthlyTrigger = (
    <span className="inline-flex items-center gap-1 cursor-pointer text-sm font-semibold text-gray-900 hover:text-green-600 transition-colors">
      {left}
      {/* chevron-down — 월 선택 가능 시각 단서 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9l7.5 6.75L19.5 9" />
      </svg>
    </span>
  );

  return (
    <div className="flex items-center justify-center w-full mb-6">
      <div className="flex items-center gap-4">
        {/* ◀ 이전 */}
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
          aria-label="이전 기간"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* 라벨 — monthly 이면 MonthPicker 트리거 */}
        {type === 'monthly' ? (
          <MonthPicker year={startYear} month={startMonth} onSelect={onSelectMonth}>
            <span className="min-w-[80px] text-center">
              {monthlyTrigger}
            </span>
          </MonthPicker>
        ) : (
          <span className="min-w-[140px] text-center">{weeklyLabel}</span>
        )}

        {/* ▶ 다음 */}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="다음 기간"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
