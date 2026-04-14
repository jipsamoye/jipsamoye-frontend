type MessageHandler = (data: unknown) => void;

interface WebSocketMessage {
  type: string;
  data: unknown;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private userId: number | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  connect(userId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.userId === userId) {
      return;
    }

    this.disconnect();
    this.userId = userId;
    this.retryCount = 0;
    this.createConnection();
  }

  private createConnection(): void {
    if (this.userId === null) return;

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const url = `${wsBaseUrl}/ws?userId=${this.userId}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.retryCount = 0;
        console.log('[WebSocket] Connected');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data as string);
          const handlers = this.handlers.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message.data));
          }
        } catch {
          console.log('[WebSocket] Failed to parse message');
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.tryReconnect();
      };

      this.ws.onerror = () => {
        // Silently ignore errors — backend may not be available
      };
    } catch {
      console.log('[WebSocket] Connection failed');
    }
  }

  private tryReconnect(): void {
    if (this.userId === null) return;
    if (this.retryCount >= this.maxRetries) {
      console.log('[WebSocket] Max retries reached, giving up');
      return;
    }

    this.retryCount += 1;
    console.log(`[WebSocket] Reconnecting (${this.retryCount}/${this.maxRetries})...`);

    this.retryTimeout = setTimeout(() => {
      this.createConnection();
    }, 3000);
  }

  disconnect(): void {
    this.userId = null;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
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

  send(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
}

export const wsService = new WebSocketService();
