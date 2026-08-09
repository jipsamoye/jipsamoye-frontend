'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SWITCH_ID, getStoredMuted, getStoredSwitchId, getHasPressed,
  markPressed, storeMuted, storeSwitchId, type KeycapSwitchId,
} from '@/lib/keycap';
import { playKeycapSound, warmKeycapSound } from '@/lib/keycapSound';
import KeycapSwitchBar from '@/components/domain/KeycapSwitchBar';
import AiKeycapBadge from '@/components/common/AiKeycapBadge';

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
  const [nudgeActive, setNudgeActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [demoPressing, setDemoPressing] = useState(false);
  // 뗄 때 재생하는 릴리즈 애니메이션 — 탭처럼 짧은 누름에서는 렌더 프레임이 없어
  // 트랜지션이 생성되지 않으므로 키프레임으로 눌림→복귀를 보장한다.
  // releaseTick: 재생할 때마다 증가하는 단조 카운터. 홀짝으로 키프레임 이름을 교대해
  //   같은 프레임에 클래스가 갈아끼워져도 브라우저가 확실히 재시작하게 한다.
  //   (animationend에서 0으로 되돌리면 다음 릴리즈가 같은 이름이 돼 연타 재시작이 깨진다)
  // releasePlaying: 지금 재생 중인가 — animationend에서만 꺼진다.
  const [releaseTick, setReleaseTick] = useState(0);
  const [releasePlaying, setReleasePlaying] = useState(false);
  // 칩 프리뷰의 up 타이머 — 연타·언마운트 시 앞선 예약을 취소해 소리가 겹치지 않게 한다
  const previewUpTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(previewUpTimer.current), []);

  // localStorage는 마운트 후에 읽는다 — share 페이지가 서버 컴포넌트라
  // SSR 마크업과 첫 클라이언트 렌더가 일치해야 한다 (hydration mismatch 방지)
  useEffect(() => {
    const stored = getStoredSwitchId();
    const storedMuted = getStoredMuted();
    setSwitchId(stored);
    setMuted(storedMuted);
    // 음소거 상태면 어차피 재생하지 않으니 자산도 받지 않는다 (불필요한 fetch 절약)
    if (!storedMuted) warmKeycapSound(stored);
    // 유도는 마운트 후에만 켠다 — SSR 마크업(유도 없음)과 일치시키고,
    // 이미 눌러본 방문자에게 배지가 깜빡 떴다 사라지는 것도 막는다
    if (nudge && !getHasPressed()) setNudgeActive(true);
    if (typeof window.matchMedia === 'function') {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, [nudge]);

  // 자가 시연 — 등장 0.9초·4.2초 뒤 각 1회 (프로토타입 튜닝값). 소리 없음(자동재생 정책상 못 냄)
  useEffect(() => {
    if (!nudgeActive || reducedMotion) return;
    const timers = [900, 4200].map((ms) => window.setTimeout(() => setDemoPressing(true), ms));
    return () => timers.forEach(clearTimeout);
  }, [nudgeActive, reducedMotion]);

  const pressDown = () => {
    if (isDown) return;
    setIsDown(true);
    if (!muted) playKeycapSound(switchId, 'down');
    // 화면상 유도 3종은 누르는 즉시 사라진다 (영구 기록은 취소되지 않은 up에서)
    setNudgeActive(false);
    setDemoPressing(false);
    // 재생 중이던 릴리즈는 클래스가 빠지며 중단된다 — 브라우저는 animationcancel만 쏘고
    // animationend는 영영 오지 않으므로 여기서 꺼야 한다. 안 끄면 이 누름이 pointercancel로
    // 끝났을 때 !isDown 조건이 되살아나 릴리즈가 재부착된다(스크롤 중 키캡이 튀어오름).
    // tick은 건드리지 않는다 — 홀짝 교대가 깨진다.
    setReleasePlaying(false);
  };

  /**
   * @param cancelled pointercancel로 끝난 누름 — 모바일에서 이미지 위를 스크롤하면
   *   pointerdown→pointercancel만 오는데, 이걸 기록하면 유도 3종이 조용히 소진된다.
   *   소리·원복은 그대로 하되 영구 기록만 건너뛴다. pointerleave·blur는 정상 up 취급.
   */
  const pressUp = (cancelled = false) => {
    if (!isDown) return;
    setIsDown(false);
    if (!muted) playKeycapSound(switchId, 'up');
    // 한 번이라도 끝까지 누르면 유도 3종은 영구 소멸 (다음 방문 포함 — localStorage)
    if (!cancelled && !getHasPressed()) markPressed();
    // 시각 릴리즈 — cancelled(스크롤)면 재생하지 않고, reduced-motion이면
    // 애니메이션이 실행되지 않아 animationend가 안 와 상태가 갇히므로 JS에서도 가드
    if (!cancelled && !reducedMotion) {
      setReleaseTick((n) => n + 1);
      setReleasePlaying(true);
    }
  };

  const handleSelect = (id: KeycapSwitchId) => {
    setSwitchId(id);
    storeSwitchId(id);
    warmKeycapSound(id);
    if (!muted) {
      // 칩 프리뷰 — 실제 누름과 같은 down→up 순서 (프로토타입 튜닝값 130ms)
      playKeycapSound(id, 'down');
      clearTimeout(previewUpTimer.current);
      previewUpTimer.current = window.setTimeout(() => playKeycapSound(id, 'up'), 130);
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
          onPointerUp={() => pressUp()}
          onPointerLeave={() => pressUp()}
          onPointerCancel={() => pressUp(true)}
          onBlur={() => pressUp()} // 키보드로 누른 채 탭 이동하면 keyup이 안 와 눌린 상태로 갇힌다
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
          {/* 액자(버튼)는 고정, 이 래퍼만 바닥 기준으로 눌린다. reduced-motion이면 스쿼시 없음(소리는 유지)
              [&_img]:[-webkit-user-drag:none] — 누른 채 움직이면 데스크톱에서 고스트 이미지가
              딸려 나오며 pointercancel로 촉감이 깨진다. 래퍼에 pointer-events-none은 금지(iOS 롱프레스 저장 죽음) */}
          <div
            // 'keycapRelease'는 'keycapReleaseAlt'의 부분 문자열이라 완전 일치로만 가른다.
            // 릴리즈가 아닌 end(자가 시연·이름 없는 합성 이벤트)는 시연 종료로 취급한다.
            onAnimationEnd={(e) => {
              if (e.animationName === 'keycapRelease' || e.animationName === 'keycapReleaseAlt')
                setReleasePlaying(false);
              else setDemoPressing(false);
            }}
            className={`origin-bottom [&_img]:[-webkit-user-drag:none] motion-safe:transition-transform motion-safe:duration-[110ms] motion-safe:ease-[cubic-bezier(0.2,0.8,0.3,1)] ${
              isDown ? 'motion-safe:scale-y-[0.9] motion-safe:scale-x-[1.04]' : ''
            } ${
              demoPressing
                ? 'motion-safe:animate-[keycapNudge_380ms_cubic-bezier(0.2,0.8,0.3,1)]'
                : !isDown && releasePlaying
                  ? releaseTick % 2
                    ? 'motion-safe:animate-[keycapRelease_150ms_cubic-bezier(0.2,0.8,0.3,1)]'
                    : 'motion-safe:animate-[keycapReleaseAlt_150ms_cubic-bezier(0.2,0.8,0.3,1)]'
                  : ''
            }`}
          >
            {children}
          </div>
          {/* 물결 — 첫 누름까지 계속. reduced-motion이면 정지된 원만 남으니 아예 렌더하지 않는다 */}
          {nudgeActive && !reducedMotion && (
            <span
              aria-hidden
              data-testid="keycap-ripple"
              className="absolute left-1/2 top-1/2 -ml-12 -mt-12 w-24 h-24 rounded-full border-[3px] border-white/95 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.18),inset_0_0_0_1px_rgba(0,0,0,0.18)] animate-[keycapRipple_1.9s_ease-out_infinite]"
            />
          )}
        </button>
        {/* 바깥 div가 중앙 정렬, 안쪽 배지가 둥둥 — 같은 요소에 두 transform을 걸면
            badgeFloat의 translateY가 정렬 translateX를 덮어써 왼쪽으로 튕겨나간다 (제약 4) */}
        {nudgeActive && (
          <div className="absolute left-1/2 bottom-3 -translate-x-1/2 pointer-events-none">
            <AiKeycapBadge label="눌러보기" floating />
          </div>
        )}
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
