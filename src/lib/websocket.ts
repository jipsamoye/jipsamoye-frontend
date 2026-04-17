import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { showToast } from '@/components/common/Toast';

type MessageHandler = (data: unknown) => void;

type Channel = 'notification' | 'chat';

class WebSocketService {
  private client: Client | null = null;
  private channelHandlers: Map<Channel, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
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
      },
      onDisconnect: () => {
        this.connected = false;
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

  disconnect(): void {
    this.userNickname = null;
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

  onDmRoom(roomId: number, handler: MessageHandler): () => void {
    const destination = `/sub/dm/room/${roomId}`;

    if (this.client && this.connected) {
      const sub = this.client.subscribe(destination, (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          handler(data);
        } catch {
          // parse error
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

  isAuthRejected(): boolean {
    return this.authRejected;
  }
}

export const wsService = new WebSocketService();
