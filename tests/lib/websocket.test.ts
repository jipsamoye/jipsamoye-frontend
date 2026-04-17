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
    wsService.connect(7);

    const client = clientInstances[0];
    client.config.webSocketFactory();

    expect(sockJsInstances).toHaveLength(1);
    const options = sockJsInstances[0].options as {
      transportOptions: Record<string, { withCredentials: boolean }>;
    };
    expect(options.transportOptions['xhr-streaming'].withCredentials).toBe(true);
    expect(options.transportOptions['xhr-polling'].withCredentials).toBe(true);
  });

  it('send 는 destination 과 JSON 직렬화된 body 로 publish 한다 (userId 없이)', () => {
    wsService.connect(7);
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
    wsService.connect(7);
    const client = clientInstances[0];
    client.config.onConnect();

    client.config.onStompError({ headers: { message: 'Unauthorized: session not found' } });

    expect(showToastMock).toHaveBeenCalledWith('로그인하고 이용해 주세요');
    expect(client.deactivate).toHaveBeenCalled();
    expect(wsService.isAuthRejected()).toBe(true);
  });

  it('STOMP ERROR 에 권한 관련 메시지가 아니면 토스트/차단하지 않는다', () => {
    wsService.connect(7);
    const client = clientInstances[0];
    client.config.onConnect();

    client.config.onStompError({ headers: { message: 'Temporary network blip' } });

    expect(showToastMock).not.toHaveBeenCalled();
    expect(client.deactivate).not.toHaveBeenCalled();
    expect(wsService.isAuthRejected()).toBe(false);
  });
});
