'use client';

import { KEYCAP_SWITCHES, type KeycapSwitchId } from '@/lib/keycap';

interface KeycapSwitchBarProps {
  selectedId: KeycapSwitchId;
  muted: boolean;
  onSelect: (id: KeycapSwitchId) => void;
  onToggleMute: () => void;
}

/**
 * 축 선택 칩 + 음소거 버튼. 상태는 PressableKeycap이 소유한다.
 * 칩은 가로 스크롤 금지 — 모바일 375px에서 두 줄(4+3)로 줄바꿈 (기획 확정).
 * 소리가 기본 켜짐이므로 음소거 버튼은 항상 맨 앞에 보인다 (접근성 요구).
 */
export default function KeycapSwitchBar({ selectedId, muted, onSelect, onToggleMute }: KeycapSwitchBarProps) {
  return (
    // select-none: 키캡을 꾹 누르며 놀다 손이 칩에 닿으면 iOS 롱프레스가 칩 라벨에서
    // 텍스트 선택을 시작해 파란 선택 밴드·복사 메뉴가 뜬다. 라벨은 복사할 이유가 없는 텍스트.
    <div className="flex items-start gap-2 mt-3.5 select-none">
      <button
        type="button"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={muted}
        onClick={onToggleMute}
        className="flex-none flex items-center justify-center w-9 h-9 rounded-[10px] border border-gray-300 bg-white text-gray-700"
      >
        {/* 이모지는 플랫폼 폰트에 따라 뭉개져 보여 heroicons solid로 교체 */}
        {muted ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            {/* 스피커는 연하게 깔고, 아이콘 전체를 가로지르는 굵은 빨간 X로 "소리 안 남"을 한눈에 */}
            <path className="opacity-40" d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
            <path className="stroke-red-500" fill="none" strokeWidth="2.5" strokeLinecap="round" d="M5 5 19 19M19 5 5 19" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
            <path d="M18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
            <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {KEYCAP_SWITCHES.map((sw) => (
          <button
            key={sw.id}
            type="button"
            aria-pressed={sw.id === selectedId}
            onClick={() => onSelect(sw.id)}
            className={`flex items-center gap-1.5 h-9 px-2.5 rounded-[10px] border text-[13px] whitespace-nowrap transition-colors ${
              sw.id === selectedId
                ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span aria-hidden className={`w-2 h-2 rounded-full ${sw.dotClass}`} />
            {sw.label}
          </button>
        ))}
      </div>
    </div>
  );
}
