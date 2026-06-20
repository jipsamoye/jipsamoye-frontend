import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { showToast } from '@/components/common/Toast';
import { isWsErrorEvent } from '@/lib/wsGuards';
import type { DmMessage, DmRoomEvent } from '@/types/api';

type MessageHandler = (data: unknown) => void;
type DmRoomEventHandler = (event: DmRoomEvent) => void;
/** 세션 만료/인증 거부 통지 — AuthProvider 측에서 등록(세션 정리 + 로그아웃 처리) */
type AuthExpiredHandler = () => void;

type Channel = 'notification' | 'chat' | 'dm-rooms' | 'errors';

/** 채널별 구독 destination (재구독 시 누수 방지를 위해 한 곳에서 관리) */
const CHANNEL_DESTINATIONS: Record<Channel, string> = {
  notification: '/user/sub/notifications',
  chat: '/sub/chat/room',
  // 사용자별 DM 방 목록 채널 — 방 밖(목록 화면)에서도 새 메시지/방 실시간 반영
  'dm-rooms': '/user/sub/dm/rooms',
  // 백엔드 M-1 구조화 에러 채널 (계약 FINAL: { code, message })
  errors: '/user/sub/errors',
};

/**
 * 비정상 연속 close 임계치. 인증 실패(403 핸드셰이크 등)나 서버 다운으로
 * 소켓이 곧바로 닫히는 상황에서 조용한 무한 재시도를 막는다.
 */
const MAX_CONSECUTIVE_CLOSES = 5;

class WebSocketService {
  private client: Client | null = null;
  private channelHandlers: Map<Channel, Set<MessageHandler>> = new Map();
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  /** 연결 전 또는 재연결 시 재구독을 위해 DM 방 핸들러 기억 */
  private pendingDmRooms: Map<number, DmRoomEventHandler> = new Map();
  private userNickname: string | null = null;
  private connected = false;
  private authRejected = false;
  /** 인증이 거부된 사용자 닉네임 — disconnect로 userNickname이 풀려도 재진입 가드가 동작하도록 별도 보관 */
  private rejectedNickname: string | null = null;
  /** onConnect 없이 연속으로 close된 횟수 (성공 연결 시 0으로 리셋) */
  private consecutiveCloses = 0;
  /** 세션 만료/인증 거부 통지 핸들러 */
  private authExpiredHandler: AuthExpiredHandler | null = null;

  connect(userNickname: string): void {
    if (this.connected && this.userNickname === userNickname) return;
    // 인증이 거부된 사용자로 재진입 시 즉시 차단 — 거부-재시도 루프 방지.
    // rejectedNickname은 disconnect로 userNickname이 null이 되어도 유지되므로
    // "같은 사용자 재시도"를 안정적으로 판별한다. 다른 사용자로 connect하면 통과.
    if (this.rejectedNickname === userNickname) return;

    this.disconnect();
    this.userNickname = userNickname;
    this.authRejected = false;
    this.rejectedNickname = null;
    this.consecutiveCloses = 0;

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
        // 성공 연결 → 연속 close 카운트 리셋
        this.consecutiveCloses = 0;
        this.subscribeChannel('notification', CHANNEL_DESTINATIONS.notification);
        this.subscribeChannel('chat', CHANNEL_DESTINATIONS.chat);
        this.subscribeChannel('dm-rooms', CHANNEL_DESTINATIONS['dm-rooms']);
        // 백엔드 M-1 구조화 에러 채널 구독 — 서버 비즈니스 에러를 사용자에게 토스트로 노출
        this.subscribeChannel('errors', CHANNEL_DESTINATIONS.errors);
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
          this.handleAuthRejected();
        }
      },
      // 소켓이 닫힐 때마다 호출(정상/비정상 모두). STOMP ERROR 프레임 없이 끊기는
      // 인증 실패/서버 다운도 여기서 포착한다(M-5).
      onWebSocketClose: (event: { code?: number }) => {
        this.handleSocketClose(event);
      },
    });

    try {
      this.client.activate();
    } catch {
      // ignore
    }
  }

  /** 인증 거부 확정 처리 — 재연결 중단 + 토스트 + AuthProvider 통지 */
  private handleAuthRejected(): void {
    if (this.authRejected) return; // 중복 토스트/통지 방지
    const rejected = this.userNickname;
    showToast('로그인하고 이용해 주세요');
    this.authExpiredHandler?.();
    // disconnect는 rejectedNickname을 초기화하므로, 거부 사용자 기록은 그 뒤에 설정한다.
    // (재진입 가드가 disconnect 이후에도 같은 사용자를 차단하도록)
    this.disconnect();
    this.authRejected = true;
    this.rejectedNickname = rejected;
  }

  /**
   * 소켓 close 처리(M-5). onConnect로 정상 연결되지 않은 채 연속 close되면
   * 인증 실패/서버 불가용으로 보고, 임계치 도달 시 재연결을 중단한다.
   * 정상 연결(connected=true) 중 끊긴 경우는 일시적 단절로 보고 재시도를 허용한다.
   */
  private handleSocketClose(event?: { code?: number }): void {
    // 명시적 인증 거부 close 코드(STOMP ERROR 없이 핸드셰이크 단계에서 닫히는 경우 포함).
    // 1008(Policy Violation) 및 앱 정의 3000/3403을 인증실패 신호로 본다.
    const code = event?.code;
    const explicitAuthClose = code === 1008 || code === 3000 || code === 3403;
    if (explicitAuthClose) {
      this.handleAuthRejected();
      return;
    }

    if (this.connected) {
      // 정상 연결 중 끊김 → 일시적 단절. onDisconnect가 connected=false 처리.
      // 재시도 카운트는 onConnect 실패가 누적될 때만 증가시킨다.
      return;
    }

    // onConnect 없이 닫힌 경우 → 연속 실패로 카운트
    this.consecutiveCloses += 1;
    if (this.consecutiveCloses >= MAX_CONSECUTIVE_CLOSES) {
      // 조용한 무한 재시도 차단. 세션 만료일 가능성이 높으므로 AuthProvider에도 통지.
      this.handleAuthRejected();
    }
  }

  private subscribeChannel(channel: Channel, destination: string): void {
    if (!this.client || !this.connected) return;

    // 재연결/중복 호출 시 기존 구독을 해제하고 재구독 (구독 누수 방지)
    const existing = this.subscriptions.get(destination);
    if (existing) {
      try { existing.unsubscribe(); } catch { /* ignore */ }
    }

    const sub = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const data: unknown = JSON.parse(message.body);
        // errors 채널은 구조화 에러 계약({code, message})이라 별도 처리: 토스트.
        if (channel === 'errors') {
          if (isWsErrorEvent(data)) {
            showToast(data.message);
          }
          return;
        }
        const handlers = this.channelHandlers.get(channel);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch {
        // parse error — 비정상 페이로드는 무시
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
        const parsed: unknown = JSON.parse(message.body);
        if (typeof parsed !== 'object' || parsed === null) return;
        const raw = parsed as Record<string, unknown>;
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

  disconnect(): void {
    this.userNickname = null;
    this.connected = false;
    // 명시적 disconnect(로그아웃 등)는 인증 거부 상태를 해제한다.
    // handleAuthRejected는 이 메서드 호출 "이후" rejectedNickname을 다시 설정한다.
    this.authRejected = false;
    this.rejectedNickname = null;
    this.consecutiveCloses = 0;
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

  /** 세션 만료/인증 거부 통지 핸들러 등록 (AuthProvider 측에서 사용) */
  setAuthExpiredHandler(handler: AuthExpiredHandler | null): void {
    this.authExpiredHandler = handler;
  }

  isAuthRejected(): boolean {
    return this.authRejected;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const wsService = new WebSocketService();
