import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { nowKstString } from '@/lib/utils';
import type { DmMessage, DmRoomEvent, PageResponse } from '@/types/api';

interface UseDmRoomOptions {
  roomId: number | null;
  userNickname: string | null;
  onMessageSent?: (roomId: number, content: string, createdAt: string) => void;
  onUnread?: (roomId: number) => void;
}

interface UseDmRoomResult {
  messages: DmMessage[];
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  loadOlderMessages: () => Promise<void>;
  /** prepend(과거 메시지 로드) 직후 true — 자동 스크롤 억제용 */
  isPrepending: boolean;
  scrollAnchorRef: React.RefObject<HTMLDivElement | null>;
  sendMessage: (content: string) => void;
  retryMessage: (clientMessageId: string) => void;
}

export function useDmRoom({
  roomId,
  userNickname,
  onMessageSent,
  onUnread,
}: UseDmRoomOptions): UseDmRoomResult {
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** prepend(과거 메시지 로드) 직후 한 렌더 사이클 동안 true — 자동 스크롤 억제용 */
  const [isPrepending, setIsPrepending] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  /** 무한스크롤 스크롤 위치 보존용 컨테이너 ref */
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 방 변경 시 메시지 초기화 + REST 로드
  useEffect(() => {
    if (!roomId || !userNickname) {
      setMessages([]);
      setCurrentPage(0);
      setHasOlderMessages(false);
      return;
    }

    setMessages([]);
    setCurrentPage(0);
    setHasOlderMessages(false);

    api
      .get<PageResponse<DmMessage>>(
        `/api/dm/rooms/${roomId}/messages?page=0&size=50`
      )
      .then((res) => {
        const content = res.data?.content ?? [];
        // 백엔드가 최신순으로 내려줄 경우를 대비해 createdAt 오름차순 정렬
        const sorted = [...content].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);
        setHasOlderMessages(res.data?.hasNext ?? false);
        onUnread?.(roomId);
      })
      .catch(() => setMessages([]));
  }, [roomId, userNickname]); // eslint-disable-line react-hooks/exhaustive-deps

  // WS 구독
  useEffect(() => {
    if (!roomId || !userNickname) return;

    const unsubscribe = wsService.onDmRoom(roomId, (event: DmRoomEvent) => {
      if (event.type === 'MESSAGE') {
        const incoming = event.message;
        setMessages((prev) => {
          // clientMessageId 매칭 — 낙관적 메시지를 서버 메시지로 치환
          if (incoming.clientMessageId) {
            const idx = prev.findIndex(
              (m) => m.clientMessageId === incoming.clientMessageId
            );
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...incoming, status: 'sent' };
              return next;
            }
          }
          // id 중복 방지
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, { ...incoming, status: 'sent' }];
        });
        // 방 목록 lastMessage/lastMessageAt 갱신 (서버 시간 기반)
        if (onMessageSent) {
          onMessageSent(roomId, incoming.content, incoming.createdAt);
        }
      } else if (event.type === 'READ') {
        // 내가 보낸 메시지의 readAt 갱신
        setMessages((prev) =>
          prev.map((m) =>
            m.senderNickname === userNickname && !m.readAt
              ? { ...m, readAt: event.readAt }
              : m
          )
        );
      }
    });

    return unsubscribe;
  }, [roomId, userNickname]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 메시지를 GET으로 로드하는 행위 자체가 백엔드에서 읽음 처리를 트리거한다.
  // 백엔드는 조회 시 해당 방의 메시지를 모두 읽음 처리하고 상대에게 READ 이벤트를 브로드캐스트하므로
  // 프론트에서 별도로 read 이벤트를 publish할 필요가 없다.

  /** 위로 스크롤 시 과거 메시지 prepend */
  const loadOlderMessages = useCallback(async () => {
    if (!roomId || !hasOlderMessages || loadingOlder) return;

    setLoadingOlder(true);
    // prepend 시작 — page.tsx의 자동 스크롤 effect가 이 플래그를 보고 억제
    setIsPrepending(true);
    const nextPage = currentPage + 1;

    // 스크롤 위치 보존: 로드 직전 scrollHeight 기억
    const container = scrollAnchorRef.current?.parentElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    try {
      const res = await api.get<PageResponse<DmMessage>>(
        `/api/dm/rooms/${roomId}/messages?page=${nextPage}&size=50`
      );
      const older = [...(res.data?.content ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const deduplicated = older.filter((m) => !existingIds.has(m.id));
        return [...deduplicated, ...prev];
      });
      setCurrentPage(nextPage);
      setHasOlderMessages(res.data?.hasNext ?? false);

      // 스크롤 위치 보정
      requestAnimationFrame(() => {
        if (container) {
          const diff = container.scrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + diff;
        }
        // 스크롤 보정 완료 후 isPrepending 해제
        setIsPrepending(false);
      });
    } catch {
      setIsPrepending(false);
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, hasOlderMessages, loadingOlder, currentPage]);

  /** 메시지 전송 (낙관적 UI) */
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !roomId || !userNickname) return;

      const clientMessageId = crypto.randomUUID();
      const optimistic: DmMessage = {
        id: -Date.now(), // 임시 음수 id
        senderNickname: userNickname,
        content: content.trim(),
        readAt: null,
        // KST-naive 형식으로 생성해 parseServerTime 파이프라인과 일치시킴.
        // 에코 도착 시 서버 createdAt으로 치환되므로 시간 점프 없음.
        createdAt: nowKstString(),
        clientMessageId,
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimistic]);

      const sent = wsService.send('/pub/dm/send', {
        roomId,
        content: content.trim(),
        imageUrl: null,
        clientMessageId,
      });

      if (!sent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
          )
        );
      }
    },
    [roomId, userNickname]
  );

  /** 실패한 메시지 재전송 */
  const retryMessage = useCallback(
    (clientMessageId: string) => {
      if (!roomId || !userNickname) return;
      setMessages((prev) => {
        const target = prev.find((m) => m.clientMessageId === clientMessageId);
        if (!target) return prev;

        const sent = wsService.send('/pub/dm/send', {
          roomId,
          content: target.content,
          imageUrl: null,
          clientMessageId,
        });

        return prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: sent ? 'sending' : 'failed' }
            : m
        );
      });
    },
    [roomId, userNickname]
  );

  return {
    messages,
    hasOlderMessages,
    loadingOlder,
    loadOlderMessages,
    isPrepending,
    scrollAnchorRef,
    sendMessage,
    retryMessage,
  };
}
