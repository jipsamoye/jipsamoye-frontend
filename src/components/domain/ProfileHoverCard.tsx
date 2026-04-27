'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFloating,
  useHover,
  useDismiss,
  useRole,
  useInteractions,
  useTransitionStyles,
  FloatingPortal,
  offset,
  flip,
  shift,
  safePolygon,
} from '@floating-ui/react';
import { api } from '@/lib/api';
import { User } from '@/types/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import ProfileHoverCardContent from '@/components/domain/ProfileHoverCardContent';

interface ProfileHoverCardProps {
  nickname: string;
  children: ReactNode;
}

/**
 * 카드 등의 프로필 영역을 감싸는 hover popover.
 * - 데스크탑(hover-capable)에서만 동작. 터치 디바이스는 그대로 통과.
 * - 250ms hover 지연 후 GET /api/users/{nickname} 호출 → 항상 최신값.
 * - 본인: "프로필 편집" 단일 버튼. 타인: 구독하기 + 메시지.
 * - safePolygon 으로 트리거→popover 사이 마우스 이동 시 닫히지 않음.
 */
export default function ProfileHoverCard({ nickname, children }: ProfileHoverCardProps) {
  const router = useRouter();
  const { user: currentUser } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [following, setFollowing] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);

  // hover-capable device(데스크탑 마우스)에서만 popover 활성화. 터치/모바일은 통과.
  // 마운트 1회 + matchMedia 변경 구독이라 cascade 아님.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoverEnabled(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHoverEnabled(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const hover = useHover(context, {
    enabled: hoverEnabled,
    delay: { open: 250, close: 100 },
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { open: 180, close: 120 },
    initial: { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
    open: { opacity: 1, transform: 'translateY(0) scale(1)' },
    close: { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
  });

  // 호버로 열릴 때 데이터 로드. 컴포넌트 인스턴스 단위로 한 번만 fetch
  // (같은 카드를 페이지 떠나지 않고 두 번 호버해도 재fetch 안 함, profile state 재사용).
  useEffect(() => {
    if (!open || profile) return;
    let cancelled = false;
    api.get<User>(`/api/users/${encodeURIComponent(nickname)}`, { silent: true })
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data);
      })
      .catch(() => { /* 무시: 비로그인이거나 네트워크 일시 오류 */ });
    return () => { cancelled = true; };
  }, [open, nickname, profile]);

  const isMe = !!currentUser && currentUser.nickname === nickname;

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post<boolean>(`/api/users/${encodeURIComponent(nickname)}/follow`);
      setFollowing(res.data);
      setProfile((prev) => prev ? {
        ...prev,
        followerCount: prev.followerCount + (res.data ? 1 : -1),
      } : prev);
    } catch { /* 401이면 api 클라이언트가 토스트 + unauthorizedHandler 처리 */ }
  };

  const handleMessage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) return;
    try {
      await api.post(`/api/dm/rooms?targetNickname=${encodeURIComponent(nickname)}`);
    } catch { /* ignore */ }
    router.push('/dm');
  };

  const handleEditProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/users/${encodeURIComponent(nickname)}`);
  };

  // Floating UI는 callback ref(setReference/setFloating)를 반환하므로 React 19의
  // react-hooks/refs 룰이 잡는 ".current 접근" 패턴이 아님 — 안전한 false positive.
  const { setReference, setFloating } = refs;

  return (
    <>
      <span ref={setReference} {...getReferenceProps()} className="inline-flex">
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
            <div style={transitionStyles}>
              <ProfileHoverCardContent
                nickname={nickname}
                profile={profile}
                following={following}
                isMe={isMe}
                onFollow={handleFollow}
                onMessage={handleMessage}
                onEditProfile={handleEditProfile}
              />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
