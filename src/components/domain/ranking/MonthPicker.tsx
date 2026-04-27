'use client';

import { useState } from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  useTransitionStyles,
  FloatingPortal,
  offset,
  flip,
  shift,
} from '@floating-ui/react';
import { isFuture } from '@/lib/dateRange';

interface MonthPickerProps {
  /** 현재 선택된 연·월 */
  year: number;
  month: number;
  /** 월 선택 시 콜백 */
  onSelect: (year: number, month: number) => void;
  /** 트리거 역할을 하는 자식 요소 */
  children: React.ReactNode;
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

/**
 * 월 선택 popover
 * - @floating-ui/react 의 useClick 인터렉션 사용
 * - 미래 월은 disabled (흐린 글씨, 클릭 무반응)
 * - 현재 선택된 월: 흰색 배경 + 초록 테두리 + 초록 글씨
 * - 선택 가능한 월: 연회색 배경 + 검은 글씨
 */
export default function MonthPicker({ year, month, onSelect, children }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { open: 160, close: 120 },
    initial: { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
    open: { opacity: 1, transform: 'translateY(0) scale(1)' },
    close: { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
  });

  const { setReference, setFloating } = refs;

  const handleSelect = (m: number) => {
    const firstOfMonth = new Date(pickerYear, m - 1, 1);
    if (isFuture(firstOfMonth)) return; // 미래 월은 선택 불가
    onSelect(pickerYear, m);
    setOpen(false);
  };

  const isMonthDisabled = (m: number) => {
    const firstOfMonth = new Date(pickerYear, m - 1, 1);
    return isFuture(firstOfMonth);
  };

  // 다음 연도의 1월 1일이 미래이면 오른쪽 ▶ 비활성
  const isNextYearDisabled = isFuture(new Date(pickerYear + 1, 0, 1));

  return (
    <>
      <span ref={setReference} {...getReferenceProps()} className="inline-flex cursor-pointer">
        {children}
      </span>

      {isMounted && (
        <FloatingPortal>
          <div
            ref={setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50"
          >
            <div
              style={transitionStyles}
              className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-64"
            >
              {/* 연도 네비게이션: ◀ YYYY ▶ */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                  aria-label="이전 연도"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-gray-900">{pickerYear}</span>
                <button
                  onClick={() => setPickerYear((y) => y + 1)}
                  disabled={isNextYearDisabled}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="다음 연도"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>

              {/* 3 × 4 그리드: 1월 ~ 12월 */}
              <div className="grid grid-cols-3 gap-2">
                {MONTH_LABELS.map((label, i) => {
                  const m = i + 1;
                  const isSelected = pickerYear === year && m === month;
                  const disabled = isMonthDisabled(m);
                  return (
                    <button
                      key={m}
                      onClick={() => handleSelect(m)}
                      disabled={disabled}
                      className={`py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-white border border-green-500 text-green-600 font-medium'
                          : disabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
