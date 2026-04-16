import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';

type MessageHandler = (data: unknown) => void;

// 채널 이름 → STOMP destination 매핑
type Channel = 'notification' | 'chat';

class WebSocketService {
  private client: Client | null = null;
  private channelHandlers: Map<Channel, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  private userId: number | null = null;
  private connected = false;

  connect(userId: number): void {
    if (this.connected && this.userId === userId) return;

    this.disconnect();
    this.userId = userId;

    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'https://api.jipsamoye.com';

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${baseUrl}/ws`),
      reconnectDelay: 3000,
      onConnect: () => {
        this.connected = true;
        console.log('[WebSocket] STOMP 연결됨');

        // 알림 구독
        this.subscribeChannel('notification', `/sub/notifications/${userId}`);

        // 오픈채팅 구독
        this.subscribeChannel('chat', '/sub/chat/room');
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

  // 채널 단위 STOMP 구독 (내부용)
  private subscribeChannel(channel: Channel, destination: string): void {
    if (!this.client || !this.connected) return;

    const sub = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const data = JSON.parse(message.body);
        console.log(`[WebSocket] 수신 [${channel}]:`, data);
        const handlers = this.channelHandlers.get(channel);
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

  // 채널 핸들러 등록
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

  send(destination: string, data: unknown): void {
    if (this.client && this.connected) {
      this.client.publish({
        destination,
        body: JSON.stringify(data),
      });
    }
  }

  // DM 채팅방 동적 구독
  onDmRoom(roomId: number, handler: MessageHandler): () => void {
    const destination = `/sub/dm/room/${roomId}`;

    if (this.client && this.connected) {
      const sub = this.client.subscribe(destination, (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          console.log(`[WebSocket] 수신 [dm/${roomId}]:`, data);
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
