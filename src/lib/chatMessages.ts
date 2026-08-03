import type { ChatMessage } from '@/types/api';

interface MergeChatMessagesResult {
  messages: ChatMessage[];
  /** 스냅샷으로 통째 교체됐는지 — true면 호출부에서 hasMore도 스냅샷 기준으로 갱신 필요 */
  replaced: boolean;
}

/**
 * 재연결 시 최신 스냅샷(fetched)을 기존 목록(prev)에 병합.
 * - 겹치는 id가 있으면(정상 케이스): 없는 것만 id 오름차순으로 뒤에 append
 * - 겹침이 전혀 없으면(스냅샷 크기 초과 유실 갭): 타임라인 구멍 대신 스냅샷으로 통째 교체
 * - prev가 비면 교체, fetched가 비면 prev 유지
 * 서버 id는 단조 증가, prev는 절단 시점까지 연속이므로 append 순서가 보장된다.
 */
export function mergeChatMessages(
  prev: ChatMessage[],
  fetched: ChatMessage[]
): MergeChatMessagesResult {
  if (fetched.length === 0) return { messages: prev, replaced: false };

  const sorted = [...fetched].sort((a, b) => a.id - b.id);
  if (prev.length === 0) return { messages: sorted, replaced: true };

  const prevIds = new Set(prev.map((m) => m.id));
  if (!sorted.some((m) => prevIds.has(m.id))) {
    return { messages: sorted, replaced: true };
  }

  const fresh = sorted.filter((m) => !prevIds.has(m.id));
  return { messages: [...prev, ...fresh], replaced: false };
}
