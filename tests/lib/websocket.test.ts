import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';

const showToastMock = vi.fn();
vi.mock('@/components/common/Toast', () => ({
  showToast: (text: string) => showToastMock(text),
}));

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

interface MockClientConfig {
  webSocketFactory: () => unknown;
  reconnectDelay: number;
  maxReconnectDelay?: number;
  reconnectTimeMode?: unknown;
  heartbeatStrategy?: unknown;
  onConnect: () => void;
  onDisconnect: () => void;
  onWebSocketClose?: () => void;
  onStompError: (frame: { headers: Record<string, string> }) => void;
}

const { clientInstances, sockJsInstances } = vi.hoisted(() => ({
  clientInstances: [] as Array<{
    config: {
      webSocketFactory: () => unknown;
      reconnectDelay: number;
      maxReconnectDelay?: number;
      reconnectTimeMode?: unknown;
      heartbeatStrategy?: unknown;
      onConnect: () => void;
      onDisconnect: () => void;
      onWebSocketClose?: () => void;
      onStompError: (frame: { headers: Record<string, string> }) => void;
    };
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }>,
  sockJsInstances: [] as Array<{ url: string; options: unknown }>,
}));

vi.mock('@stomp/stompjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stomp/stompjs')>();
  return {
    ...actual,
    Client: class {
      activate = vi.fn();
      deactivate = vi.fn();
      publish = vi.fn();
      subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
      constructor(config: unknown) {
        const instance = {
          config: config as MockClientConfig,
          activate: this.activate,
          deactivate: this.deactivate,
          publish: this.publish,
          subscribe: this.subscribe,
        };
        clientInstances.push(instance as unknown as (typeof clientInstances)[number]);
      }
    },
  };
});

vi.mock('sockjs-client', () => ({
  default: class {
    constructor(url: string, _protocols: unknown, options: unknown) {
      sockJsInstances.push({ url, options });
    }
  },
}));

import { wsService } from '@/lib/websocket';

describe('wsService', () => {
  beforeEach(() => {
    wsService.disconnect();
    clientInstances.length = 0;
    sockJsInstances.length = 0;
    showToastMock.mockClear();
    apiMock.get.mockReset();
  });

  it('SockJS transportOptions 에 withCredentials: true 를 포함해서 연결한다', () => {
    wsService.connect('테스터');

    const client = clientInstances[0];
    client.config.webSocketFactory();

    expect(sockJsInstances).toHaveLength(1);
    const options = sockJsInstances[0].options as {
      transportOptions: Record<string, { withCredentials: boolean }>;
    };
    expect(options.transportOptions['xhr-streaming'].withCredentials).toBe(true);
    expect(options.transportOptions['xhr-polling'].withCredentials).toBe(true);
  });

  it('연결 후 알림 채널을 /user/sub/notifications 로 구독한다 (Spring user-destination 기반, userId 미포함)', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    const subscribedDestinations = client.subscribe.mock.calls.map((call) => call[0] as string);
    expect(subscribedDestinations).toContain('/user/sub/notifications');

    const notificationSub = subscribedDestinations.find((d) => d.includes('notifications'));
    expect(notificationSub).toBe('/user/sub/notifications');
    expect(notificationSub).not.toMatch(/\/sub\/notifications\/\d+/);
    expect(notificationSub).not.toMatch(/\/sub\/notifications\/me$/);
  });

  it('연결 후 사용자별 DM 방 채널을 /user/sub/dm/rooms 로 구독한다 (버그②)', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    const subscribedDestinations = client.subscribe.mock.calls.map((call) => call[0] as string);
    expect(subscribedDestinations).toContain('/user/sub/dm/rooms');
  });

  it('dm-rooms 채널 메시지가 on("dm-rooms") 핸들러로 전달된다 (버그②)', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    const handler = vi.fn();
    wsService.on('dm-rooms', handler);

    const sub = client.subscribe.mock.calls.find((call) => call[0] === '/user/sub/dm/rooms');
    expect(sub).toBeTruthy();
    const stompCallback = sub![1] as (msg: { body: string }) => void;

    const payload = {
      roomId: 7,
      otherUserNickname: '상대방',
      otherUserProfileImageUrl: null,
      lastMessage: '안녕',
      lastMessageAt: '2026-06-11T10:00:00',
      unreadCount: 1,
    };
    stompCallback({ body: JSON.stringify(payload) });

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('send 는 destination 과 JSON 직렬화된 body 로 publish 한다 (userId 없이)', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    wsService.send('/pub/dm/send', { roomId: 1, content: '안녕', imageUrl: null });

    expect(client.publish).toHaveBeenCalledWith({
      destination: '/pub/dm/send',
      body: JSON.stringify({ roomId: 1, content: '안녕', imageUrl: null }),
    });
    const calledArg = client.publish.mock.calls[0][0] as { body: string };
    expect(calledArg.body).not.toContain('userId');
  });

  it('STOMP ERROR 에 unauthorized 메시지가 있으면 재연결 차단 + 토스트 노출', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    client.config.onStompError({ headers: { message: 'Unauthorized: session not found' } });

    expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    expect(client.deactivate).toHaveBeenCalled();
    expect(wsService.isAuthRejected()).toBe(true);
  });

  it('STOMP ERROR 에 권한 관련 메시지가 아니면 토스트/차단하지 않는다', () => {
    wsService.connect('테스터');
    const client = clientInstances[0];
    client.config.onConnect();

    client.config.onStompError({ headers: { message: 'Temporary network blip' } });

    expect(showToastMock).not.toHaveBeenCalled();
    expect(client.deactivate).not.toHaveBeenCalled();
    expect(wsService.isAuthRejected()).toBe(false);
  });

  describe('onDmRoom — 타이밍 버그 수정', () => {
    it('연결 전 onDmRoom 등록 후 onConnect 시 자동 구독된다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      // onConnect 호출 전에 DM 방 구독 등록
      const handler = vi.fn();
      wsService.onDmRoom(42, handler);

      // 아직 connected=false 이므로 subscribe 호출 없음
      expect(client.subscribe).not.toHaveBeenCalledWith(
        '/sub/dm/room/42',
        expect.any(Function)
      );

      // onConnect 시뮬레이션 → 자동 구독
      client.config.onConnect();

      const subscribedDestinations = client.subscribe.mock.calls.map((call) => call[0] as string);
      expect(subscribedDestinations).toContain('/sub/dm/room/42');
    });

    it('연결 중 onDmRoom 등록 시 즉시 구독된다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const handler = vi.fn();
      wsService.onDmRoom(99, handler);

      const subscribedDestinations = client.subscribe.mock.calls.map((call) => call[0] as string);
      expect(subscribedDestinations).toContain('/sub/dm/room/99');
    });

    it('MESSAGE 이벤트(type=MESSAGE) 파싱하여 핸들러에 전달', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const handler = vi.fn();
      wsService.onDmRoom(1, handler);

      // subscribe 콜백 찾기
      const dmSubCall = client.subscribe.mock.calls.find(
        (call) => call[0] === '/sub/dm/room/1'
      );
      expect(dmSubCall).toBeTruthy();
      const stompCallback = dmSubCall![1] as (msg: { body: string }) => void;

      const payload = {
        type: 'MESSAGE',
        roomId: 1,
        message: { id: 1, senderNickname: '상대방', content: '안녕', readAt: null, createdAt: '2026-06-11T10:00:00Z' },
      };
      stompCallback({ body: JSON.stringify(payload) });

      expect(handler).toHaveBeenCalledWith({
        type: 'MESSAGE',
        roomId: 1,
        message: payload.message,
      });
    });

    it('READ 이벤트(type=READ) 파싱하여 핸들러에 전달', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const handler = vi.fn();
      wsService.onDmRoom(1, handler);

      const dmSubCall = client.subscribe.mock.calls.find(
        (call) => call[0] === '/sub/dm/room/1'
      );
      const stompCallback = dmSubCall![1] as (msg: { body: string }) => void;

      const payload = { type: 'READ', roomId: 1, readerNickname: '상대방', readAt: '2026-06-11T10:05:00Z' };
      stompCallback({ body: JSON.stringify(payload) });

      expect(handler).toHaveBeenCalledWith({
        type: 'READ',
        roomId: 1,
        readerNickname: '상대방',
        readAt: '2026-06-11T10:05:00Z',
      });
    });

    it('type 필드 없는 raw DmMessage → MESSAGE 이벤트로 폴백', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const handler = vi.fn();
      wsService.onDmRoom(1, handler);

      const dmSubCall = client.subscribe.mock.calls.find(
        (call) => call[0] === '/sub/dm/room/1'
      );
      const stompCallback = dmSubCall![1] as (msg: { body: string }) => void;

      // type 필드 없는 raw DmMessage (레거시 형식). roomId 누락 시 구독한 방 id(1)로 폴백.
      const rawMsg = { id: 5, senderNickname: '상대방', content: '폴백', readAt: null, createdAt: '2026-06-11T10:00:00Z' };
      stompCallback({ body: JSON.stringify(rawMsg) });

      expect(handler).toHaveBeenCalledWith({
        type: 'MESSAGE',
        roomId: 1,
        message: rawMsg,
      });
    });

    it('unsubscribe 함수 호출 시 pendingDmRooms에서 제거 (재연결 시 재구독 안 함)', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const handler = vi.fn();
      const unsubscribe = wsService.onDmRoom(1, handler);

      // unsubscribe 호출
      unsubscribe();

      // disconnect 후 재연결 시뮬레이션
      client.config.onDisconnect();
      client.subscribe.mockClear();
      client.config.onConnect();

      const subscribedDestinations = client.subscribe.mock.calls.map((call) => call[0] as string);
      expect(subscribedDestinations).not.toContain('/sub/dm/room/1');
    });
  });

  describe('send 반환값', () => {
    it('연결 상태에서 send는 true를 반환한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const result = wsService.send('/pub/dm/send', { roomId: 1, content: '안녕', imageUrl: null });
      expect(result).toBe(true);
    });

    it('미연결 상태에서 send는 false를 반환한다', () => {
      // 연결하지 않은 새 인스턴스 상태 (disconnect 후)
      wsService.disconnect();
      const result = wsService.send('/pub/dm/send', { roomId: 1, content: '안녕', imageUrl: null });
      expect(result).toBe(false);
    });
  });

  describe('onReconnect — 재연결 전용 이벤트', () => {
    it('최초 연결(첫 onConnect) 시에는 발화하지 않는다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);

      clientInstances[0].config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('재연결(두 번째 onConnect) 시 1회 발화한다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);
      const client = clientInstances[0];

      client.config.onConnect();
      client.config.onDisconnect();
      client.config.onConnect();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('재연결 발화 시점은 채널 재구독이 끝난 뒤다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      let subscribedAtFire: string[] = [];
      wsService.onReconnect(() => {
        subscribedAtFire = client.subscribe.mock.calls.map((call) => call[0] as string);
      });

      client.config.onConnect();
      client.config.onDisconnect();
      client.subscribe.mockClear();
      client.config.onConnect();

      expect(subscribedAtFire).toContain('/user/sub/notifications');
      expect(subscribedAtFire).toContain('/user/sub/dm/rooms');
    });

    it('명시적 disconnect 후 새 connect의 첫 onConnect는 최초 연결로 취급한다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      wsService.onReconnect(handler);
      clientInstances[0].config.onConnect();

      wsService.disconnect();
      wsService.connect('테스터');
      clientInstances[1].config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('해제 함수 호출 후에는 발화하지 않는다', () => {
      wsService.connect('테스터');
      const handler = vi.fn();
      const off = wsService.onReconnect(handler);
      const client = clientInstances[0];

      client.config.onConnect();
      off();
      client.config.onDisconnect();
      client.config.onConnect();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onWebSocketClose — 비정상 절단 정리', () => {
    it('비정상 절단(onWebSocketClose) 시 connected=false → send가 false를 반환한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();
      expect(wsService.send('/pub/dm/send', { roomId: 1, content: '안녕' })).toBe(true);

      client.config.onWebSocketClose?.();

      expect(wsService.isConnected()).toBe(false);
      expect(wsService.send('/pub/dm/send', { roomId: 1, content: '안녕' })).toBe(false);
    });

    it('비정상 절단 후 재연결(onConnect) 시 DM 방이 재구독된다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();
      wsService.onDmRoom(42, vi.fn());

      client.config.onWebSocketClose?.();
      client.subscribe.mockClear();
      client.config.onConnect();

      const destinations = client.subscribe.mock.calls.map((call) => call[0] as string);
      expect(destinations).toContain('/sub/dm/room/42');
    });
  });

  describe('세션 프로브 — 핸드셰이크 연속 실패', () => {
    const closeTimes = (client: (typeof clientInstances)[number], n: number) => {
      for (let i = 0; i < n; i += 1) client.config.onWebSocketClose?.();
    };

    it('연속 5회 실패 시 deactivate 후 unread-count로 세션 프로브한다', async () => {
      apiMock.get.mockResolvedValue({ status: 200, code: 'SUCCESS', message: '', data: 0 });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(apiMock.get).toHaveBeenCalledWith('/api/notifications/unread-count', { silent: true });
      });
      expect(client.deactivate).toHaveBeenCalled();
    });

    it('프로브 성공(세션 유효) 시 카운터 리셋 후 재시도를 재개한다', async () => {
      apiMock.get.mockResolvedValue({ status: 200, code: 'SUCCESS', message: '', data: 0 });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      // connect() 시 1회 + 프로브 후 재개 1회
      await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
      expect(showToastMock).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('프로브 401 시 토스트 + authRejected + 재시도 중단', async () => {
      apiMock.get.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
      });
      expect(wsService.isAuthRejected()).toBe(true);
      // 재개(activate 2회째) 없음
      expect(client.activate).toHaveBeenCalledTimes(1);
    });

    it('프로브 403 시에도 만료로 확정한다', async () => {
      apiMock.get.mockRejectedValue({ status: 403, code: 'FORBIDDEN', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => {
        expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
      });
      expect(wsService.isAuthRejected()).toBe(true);
    });

    it('프로브 네트워크 오류(서버 다운) 시 만료로 취급하지 않고 재시도를 재개한다', async () => {
      apiMock.get.mockRejectedValue({ status: 503, code: 'HTTP_ERROR', message: '', data: null });
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 5);

      await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
      expect(showToastMock).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('onConnect가 카운터를 리셋한다 — 4회 실패 후 연결되면 프로브하지 않는다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      closeTimes(client, 4);
      client.config.onConnect();
      closeTimes(client, 4);

      expect(apiMock.get).not.toHaveBeenCalled();
    });
  });

  describe('재연결 백오프 + heartbeat worker 옵션', () => {
    it('지수 백오프: 3초 시작, 최대 60초, EXPONENTIAL 모드', () => {
      wsService.connect('테스터');
      const cfg = clientInstances[0].config;

      expect(cfg.reconnectDelay).toBe(3000);
      expect(cfg.maxReconnectDelay).toBe(60000);
      expect(cfg.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
    });

    it('백그라운드 탭 스로틀링 대응: heartbeat를 Web Worker로 발행', () => {
      wsService.connect('테스터');
      const cfg = clientInstances[0].config;

      expect(cfg.heartbeatStrategy).toBe(TickerStrategy.Worker);
    });
  });
});
