import { describe, it, expect } from 'vitest';
import { mergeChatMessages } from '@/lib/chatMessages';
import type { ChatMessage } from '@/types/api';

const makeMsg = (id: number, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderNickname: '집사',
  senderProfileImageUrl: null,
  content: `메시지 ${id}`,
  createdAt: '2026-08-03T10:00:00',
  ...overrides,
});

describe('mergeChatMessages — 재연결 스냅샷 병합', () => {
  it('겹치는 스냅샷이면 기존에 없는 메시지만 id 오름차순으로 뒤에 병합한다', () => {
    const prev = [makeMsg(1), makeMsg(2)];
    const fetched = [makeMsg(2), makeMsg(3), makeMsg(4)];

    const { messages, replaced } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(replaced).toBe(false);
  });

  it('이미 있는 id는 중복 추가하지 않는다 (WS가 재조회보다 먼저 도착한 메시지)', () => {
    const prev = [makeMsg(1), makeMsg(2), makeMsg(3)];
    const fetched = [makeMsg(2), makeMsg(3)];

    const { messages } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('겹치지 않는 스냅샷이면 통째로 교체하고 replaced=true를 반환한다 (30개 초과 유실 갭)', () => {
    const prev = [makeMsg(1), makeMsg(2)];
    const fetched = [makeMsg(50), makeMsg(51)];

    const { messages, replaced } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([50, 51]);
    expect(replaced).toBe(true);
  });

  it('prev가 비어 있으면 스냅샷으로 교체한다', () => {
    const { messages, replaced } = mergeChatMessages([], [makeMsg(1), makeMsg(2)]);

    expect(messages.map((m) => m.id)).toEqual([1, 2]);
    expect(replaced).toBe(true);
  });

  it('fetched가 비어 있으면 prev를 그대로 유지하고 replaced=false', () => {
    const prev = [makeMsg(1)];

    const { messages, replaced } = mergeChatMessages(prev, []);

    expect(messages).toBe(prev);
    expect(replaced).toBe(false);
  });

  it('내림차순으로 내려온 스냅샷도 id 오름차순으로 정렬해 병합한다', () => {
    const prev = [makeMsg(1)];
    const fetched = [makeMsg(3), makeMsg(1), makeMsg(2)];

    const { messages } = mergeChatMessages(prev, fetched);

    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });
});
