'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DmRoomResolve } from '@/types/api';

/**
 * 프로필(페이지/호버 카드)의 "💬 메시지" 버튼에서 공통으로 쓰는 DM 열기 훅.
 *
 * - resolve: POST /api/dm/rooms?targetNickname=&create=true → 방이 없으면 즉시 생성(선생성).
 *   실제 roomId로 대화창을 열어 구독이 첫 전송보다 항상 먼저 성립한다(첫 메시지 에코 유실 방지).
 * - 이동: /dm?room={id}&nick={nickname}&img={url} — nick/img는 방이 아직 목록에 없을 때
 *   (빈 방은 목록에서 숨김) 헤더 아바타·닉네임을 즉시 채우기 위함.
 * - 실패 또는 roomId=null(구 백엔드): /dm 으로 fallback.
 */
export function useOpenDm() {
  const router = useRouter();

  const openDm = useCallback(
    async (nickname: string, profileImageUrl: string | null) => {
      try {
        const res = await api.post<DmRoomResolve>(
          `/api/dm/rooms?targetNickname=${encodeURIComponent(nickname)}&create=true`
        );
        if (res.data?.roomId != null) {
          const img = res.data.otherUserProfileImageUrl ?? profileImageUrl ?? '';
          const imgQuery = img ? `&img=${encodeURIComponent(img)}` : '';
          router.push(`/dm?room=${res.data.roomId}&nick=${encodeURIComponent(nickname)}${imgQuery}`);
        } else {
          router.push('/dm');
        }
      } catch {
        router.push('/dm');
      }
    },
    [router]
  );

  return openDm;
}
