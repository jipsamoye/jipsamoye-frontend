'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_SWITCH_ID, getStoredMuted, getStoredSwitchId, getHasPressed,
  markPressed, storeMuted, storeSwitchId, type KeycapSwitchId,
} from '@/lib/keycap';
import { playKeycapSound, warmKeycapSound } from '@/lib/keycapSound';
import KeycapSwitchBar from '@/components/domain/KeycapSwitchBar';

interface PressableKeycapProps {
  /** 키캡 이미지 — DetailImage든 img든 그대로 감싼다 (각 페이지의 폴백 로직 보존) */
  children: React.ReactNode;
  /** 유도 3종(자가 시연·물결·눌러보기 배지). 게시글 상세는 false (기획 확정) */
  nudge?: boolean;
  className?: string;
}

/**
 * AI 키캡 이미지를 실제 키캡처럼 누르게 만드는 래퍼.
 * 액자(버튼, overflow-hidden)는 고정하고 안쪽 이미지만 바닥 기준으로 스쿼시한다.
 * 소리는 pointerdown/up에 down/up 클립 재생 — AudioContext는 첫 제스처에서 lazy 생성.
 * 상태(축·음소거·눌러본 적)는 localStorage만 사용, 백엔드 변경 없음.
 */
export default function PressableKeycap({ children, nudge = false, className = '' }: PressableKeycapProps) {
  const [switchId, setSwitchId] = useState<KeycapSwitchId>(DEFAULT_SWITCH_ID);
  const [muted, setMuted] = useState(false);
  const [isDown, setIsDown] = useState(false);

  // localStorage는 마운트 후에 읽는다 — share 페이지가 서버 컴포넌트라
  // SSR 마크업과 첫 클라이언트 렌더가 일치해야 한다 (hydration mismatch 방지)
  useEffect(() => {
    const stored = getStoredSwitchId();
    setSwitchId(stored);
    setMuted(getStoredMuted());
    warmKeycapSound(stored);
  }, []);

  const pressDown = () => {
    if (isDown) return;
    setIsDown(true);
    if (!muted) playKeycapSound(switchId, 'down');
    if (!getHasPressed()) markPressed();
  };

  const pressUp = () => {
    if (!isDown) return;
    setIsDown(false);
    if (!muted) playKeycapSound(switchId, 'up');
  };

  const handleSelect = (id: KeycapSwitchId) => {
    setSwitchId(id);
    storeSwitchId(id);
    warmKeycapSound(id);
    if (!muted) {
      // 칩 프리뷰 — 실제 누름과 같은 down→up 순서 (프로토타입 튜닝값 130ms)
      playKeycapSound(id, 'down');
      window.setTimeout(() => playKeycapSound(id, 'up'), 130);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    storeMuted(next);
  };

  return (
    <div className={className}>
      <div className="relative">
        <button
          type="button"
          aria-label="키캡 누르기"
          onPointerDown={pressDown}
          onPointerUp={pressUp}
          onPointerLeave={pressUp}
          onPointerCancel={pressUp}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault(); // Space 스크롤·keyup 시점 click 발화 방지
              pressDown();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') pressUp();
          }}
          className="relative block w-full overflow-hidden rounded-2xl cursor-pointer select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {/* 액자(버튼)는 고정, 이 래퍼만 바닥 기준으로 눌린다. reduced-motion이면 스쿼시 없음(소리는 유지) */}
          <div
            className={`origin-bottom motion-safe:transition-transform motion-safe:duration-[110ms] motion-safe:ease-[cubic-bezier(0.2,0.8,0.3,1)] ${
              isDown ? 'motion-safe:scale-y-[0.9] motion-safe:scale-x-[1.04]' : ''
            }`}
          >
            {children}
          </div>
        </button>
      </div>
      <KeycapSwitchBar
        selectedId={switchId}
        muted={muted}
        onSelect={handleSelect}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}
