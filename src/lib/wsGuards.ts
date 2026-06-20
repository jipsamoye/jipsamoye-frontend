// WebSocket 메시지 경계 런타임 타입 가드.
// STOMP 프레임 body는 JSON.parse 결과가 `unknown`이므로, 광범위한 `as` 단언 대신
// 이 가드들로 형태를 검증한 뒤 좁혀 사용한다. 형태가 어긋난 페이로드는 안전하게 무시한다.
import type {
  ChatMessage,
  Notification,
  WsErrorEvent,
} from '@/types/api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 오픈채팅 프로필 변경 이벤트: { type: 'PROFILE_UPDATED', nickname, profileImageUrl } */
export interface ChatProfileEvent {
  type: 'PROFILE_UPDATED';
  nickname: string;
  profileImageUrl: string | null;
}

export function isChatProfileEvent(value: unknown): value is ChatProfileEvent {
  return (
    isRecord(value) &&
    value.type === 'PROFILE_UPDATED' &&
    typeof value.nickname === 'string'
  );
}

/** 오픈채팅 메시지: id(number) + senderNickname(string) + content(string) 필수 */
export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    value.type === undefined &&
    typeof value.id === 'number' &&
    typeof value.senderNickname === 'string' &&
    typeof value.content === 'string'
  );
}

/** 알림: id(number) + type(string) 필수 */
export function isNotification(value: unknown): value is Notification {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.type === 'string'
  );
}

/**
 * 백엔드 M-1 구조화 에러 이벤트 (계약 FINAL):
 *   destination `/user/sub/errors`, payload `{ code: string, message: string }`
 */
export function isWsErrorEvent(value: unknown): value is WsErrorEvent {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}
