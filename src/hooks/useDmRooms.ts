import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { DmRoom } from '@/types/api';

interface UseDmRoomsResult {
  rooms: DmRoom[];
  setRooms: React.Dispatch<React.SetStateAction<DmRoom[]>>;
  resetUnread: (roomId: number) => void;
  updateLastMessage: (roomId: number, content: string) => void;
  applyServerLastMessage: (roomId: number, content: string, at: string) => void;
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

  return { rooms, setRooms, resetUnread, updateLastMessage, applyServerLastMessage };
}
