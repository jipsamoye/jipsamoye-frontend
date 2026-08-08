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
    <div className="flex items-start gap-2 mt-3.5">
      <button
        type="button"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={muted}
        onClick={onToggleMute}
        className={`flex-none w-9 h-9 rounded-[10px] border border-gray-300 bg-white text-[15px] leading-none transition-opacity ${muted ? 'opacity-45' : ''}`}
      >
        {muted ? '🔇' : '🔊'}
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
