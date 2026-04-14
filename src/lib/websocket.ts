import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';

type MessageHandler = (data: unknown) => void;

class WebSocketService {
  private client: Client | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  private userId: number | null = null;
  private connected = false;

  connect(userId: number): void {
    if (this.connected && this.userId === userId) return;

    this.disconnect();
    this.userId = userId;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${baseUrl}/ws`),
      reconnectDelay: 3000,
      onConnect: () => {
        this.connected = true;
        console.log('[WebSocket] STOMP 연결됨');

        // 알림 구독: /sub/notifications/{userId}
        this.stompSubscribe(
          `/sub/notifications/${userId}`,
          'NOTIFICATION'
        );

        // 오픈채팅 구독: /sub/chat/room
        this.stompSubscribe('/sub/chat/room', 'CHAT_MESSAGE');

        // DM은 채팅방별로 동적 구독 (subscribeDmRoom 메서드 사용)
      },
      onDisconnect: () => {
        this.connected = false;
        console.log('[WebSocket] STOMP 연결 해제');
      },
      onStompError: (frame) => {
        console.log('[WebSocket] STOMP 에러:', frame.headers['message']);
      },
    });

    try {
      this.client.activate();
    } catch {
      console.log('[WebSocket] 연결 실패');
    }
  }

  private stompSubscribe(destination: string, type: string): void {
    if (!this.client || !this.connected) return;

    const sub = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const data = JSON.parse(message.body);
        console.log(`[WebSocket] 수신 (${destination}):`, data);
        const handlers = this.handlers.get(type);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch {
        console.log('[WebSocket] 메시지 파싱 실패:', message.body);
      }
    });

    this.subscriptions.set(destination, sub);
  }

  disconnect(): void {
    this.userId = null;
    this.connected = false;
    this.subscriptions.clear();
    if (this.client) {
      try {
        this.client.deactivate();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }

  send(destination: string, data: unknown): void {
    if (this.client && this.connected) {
      this.client.publish({
        destination,
        body: JSON.stringify(data),
      });
    }
  }

  subscribeDmRoom(roomId: number, handler: MessageHandler): () => void {
    const destination = `/sub/dm/room/${roomId}`;

    // STOMP 구독
    if (this.client && this.connected) {
      const sub = this.client.subscribe(destination, (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          console.log(`[WebSocket] 수신 (${destination}):`, data);
          handler(data);
        } catch {
          console.log('[WebSocket] DM 메시지 파싱 실패:', message.body);
        }
      });
      this.subscriptions.set(destination, sub);
    }

    return () => {
      const sub = this.subscriptions.get(destination);
      if (sub) {
        sub.unsubscribe();
        this.subscriptions.delete(destination);
      }
    };
  }
}

export const wsService = new WebSocketService();
