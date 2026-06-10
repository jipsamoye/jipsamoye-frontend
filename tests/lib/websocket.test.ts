import { describe, it, expect, beforeEach, vi } from 'vitest';

const showToastMock = vi.fn();
vi.mock('@/components/common/Toast', () => ({
  showToast: (text: string) => showToastMock(text),
}));

const { clientInstances, sockJsInstances } = vi.hoisted(() => ({
  clientInstances: [] as Array<{
    config: {
      webSocketFactory: () => unknown;
      onConnect: () => void;
      onDisconnect: () => void;
      onStompError: (frame: { headers: Record<string, string> }) => void;
    };
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }>,
  sockJsInstances: [] as Array<{ url: string; options: unknown }>,
}));

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    activate = vi.fn();
    deactivate = vi.fn();
    publish = vi.fn();
    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    constructor(config: unknown) {
      const instance = {
        config: config as ConstructorParameters<typeof import('@stomp/stompjs').Client>[0],
        activate: this.activate,
        deactivate: this.deactivate,
        publish: this.publish,
        subscribe: this.subscribe,
      };
      clientInstances.push(instance as unknown as (typeof clientInstances)[number]);
    }
  },
}));

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
        message: { id: 1, senderNickname: '상대방', content: '안녕', readAt: null, createdAt: '2026-06-11T10:00:00Z' },
      };
      stompCallback({ body: JSON.stringify(payload) });

      expect(handler).toHaveBeenCalledWith({
        type: 'MESSAGE',
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

      const payload = { type: 'READ', readerNickname: '상대방', readAt: '2026-06-11T10:05:00Z' };
      stompCallback({ body: JSON.stringify(payload) });

      expect(handler).toHaveBeenCalledWith({
        type: 'READ',
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

      // type 필드 없는 raw DmMessage (레거시 형식)
      const rawMsg = { id: 5, senderNickname: '상대방', content: '폴백', readAt: null, createdAt: '2026-06-11T10:00:00Z' };
      stompCallback({ body: JSON.stringify(rawMsg) });

      expect(handler).toHaveBeenCalledWith({
        type: 'MESSAGE',
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
});
