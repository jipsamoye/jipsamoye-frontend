import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { showToast } from '@/components/common/Toast';
import type { DmMessage, DmRoomEvent } from '@/types/api';

type MessageHandler = (data: unknown) => void;
type DmRoomEventHandler = (event: DmRoomEvent) => void;

type Channel = 'notification' | 'chat';

class WebSocketService {
  private client: Client | null = null;
  private channelHandlers: Map<Channel, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  /** 연결 전 또는 재연결 시 재구독을 위해 DM 방 핸들러 기억 */
  private pendingDmRooms: Map<number, DmRoomEventHandler> = new Map();
  private userNickname: string | null = null;
  private connected = false;
  private authRejected = false;

  connect(userNickname: string): void {
    if (this.connected && this.userNickname === userNickname) return;

    this.disconnect();
    this.userNickname = userNickname;
    this.authRejected = false;

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
        this.subscribeChannel('notification', '/user/sub/notifications');
        this.subscribeChannel('chat', '/sub/chat/room');
        // 이미 등록된 DM 방 구독 전부 복구 (연결 전 등록 + 재연결 시)
        this.pendingDmRooms.forEach((handler, roomId) => {
          this.subscribeDmRoomNow(roomId, handler);
        });
      },
      onDisconnect: () => {
        this.connected = false;
        // 구독 참조 초기화 (재연결 시 onConnect에서 재구독)
        this.subscriptions.clear();
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
        if (raw.type === 'READ') {
          event = {
            type: 'READ',
            readerNickname: raw.readerNickname as string,
            readAt: raw.readAt as string,
          };
        } else if (raw.type === 'MESSAGE') {
          event = { type: 'MESSAGE', message: raw.message as DmMessage };
        } else {
          // type 필드 없음 → raw가 DmMessage 자체 (레거시 폴백)
          event = { type: 'MESSAGE', message: raw as unknown as DmMessage };
        }
        handler(event);
      } catch {
        // parse error
      }
    });
    this.subscriptions.set(destination, sub);
  }

  disconnect(): void {
    this.userNickname = null;
    this.connected = false;
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
