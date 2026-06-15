import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { DmRoom } from '@/types/api';

interface UseDmRoomsResult {
  rooms: DmRoom[];
  setRooms: React.Dispatch<React.SetStateAction<DmRoom[]>>;
  resetUnread: (roomId: number) => void;
  updateLastMessage: (roomId: number, content: string) => void;
  applyServerLastMessage: (roomId: number, content: string, at: string) => void;
  /**
   * 사용자별 채널(/user/sub/dm/rooms)에서 온 방 업데이트를 목록에 반영(버그②).
   * @param payload 서버가 내려준 방 스냅샷(DmRoom 형태)
   * @param openRoomId 현재 열려 있는 방 id — 일치하면 unread를 0으로 강제(읽음 흐름 충돌 방지)
   */
  applyRoomUpdate: (payload: DmRoom, openRoomId: number | null) => void;
}

export function useDmRooms(userNickname: string | null): UseDmRoomsResult {
  const [rooms, setRooms] = useState<DmRoom[]>([]);

  useEffect(() => {
    if (!userNickname) return;
    api
      .get<DmRoom[]>('/api/dm/rooms')
      .then((res) => setRooms(res.data ?? []))
      .catch(() => setRooms([]));
  }, [userNickname]);

  /** 방 열 때 unreadCount를 0으로 리셋 */
  const resetUnread = useCallback((roomId: number) => {
    setRooms((prev) =>
      prev.map((r) => (r.roomId === roomId ? { ...r, unreadCount: 0 } : r))
    );
  }, []);

  /**
   * 낙관적 lastMessage 갱신 — 시간은 건드리지 않음.
   * 정확한 서버 시간은 applyServerLastMessage로 에코 도착 시 반영.
   */
  const updateLastMessage = useCallback((roomId: number, content: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.roomId === roomId ? { ...r, lastMessage: content } : r))
    );
  }, []);

  /** 서버 에코의 createdAt으로 lastMessageAt을 갱신 */
  const applyServerLastMessage = useCallback(
    (roomId: number, content: string, at: string) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.roomId === roomId ? { ...r, lastMessage: content, lastMessageAt: at } : r
        )
      );
    },
    []
  );

  /**
   * 사용자별 채널 payload를 목록에 반영(버그②).
   * - 기존 방: lastMessage/lastMessageAt/unreadCount 갱신 + 최상단 정렬.
   * - 신규 방: 목록 최상단에 삽입.
   * - 현재 열려 있는 방이면 unreadCount=0 강제(방 입장 읽음 흐름과 충돌 방지).
   */
  const applyRoomUpdate = useCallback(
    (payload: DmRoom, openRoomId: number | null) => {
      const isOpen = openRoomId != null && payload.roomId === openRoomId;
      setRooms((prev) => {
        const existing = prev.find((r) => r.roomId === payload.roomId);
        const merged: DmRoom = existing
          ? {
              ...existing,
              lastMessage: payload.lastMessage,
              lastMessageAt: payload.lastMessageAt,
              unreadCount: isOpen ? 0 : payload.unreadCount,
              // 프로필 정보는 서버 값 우선, 누락 시 기존 값 유지(헤더/목록 깜빡임 방지)
              otherUserNickname: payload.otherUserNickname || existing.otherUserNickname,
              otherUserProfileImageUrl:
                payload.otherUserProfileImageUrl ?? existing.otherUserProfileImageUrl,
            }
          : { ...payload, unreadCount: isOpen ? 0 : payload.unreadCount };
        const rest = prev.filter((r) => r.roomId !== payload.roomId);
        return [merged, ...rest];
      });
    },
    []
  );

  return {
    rooms,
    setRooms,
    resetUnread,
    updateLastMessage,
    applyServerLastMessage,
    applyRoomUpdate,
  };
}
