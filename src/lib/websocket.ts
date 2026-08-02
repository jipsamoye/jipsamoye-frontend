import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { showToast } from '@/components/common/Toast';
import { api } from '@/lib/api';
import type { DmMessage, DmRoomEvent } from '@/types/api';

type MessageHandler = (data: unknown) => void;
type DmRoomEventHandler = (event: DmRoomEvent) => void;

type Channel = 'notification' | 'chat' | 'dm-rooms';

/** CONNECTED에 도달하지 못한 연속 소켓 절단 횟수가 이 값에 달하면 세션 프로브 */
const CONSECUTIVE_FAILURE_THRESHOLD = 5;

class WebSocketService {
  private client: Client | null = null;
  private channelHandlers: Map<Channel, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  /** 연결 전 또는 재연결 시 재구독을 위해 DM 방 핸들러 기억 */
  private pendingDmRooms: Map<number, DmRoomEventHandler> = new Map();
  private userNickname: string | null = null;
  private connected = false;
  private authRejected = false;
  /** 최초 연결과 재연결 구분 — 명시적 disconnect 시 리셋 */
  private hasConnectedOnce = false;
  private reconnectHandlers: Set<() => void> = new Set();
  private consecutiveFailures = 0;
  private probing = false;

  connect(userNickname: string): void {
    if (this.connected && this.userNickname === userNickname) return;

    this.disconnect();
    this.userNickname = userNickname;
    this.authRejected = false;
    this.consecutiveFailures = 0;

    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'https://api.jipsamoye.com';

    this.client = new Client({
      webSocketFactory: () =>
        new SockJS(`${baseUrl}/ws`, null, {
          transportOptions: {
            'xhr-streaming': { withCredentials: true },
            'xhr-polling': { withCredentials: true },
          },
        } as ConstructorParameters<typeof SockJS>[2]),
      reconnectDelay: 3000,
      onConnect: () => {
        this.connected = true;
        this.consecutiveFailures = 0;
        this.subscribeChannel('notification', '/user/sub/notifications');
        this.subscribeChannel('chat', '/sub/chat/room');
        // 사용자별 DM 방 목록 채널 — 방 밖(목록 화면)에서도 새 메시지/방 실시간 반영
        this.subscribeChannel('dm-rooms', '/user/sub/dm/rooms');
        // 이미 등록된 DM 방 구독 전부 복구 (연결 전 등록 + 재연결 시)
        this.pendingDmRooms.forEach((handler, roomId) => {
          this.subscribeDmRoomNow(roomId, handler);
        });
        // 재연결이면(최초 연결 제외) 재구독 완료 후 재동기화 이벤트 발화
        if (this.hasConnectedOnce) {
          this.reconnectHandlers.forEach((handler) => handler());
        }
        this.hasConnectedOnce = true;
      },
      onDisconnect: () => {
        this.connected = false;
        // 구독 참조 초기화 (재연결 시 onConnect에서 재구독)
        this.subscriptions.clear();
      },
      onWebSocketClose: () => {
        // onDisconnect는 정상 종료(DISCONNECT 프레임)에만 발화 —
        // heartbeat 강제 종료·네트워크 순단 등 모든 소켓 절단은 여기서 정리
        this.connected = false;
        this.subscriptions.clear();
        // 세션(2h) 만료 시 SockJS 핸드셰이크가 403 거부 — STOMP 이전 단계라
        // onStompError에 안 걸리고 조용히 무한 재시도하므로 연속 실패를 세어 판별
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
          void this.probeSession();
        }
      },
      onStompError: (frame) => {
        const message = frame.headers['message'] ?? '';
        if (/unauthori[sz]ed|forbidden|401|403/i.test(message)) {
          this.authRejected = true;
          showToast('로그인하고 이용해 주세요');
          this.disconnect();
        }
      },
    });

    try {
      this.client.activate();
    } catch {
      // ignore
    }
  }

  private subscribeChannel(channel: Channel, destination: string): void {
    if (!this.client || !this.connected) return;

    const sub = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const data = JSON.parse(message.body);
        const handlers = this.channelHandlers.get(channel);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch {
        // parse error
      }
    });

    this.subscriptions.set(destination, sub);
  }

  /** 실제 STOMP subscribe 수행 (connected 상태에서만 호출) */
  private subscribeDmRoomNow(roomId: number, handler: DmRoomEventHandler): void {
    if (!this.client || !this.connected) return;
    const destination = `/sub/dm/room/${roomId}`;
    // 이미 구독 중이면 해제 후 재구독 (재연결 시 중복 방지)
    const existing = this.subscriptions.get(destination);
    if (existing) {
      try { existing.unsubscribe(); } catch { /* ignore */ }
    }
    const sub = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const raw = JSON.parse(message.body) as Record<string, unknown>;
        let event: DmRoomEvent;
        // roomId는 이벤트 payload에 포함됨. 누락 시 구독한 방 id로 폴백.
        const evtRoomId = typeof raw.roomId === 'number' ? raw.roomId : roomId;
        if (raw.type === 'READ') {
          event = {
            type: 'READ',
            roomId: evtRoomId,
            readerNickname: raw.readerNickname as string,
            readAt: raw.readAt as string,
          };
        } else if (raw.type === 'MESSAGE') {
          event = { type: 'MESSAGE', roomId: evtRoomId, message: raw.message as DmMessage };
        } else {
          // type 필드 없음 → raw가 DmMessage 자체 (레거시 폴백)
          event = { type: 'MESSAGE', roomId: evtRoomId, message: raw as unknown as DmMessage };
        }
        handler(event);
      } catch {
        // parse error
      }
    });
    this.subscriptions.set(destination, sub);
  }

  /**
   * 핸드셰이크 연속 실패 시 세션 유효성 판별.
   * 재시도를 멈추고 REST로 세션을 확인 — 401/403이면 만료 확정(로그인 안내),
   * 그 외(성공·네트워크 오류)면 카운터 리셋 후 재시도 재개.
   */
  private async probeSession(): Promise<void> {
    if (this.probing || !this.client) return;
    this.probing = true;
    const client = this.client;
    try {
      await client.deactivate();
      await api.get<number>('/api/notifications/unread-count', { silent: true });
      // 세션 유효 — 서버 WS만 문제일 수 있으므로 재시도 재개
      this.consecutiveFailures = 0;
      if (this.client === client) client.activate();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        this.authRejected = true;
        showToast('로그인하고 이용해 주세요');
        this.disconnect();
      } else {
        // 서버 다운 등 — 세션 만료 아님, 재시도 재개
        this.consecutiveFailures = 0;
        if (this.client === client) client.activate();
      }
    } finally {
      this.probing = false;
    }
  }

  disconnect(): void {
    this.userNickname = null;
    this.connected = false;
    this.hasConnectedOnce = false;
    this.subscriptions.clear();
    this.pendingDmRooms.clear();
    if (this.client) {
      try {
        this.client.deactivate();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  on(channel: Channel, handler: MessageHandler): () => void {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
    }
    this.channelHandlers.get(channel)!.add(handler);

    return () => {
      const handlers = this.channelHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.channelHandlers.delete(channel);
        }
      }
    };
  }

  /**
   * 재연결(두 번째 이후 CONNECTED) 시에만 발화하는 이벤트 등록.
   * 발화 시점은 채널 재구독 완료 후 — 핸들러에서 REST 재동기화를 수행해도
   * 이후 WS 수신과 병합 가능. 반환값은 해제 함수.
   */
  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  send(destination: string, data: unknown): boolean {
    if (this.client && this.connected) {
      this.client.publish({
        destination,
        body: JSON.stringify(data),
      });
      return true;
    }
    return false;
  }

  /**
   * DM 방 채널 구독.
   * - 연결 중이면 즉시 subscribe.
   * - 미연결이면 pendingDmRooms에 등록 → onConnect 시 자동 구독.
   * - 반환값: unsubscribe 함수
   */
  onDmRoom(roomId: number, handler: DmRoomEventHandler): () => void {
    this.pendingDmRooms.set(roomId, handler);
    if (this.client && this.connected) {
      this.subscribeDmRoomNow(roomId, handler);
    }

    return () => {
      this.pendingDmRooms.delete(roomId);
      const destination = `/sub/dm/room/${roomId}`;
      const sub = this.subscriptions.get(destination);
      if (sub) {
        try { sub.unsubscribe(); } catch { /* ignore */ }
        this.subscriptions.delete(destination);
      }
    };
  }

  isAuthRejected(): boolean {
    return this.authRejected;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const wsService = new WebSocketService();
