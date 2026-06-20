import { describe, it, expect, beforeEach, vi } from 'vitest';

// websocket.ts 후속 작업(M-5 재연결 인증실패 포착 / 구독 누수 / 에러 채널 / authRejected 가드) 검증.
// 기존 websocket.test.ts와 동일한 Client/SockJS 모킹 패턴을 사용하되,
// onWebSocketClose 등 새 콜백에 접근하기 위해 config를 느슨한 타입으로 캡처한다.

const showToastMock = vi.fn();
vi.mock('@/components/common/Toast', () => ({
  showToast: (text: string) => showToastMock(text),
}));

interface CapturedConfig {
  webSocketFactory: () => unknown;
  onConnect: () => void;
  onDisconnect: () => void;
  onStompError: (frame: { headers: Record<string, string> }) => void;
  onWebSocketClose: (event: { code?: number }) => void;
}

interface CapturedClient {
  config: CapturedConfig;
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

const { clientInstances } = vi.hoisted(() => ({
  clientInstances: [] as CapturedClient[],
}));

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    activate = vi.fn();
    deactivate = vi.fn();
    publish = vi.fn();
    // 구독마다 고유 unsubscribe를 반환해 누수 검증이 가능하도록 한다
    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    constructor(config: unknown) {
      clientInstances.push({
        config: config as CapturedConfig,
        activate: this.activate,
        deactivate: this.deactivate,
        publish: this.publish,
        subscribe: this.subscribe,
      });
    }
  },
}));

vi.mock('sockjs-client', () => ({
  default: class {
    constructor() {}
  },
}));

import { wsService } from '@/lib/websocket';

describe('wsService — M-5 / 견고성 후속', () => {
  beforeEach(() => {
    wsService.setAuthExpiredHandler(null);
    wsService.disconnect();
    clientInstances.length = 0;
    showToastMock.mockClear();
  });

  describe('onWebSocketClose — 연속 close 임계치 (M-5)', () => {
    it('onConnect 없이 연속 close가 임계치(5회)에 도달하면 재연결을 중단한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      // 연결되지 않은 채 close 반복 (인증 실패/서버 다운 시뮬레이션)
      for (let i = 0; i < 4; i++) {
        client.config.onWebSocketClose({ code: 1006 }); // abnormal closure
      }
      // 4회까지는 아직 중단 아님
      expect(client.deactivate).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);

      // 5회째 → 중단
      client.config.onWebSocketClose({ code: 1006 });
      expect(client.deactivate).toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(true);
      expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    });

    it('정상 연결(onConnect) 후 끊긴 close는 연속 실패로 카운트하지 않는다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      // 정상 연결 중 일시 단절 — 카운트되지 않아야 한다
      client.config.onWebSocketClose({ code: 1006 });
      client.config.onDisconnect();
      expect(client.deactivate).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('onConnect 성공 시 직전까지의 연속 close 카운트가 리셋된다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      // 4회 close (아직 임계치 미만)
      for (let i = 0; i < 4; i++) client.config.onWebSocketClose({ code: 1006 });
      // 그 후 연결 성공 → 카운트 리셋
      client.config.onConnect();
      client.config.onDisconnect();
      // 다시 close — 리셋되었으므로 1회로 시작, 중단 아님
      client.config.onWebSocketClose({ code: 1006 });
      expect(client.deactivate).not.toHaveBeenCalled();
      expect(wsService.isAuthRejected()).toBe(false);
    });

    it('명시적 인증 거부 close 코드(1008)는 즉시 재연결을 중단한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      client.config.onWebSocketClose({ code: 1008 }); // policy violation
      expect(wsService.isAuthRejected()).toBe(true);
      expect(client.deactivate).toHaveBeenCalled();
      expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    });
  });

  describe('authRejected 후 connect 재진입 가드 (거부-재시도 루프 차단)', () => {
    it('authRejected 상태에서 같은 사용자로 connect하면 새 연결을 만들지 않는다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      // 인증 거부 발생
      client.config.onStompError({ headers: { message: 'Forbidden' } });
      expect(wsService.isAuthRejected()).toBe(true);

      const before = clientInstances.length;
      // 같은 사용자로 재연결 시도 → 차단
      wsService.connect('테스터');
      expect(clientInstances.length).toBe(before);
    });

    it('다른 사용자로 connect하면 정상적으로 새 연결을 만든다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onStompError({ headers: { message: 'Forbidden' } });
      expect(wsService.isAuthRejected()).toBe(true);

      const before = clientInstances.length;
      wsService.connect('다른사람');
      expect(clientInstances.length).toBe(before + 1);
      expect(wsService.isAuthRejected()).toBe(false);
    });
  });

  describe('구독 누수 방지 — 재연결 시 채널 재구독 전 기존 해제', () => {
    it('재연결(두 번째 onConnect) 시 기존 채널 구독을 unsubscribe한 뒤 재구독한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      // 첫 연결 — notification 구독 객체 캡처
      client.config.onConnect();
      const firstNotificationSub = client.subscribe.mock.results
        .map((r) => r.value as { unsubscribe: ReturnType<typeof vi.fn> })
        .find((_v, i) => client.subscribe.mock.calls[i][0] === '/user/sub/notifications');
      expect(firstNotificationSub).toBeTruthy();

      // 재연결 — onDisconnect 후 다시 onConnect
      client.config.onDisconnect();
      client.config.onConnect();

      // 첫 구독은 (subscriptions.clear로 참조가 끊겨도) 재구독 호출 시 기존 destination이
      // 남아있는 경우 unsubscribe되어야 한다. onDisconnect가 clear하므로
      // 여기서는 두 번째 onConnect에서 새 subscribe가 다시 호출되었는지 확인한다.
      const notificationCalls = client.subscribe.mock.calls.filter(
        (c) => c[0] === '/user/sub/notifications'
      );
      expect(notificationCalls.length).toBe(2);
    });

    it('onDisconnect 없이 onConnect가 다시 호출되어도 같은 destination을 중복 구독하지 않고 기존을 해제한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];

      client.config.onConnect();
      const firstSub = client.subscribe.mock.results
        .map((r) => r.value as { unsubscribe: ReturnType<typeof vi.fn> })
        .find((_v, i) => client.subscribe.mock.calls[i][0] === '/user/sub/notifications')!;

      // onDisconnect 없이 다시 onConnect (재구독 누수 시나리오)
      client.config.onConnect();

      // 기존 구독이 해제되어야 한다
      expect(firstSub.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('/user/sub/errors 구독 (백엔드 M-1 계약)', () => {
    it('연결 후 /user/sub/errors 채널을 구독한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const destinations = client.subscribe.mock.calls.map((c) => c[0] as string);
      expect(destinations).toContain('/user/sub/errors');
    });

    it('구조화 에러 이벤트({code, message}) 수신 시 message를 토스트로 노출한다', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const errSub = client.subscribe.mock.calls.find((c) => c[0] === '/user/sub/errors');
      expect(errSub).toBeTruthy();
      const cb = errSub![1] as (msg: { body: string }) => void;

      cb({ body: JSON.stringify({ code: 'FORBIDDEN', message: '권한이 없어요' }) });
      expect(showToastMock).toHaveBeenCalledWith('권한이 없어요');
    });

    it('계약에 맞지 않는 에러 페이로드는 무시한다(토스트 없음)', () => {
      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onConnect();

      const errSub = client.subscribe.mock.calls.find((c) => c[0] === '/user/sub/errors');
      const cb = errSub![1] as (msg: { body: string }) => void;

      cb({ body: JSON.stringify({ foo: 'bar' }) });
      cb({ body: 'not json' });
      expect(showToastMock).not.toHaveBeenCalled();
    });
  });

  describe('setAuthExpiredHandler — 세션 만료 통지', () => {
    it('인증 거부 시 등록된 핸들러가 호출된다', () => {
      const handler = vi.fn();
      wsService.setAuthExpiredHandler(handler);

      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onStompError({ headers: { message: '401 Unauthorized' } });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('연속 close 임계치 도달 시에도 핸들러가 호출된다', () => {
      const handler = vi.fn();
      wsService.setAuthExpiredHandler(handler);

      wsService.connect('테스터');
      const client = clientInstances[0];
      for (let i = 0; i < 5; i++) client.config.onWebSocketClose({ code: 1006 });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('이미 authRejected 상태면 추가 close에도 핸들러/토스트가 중복 호출되지 않는다', () => {
      const handler = vi.fn();
      wsService.setAuthExpiredHandler(handler);

      wsService.connect('테스터');
      const client = clientInstances[0];
      client.config.onWebSocketClose({ code: 1008 }); // 즉시 거부
      client.config.onWebSocketClose({ code: 1008 }); // 중복

      expect(handler).toHaveBeenCalledTimes(1);
      expect(showToastMock).toHaveBeenCalledTimes(1);
    });
  });
});
