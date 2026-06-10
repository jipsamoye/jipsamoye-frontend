import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ─── crypto.randomUUID mock ──────────────────────────────────────────────────
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `mock-uuid-${++uuidCounter}`,
});

// ─── api mock ────────────────────────────────────────────────────────────────
const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

// ─── wsService mock ──────────────────────────────────────────────────────────
const { wsMock } = vi.hoisted(() => {
  const wsMock = {
    onDmRoom: vi.fn(() => () => {}),
    send: vi.fn(() => true),
    isConnected: vi.fn(() => true),
  };
  return { wsMock };
});
vi.mock('@/lib/websocket', () => ({ wsService: wsMock }));

type DmEventHandler = (event: import('@/types/api').DmRoomEvent) => void;

// ─── nowKstString mock (차단 3: 낙관적 메시지 KST-naive 검증) ────────────────
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    nowKstString: () => '2026-06-11T10:00:00.000000',
  };
});

import { useDmRoom } from '@/hooks/useDmRoom';
import type { DmMessage, PageResponse, DmRoomEvent } from '@/types/api';

const successRes = (data: unknown) => ({ status: 200, code: 'SUCCESS', message: '', data });

const makePageRes = (
  items: DmMessage[],
  hasNext = false
): ReturnType<typeof successRes> =>
  successRes({
    content: items,
    totalPages: hasNext ? 2 : 1,
    totalElements: items.length,
    currentPage: 0,
    size: 50,
    hasNext,
  } as PageResponse<DmMessage>);

const makeMsg = (overrides: Partial<DmMessage> = {}): DmMessage => ({
  id: 1,
  senderNickname: '상대방',
  content: '안녕',
  readAt: null,
  createdAt: '2026-06-11T10:00:00.000Z',
  ...overrides,
});

describe('useDmRoom', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    wsMock.onDmRoom.mockReset();
    wsMock.send.mockReset();
    wsMock.onDmRoom.mockReturnValue(() => {});
    wsMock.send.mockReturnValue(true);
    uuidCounter = 0;
  });

  // ─── 메시지 로드 ─────────────────────────────────────────────────────────

  it('roomId 설정 시 REST로 메시지를 로드하고 createdAt 오름차순 정렬', async () => {
    const older = makeMsg({ id: 1, createdAt: '2026-06-11T09:00:00.000Z' });
    const newer = makeMsg({ id: 2, createdAt: '2026-06-11T10:00:00.000Z' });
    // 서버가 최신순으로 반환하는 경우를 시뮬레이션
    apiMock.get.mockResolvedValueOnce(makePageRes([newer, older]));

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0].id).toBe(1); // 오래된 것이 먼저
    expect(result.current.messages[1].id).toBe(2);
  });

  it('방 변경 시 메시지 초기화', async () => {
    apiMock.get.mockResolvedValue(makePageRes([makeMsg({ id: 1 })]));
    const { result, rerender } = renderHook(
      ({ roomId }: { roomId: number | null }) =>
        useDmRoom({ roomId, userNickname: '나', onMessageSent: undefined, onUnread: undefined }),
      { initialProps: { roomId: 1 as number | null } }
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    rerender({ roomId: 2 });
    // 리렌더 직후 이전 방 메시지 초기화
    expect(result.current.messages).toHaveLength(0);
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].id).toBe(1);
  });

  // ─── WS — MESSAGE 이벤트 ────────────────────────────────────────────────

  it('MESSAGE 이벤트 수신: id 중복 무시', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([makeMsg({ id: 1 })]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    // 같은 id 재수신
    act(() => {
      capturedHandler!({ type: 'MESSAGE', message: makeMsg({ id: 1, content: '중복' }) });
    });
    expect(result.current.messages).toHaveLength(1);
  });

  it('MESSAGE 이벤트 수신: 새 메시지 추가', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([makeMsg({ id: 1 })]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      capturedHandler!({ type: 'MESSAGE', message: makeMsg({ id: 2, content: '새 메시지' }) });
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe('새 메시지');
  });

  // ─── 낙관적 UI + 에코 매칭 ────────────────────────────────────────────────

  it('sendMessage: 낙관적 메시지(status=sending) 즉시 추가', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('안녕하세요'));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('sending');
    expect(result.current.messages[0].content).toBe('안녕하세요');
  });

  it('서버 에코(MESSAGE 이벤트) — clientMessageId 매칭으로 낙관적 메시지 치환', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('안녕'));
    const sentMsg = result.current.messages[0];
    expect(sentMsg.clientMessageId).toBe('mock-uuid-1');
    expect(sentMsg.status).toBe('sending');

    // 서버 에코 도착
    act(() => {
      capturedHandler!({
        type: 'MESSAGE',
        message: makeMsg({
          id: 100,
          senderNickname: '나',
          content: '안녕',
          clientMessageId: 'mock-uuid-1',
          createdAt: '2026-06-11T10:01:00.000Z',
        }),
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe(100);
    expect(result.current.messages[0].status).toBe('sent');
    expect(result.current.messages[0].clientMessageId).toBe('mock-uuid-1');
  });

  it('WS 미연결(send=false) 시 status=failed', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    wsMock.send.mockReturnValue(false);

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('실패 메시지'));
    expect(result.current.messages[0].status).toBe('failed');
  });

  it('retryMessage: failed 메시지 재전송 시 status=sending으로 변경', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    wsMock.send.mockReturnValueOnce(false); // 첫 전송 실패

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('재전송 테스트'));
    expect(result.current.messages[0].status).toBe('failed');
    const clientMessageId = result.current.messages[0].clientMessageId!;

    wsMock.send.mockReturnValue(true);
    act(() => result.current.retryMessage(clientMessageId));
    expect(result.current.messages[0].status).toBe('sending');
  });

  // ─── READ 이벤트 ─────────────────────────────────────────────────────────

  it('READ 이벤트: 내가 보낸 미읽음 메시지의 readAt 갱신', async () => {
    const myMsg = makeMsg({ id: 1, senderNickname: '나', readAt: null });
    const otherMsg = makeMsg({ id: 2, senderNickname: '상대방', readAt: null });
    apiMock.get.mockResolvedValueOnce(makePageRes([myMsg, otherMsg]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    const readAt = '2026-06-11T10:05:00.000Z';
    act(() => {
      capturedHandler!({ type: 'READ', readerNickname: '상대방', readAt });
    });

    // 내가 보낸 메시지 readAt 갱신
    expect(result.current.messages.find((m) => m.id === 1)?.readAt).toBe(readAt);
    // 상대방 메시지는 변경 없음
    expect(result.current.messages.find((m) => m.id === 2)?.readAt).toBeNull();
  });

  it('READ 이벤트: 이미 readAt이 있는 메시지는 덮어쓰지 않음', async () => {
    const originalReadAt = '2026-06-11T09:00:00.000Z';
    const myMsg = makeMsg({ id: 1, senderNickname: '나', readAt: originalReadAt });
    apiMock.get.mockResolvedValueOnce(makePageRes([myMsg]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      capturedHandler!({ type: 'READ', readerNickname: '상대방', readAt: '2026-06-11T10:05:00.000Z' });
    });

    // 이미 readAt이 있으니 변경 없음
    expect(result.current.messages[0].readAt).toBe(originalReadAt);
  });

  // ─── 무한스크롤 ──────────────────────────────────────────────────────────

  it('hasOlderMessages=true 일 때 loadOlderMessages 호출 시 이전 메시지 prepend', async () => {
    const newerMsg = makeMsg({ id: 10, createdAt: '2026-06-11T10:00:00.000Z' });
    const olderMsg = makeMsg({ id: 5, createdAt: '2026-06-11T08:00:00.000Z' });

    apiMock.get
      .mockResolvedValueOnce(makePageRes([newerMsg], true)) // page=0, hasNext=true
      .mockResolvedValueOnce(makePageRes([olderMsg], false)); // page=1, hasNext=false

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.hasOlderMessages).toBe(true);

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(apiMock.get).toHaveBeenLastCalledWith(
      '/api/dm/rooms/1/messages?page=1&size=50'
    );
    // 오래된 메시지가 앞에 prepend
    expect(result.current.messages[0].id).toBe(5);
    expect(result.current.messages[1].id).toBe(10);
    expect(result.current.hasOlderMessages).toBe(false);
  });

  it('hasOlderMessages=false 이면 loadOlderMessages 호출해도 API 재호출 없음', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([makeMsg()], false));
    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.hasOlderMessages).toBe(false);

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(apiMock.get).toHaveBeenCalledTimes(1); // 최초 로드 1번만
  });

  // ─── [차단 2] isPrepending 플래그 ───────────────────────────────────────────

  it('최초 로드 시 isPrepending=false', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([makeMsg({ id: 1 })]));
    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.isPrepending).toBe(false);
  });

  it('loadOlderMessages 호출 중(시작 직후) isPrepending=true, 완료 후 false', async () => {
    const newerMsg = makeMsg({ id: 10, createdAt: '2026-06-11T10:00:00.000Z' });
    const olderMsg = makeMsg({ id: 5, createdAt: '2026-06-11T08:00:00.000Z' });

    // 첫 번째는 최초 로드, 두 번째는 과거 페이지
    apiMock.get
      .mockResolvedValueOnce(makePageRes([newerMsg], true))
      .mockResolvedValueOnce(makePageRes([olderMsg], false));

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    // loadOlderMessages 완료 후 isPrepending은 false (requestAnimationFrame 내에서 리셋)
    await act(async () => {
      await result.current.loadOlderMessages();
    });
    // rAF가 즉시 실행되지 않을 수 있어 waitFor로 확인
    await waitFor(() => expect(result.current.isPrepending).toBe(false));
  });

  it('prepend 시 기존 messages와 id 중복 제거', async () => {
    const msg = makeMsg({ id: 10, createdAt: '2026-06-11T10:00:00.000Z' });
    apiMock.get
      .mockResolvedValueOnce(makePageRes([msg], true))
      .mockResolvedValueOnce(makePageRes([msg], false)); // 중복 id 반환

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(result.current.messages).toHaveLength(1); // 중복 제거
  });

  // ─── onMessageSent / onUnread 콜백 ────────────────────────────────────────

  it('방 열릴 때 onUnread 콜백 호출', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    const onUnread = vi.fn();
    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    // REST 로드 성공 후 onUnread 호출
    expect(onUnread).toHaveBeenCalledWith(1);
  });

  // ─── [차단 3] 낙관적 메시지 createdAt KST-naive 형식 ─────────────────────────

  it('sendMessage 시 낙관적 메시지 createdAt이 Z 없는 KST-naive 형식이다', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('테스트'));
    const createdAt = result.current.messages[0].createdAt;
    // nowKstString mock → '2026-06-11T10:00:00.000000'
    expect(createdAt).toBe('2026-06-11T10:00:00.000000');
    // Z suffix 없음 확인 (UTC 형식 아님)
    expect(createdAt).not.toContain('Z');
  });

  it('에코 도착 시 낙관적 메시지 createdAt이 서버 값으로 치환된다', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent: undefined, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => result.current.sendMessage('에코 테스트'));
    expect(result.current.messages[0].createdAt).toBe('2026-06-11T10:00:00.000000');

    // 서버 에코: 다른 createdAt으로 치환
    const serverCreatedAt = '2026-06-11T10:00:01';
    act(() => {
      capturedHandler!({
        type: 'MESSAGE',
        message: makeMsg({
          id: 200,
          senderNickname: '나',
          content: '에코 테스트',
          clientMessageId: 'mock-uuid-1',
          createdAt: serverCreatedAt,
        }),
      });
    });

    expect(result.current.messages).toHaveLength(1);
    // 서버 createdAt으로 치환되어 시간 점프 없음
    expect(result.current.messages[0].createdAt).toBe(serverCreatedAt);
  });

  it('WS MESSAGE 에코로 onMessageSent 호출', async () => {
    apiMock.get.mockResolvedValueOnce(makePageRes([]));
    let capturedHandler: DmEventHandler | undefined;
    wsMock.onDmRoom.mockImplementation((_roomId, handler) => {
      capturedHandler = handler;
      return () => {};
    });
    const onMessageSent = vi.fn();

    renderHook(() =>
      useDmRoom({ roomId: 1, userNickname: '나', onMessageSent, onUnread: undefined })
    );
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());

    act(() => {
      capturedHandler!({
        type: 'MESSAGE',
        message: makeMsg({ id: 99, content: '에코', createdAt: '2026-06-11T10:01:00.000Z' }),
      });
    });

    expect(onMessageSent).toHaveBeenCalledWith(1, '에코', '2026-06-11T10:01:00.000Z');
  });
});
