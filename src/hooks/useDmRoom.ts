import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { nowKstString } from '@/lib/utils';
import type { DmMessage, DmRoomEvent, PageResponse } from '@/types/api';

/** 전송 후 서버 에코 대기 타임아웃 — 초과 시 status='failed'로 전환 (M-7) */
const SEND_TIMEOUT_MS = 8000;

interface UseDmRoomOptions {
  roomId: number | null;
  /** draft(roomId=null) 상태에서 첫 메시지를 보낼 상대 닉네임 */
  targetNickname?: string | null;
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
  targetNickname,
  userNickname,
  onMessageSent,
  onUnread,
}: UseDmRoomOptions): UseDmRoomResult {
  const [messages, setMessages] = useState<DmMessage[]>([]);
  // messages 미러 ref — retryMessage가 setState 업데이터 밖에서 대상 메시지를 찾기 위해 사용.
  // (업데이터 안에서 send/타이머 같은 부수효과를 다루면 StrictMode 이중 실행·지연 평가 문제)
  const messagesRef = useRef<DmMessage[]>([]);
  messagesRef.current = messages;
  const [currentPage, setCurrentPage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** prepend(과거 메시지 로드) 직후 한 렌더 사이클 동안 true — 자동 스크롤 억제용 */
  const [isPrepending, setIsPrepending] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  /** 무한스크롤 스크롤 위치 보존용 컨테이너 ref */
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  /**
   * 전송 타임아웃 타이머 — clientMessageId별로 보관 (M-7).
   * send 후 서버 에코가 일정 시간 내 도착하지 않으면 status='failed'로 전환한다.
   * 에코 도착(치환) 시 clearSendTimeout으로 해제.
   */
  const sendTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearSendTimeout = useCallback((clientMessageId: string) => {
    const timer = sendTimeoutsRef.current.get(clientMessageId);
    if (timer) {
      clearTimeout(timer);
      sendTimeoutsRef.current.delete(clientMessageId);
    }
  }, []);

  /** send 후 호출 — SEND_TIMEOUT_MS 내 에코 미수신 시 해당 메시지를 failed로 전환 */
  const armSendTimeout = useCallback(
    (clientMessageId: string) => {
      clearSendTimeout(clientMessageId);
      const timer = setTimeout(() => {
        sendTimeoutsRef.current.delete(clientMessageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId && m.status === 'sending'
              ? { ...m, status: 'failed' }
              : m
          )
        );
      }, SEND_TIMEOUT_MS);
      sendTimeoutsRef.current.set(clientMessageId, timer);
    },
    [clearSendTimeout]
  );

  // 언마운트/방 변경 시 모든 전송 타이머 정리 (지연 setState로 인한 누수 방지)
  useEffect(() => {
    const timers = sendTimeoutsRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [roomId]);

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
              // 에코 도착 → 전송 타임아웃 해제 (M-7)
              clearSendTimeout(incoming.clientMessageId);
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
        // 상대가 보낸 메시지를 방에서 실시간 수신 → 즉시 읽음 처리 트리거.
        // 이래야 상대 쪽 "1"(안읽음 표시)이 바로 사라진다(버그③).
        // 내가 보낸 메시지의 에코는 read 불필요.
        if (incoming.senderNickname !== userNickname) {
          wsService.send('/pub/dm/read', { roomId });
        }
      } else if (event.type === 'READ') {
        // 내가 읽은 read의 에코(readerNickname === 나)는 무시한다.
        // 버그③로 수신 즉시 /pub/dm/read를 publish하므로 내 read 에코가 되돌아올 수 있는데,
        // 이를 그대로 반영하면 "상대가 읽었다"가 아닌 내 read로 내 메시지가 잘못 읽음 처리됨.
        // 상대(readerNickname !== 나)가 읽은 경우에만 내 메시지의 readAt을 갱신.
        if (event.readerNickname !== userNickname) {
          setMessages((prev) =>
            prev.map((m) =>
              m.senderNickname === userNickname && !m.readAt
                ? { ...m, readAt: event.readAt }
                : m
            )
          );
        }
      }
    });

    return unsubscribe;
  }, [roomId, userNickname]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 읽음 처리는 두 경로로 트리거된다.
  //  1) 방 입장 시 GET /messages — 백엔드가 조회 시점에 미읽음 메시지를 읽음 처리(보완용).
  //  2) 방에 머무는 동안 상대 메시지를 실시간 수신할 때 — 위 MESSAGE 핸들러에서
  //     `/pub/dm/read`를 즉시 publish(버그③). GET만으로는 이미 방에 있는 사용자가
  //     새 메시지를 받아도 읽음 처리가 안 돼 상대 쪽 "1"이 남아 있었음.

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
      // 실제 방(roomId) 또는 draft(targetNickname) 둘 중 하나는 있어야 전송 가능.
      if (!content.trim() || !userNickname || (!roomId && !targetNickname)) return;

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

      // draft면 roomId=null + targetNickname으로 전송(백엔드가 방 생성).
      // 첫 메시지 후 /user/sub/dm/rooms로 새 roomId가 오면 page에서 draft→실제 방 전환.
      const sent = wsService.send('/pub/dm/send', {
        roomId: roomId ?? null,
        targetNickname: roomId ? null : (targetNickname ?? null),
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
      } else {
        // 전송 성공 — 에코 대기 타임아웃 시작 (미수신 시 failed 전환, M-7)
        armSendTimeout(clientMessageId);
      }
    },
    [roomId, targetNickname, userNickname, armSendTimeout]
  );

  /** 실패한 메시지 재전송 */
  const retryMessage = useCallback(
    (clientMessageId: string) => {
      if (!userNickname || (!roomId && !targetNickname)) return;
      // 대상 메시지를 ref(미러)에서 찾아 부수효과(send/타이머)를 updater 밖에서 처리한다.
      const target = messagesRef.current.find(
        (m) => m.clientMessageId === clientMessageId
      );
      if (!target) return;

      const resent = wsService.send('/pub/dm/send', {
        roomId: roomId ?? null,
        targetNickname: roomId ? null : (targetNickname ?? null),
        content: target.content,
        imageUrl: null,
        clientMessageId,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: resent ? 'sending' : 'failed' }
            : m
        )
      );

      if (resent) {
        // 재전송 성공 — 에코 대기 타임아웃 재시작 (M-7)
        armSendTimeout(clientMessageId);
      } else {
        clearSendTimeout(clientMessageId);
      }
    },
    [roomId, targetNickname, userNickname, armSendTimeout, clearSendTimeout]
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
