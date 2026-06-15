'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DmRoomResolve } from '@/types/api';

/**
 * 프로필(페이지/호버 카드)의 "💬 메시지" 버튼에서 공통으로 쓰는 DM 열기 훅.
 *
 * - resolve: POST /api/dm/rooms?targetNickname= → 기존에 대화한 방이면 roomId, 없으면 roomId=null(draft).
 * - 기존 방: /dm?room={id} 로 이동.
 * - draft: /dm?draft={nickname}&img={url} 로 이동.
 *   img는 아직 방이 없는 상대와의 draft 대화창 헤더 아바타를 "즉시" 채우기 위함.
 *   resolve 응답에 이미지가 없으면 호출부가 이미 들고 있는 profileImageUrl로 fallback → 백엔드 의존 없음.
 * - 실패: /dm 으로 fallback.
 */
export function useOpenDm() {
  const router = useRouter();

  const openDm = useCallback(
    async (nickname: string, profileImageUrl: string | null) => {
      try {
        const res = await api.post<DmRoomResolve>(
          `/api/dm/rooms?targetNickname=${encodeURIComponent(nickname)}`
        );
        if (res.data?.roomId != null) {
          router.push(`/dm?room=${res.data.roomId}`);
        } else {
          const img = res.data?.otherUserProfileImageUrl ?? profileImageUrl ?? '';
          const imgQuery = img ? `&img=${encodeURIComponent(img)}` : '';
          router.push(`/dm?draft=${encodeURIComponent(nickname)}${imgQuery}`);
        }
      } catch {
        router.push('/dm');
      }
    },
    [router]
  );

  return openDm;
}
