import { describe, it, expect } from 'vitest';
import {
  isChatMessage,
  isChatProfileEvent,
  isNotification,
  isWsErrorEvent,
} from '@/lib/wsGuards';

describe('wsGuards — WS 메시지 런타임 타입 가드', () => {
  describe('isChatMessage', () => {
    it('id(number)+senderNickname+content가 있고 type이 없으면 true', () => {
      expect(
        isChatMessage({ id: 1, senderNickname: 'A', content: '안녕', createdAt: '' })
      ).toBe(true);
    });
    it('type 필드가 있으면 채팅 메시지로 보지 않는다 (이벤트와 구분)', () => {
      expect(
        isChatMessage({ type: 'PROFILE_UPDATED', id: 1, senderNickname: 'A', content: 'x' })
      ).toBe(false);
    });
    it('id가 없거나 형이 다르면 false', () => {
      expect(isChatMessage({ senderNickname: 'A', content: 'x' })).toBe(false);
      expect(isChatMessage({ id: '1', senderNickname: 'A', content: 'x' })).toBe(false);
    });
    it('null/원시값/문자열은 false', () => {
      expect(isChatMessage(null)).toBe(false);
      expect(isChatMessage('text')).toBe(false);
      expect(isChatMessage(42)).toBe(false);
    });
  });

  describe('isChatProfileEvent', () => {
    it('type=PROFILE_UPDATED + nickname(string)이면 true', () => {
      expect(
        isChatProfileEvent({ type: 'PROFILE_UPDATED', nickname: 'A', profileImageUrl: null })
      ).toBe(true);
    });
    it('type이 다르면 false', () => {
      expect(isChatProfileEvent({ type: 'MESSAGE', nickname: 'A' })).toBe(false);
    });
    it('nickname이 없으면 false', () => {
      expect(isChatProfileEvent({ type: 'PROFILE_UPDATED' })).toBe(false);
    });
  });

  describe('isNotification', () => {
    it('id(number)+type(string)이면 true', () => {
      expect(isNotification({ id: 1, type: 'LIKE' })).toBe(true);
    });
    it('id/type 누락 또는 형 불일치면 false', () => {
      expect(isNotification({ type: 'LIKE' })).toBe(false);
      expect(isNotification({ id: 1 })).toBe(false);
      expect(isNotification({ id: '1', type: 'LIKE' })).toBe(false);
      expect(isNotification(null)).toBe(false);
    });
  });

  describe('isWsErrorEvent (백엔드 M-1 계약: { code, message })', () => {
    it('code(string)+message(string)이면 true', () => {
      expect(isWsErrorEvent({ code: 'FORBIDDEN', message: '권한 없음' })).toBe(true);
    });
    it('code/message 누락 또는 형 불일치면 false', () => {
      expect(isWsErrorEvent({ code: 'X' })).toBe(false);
      expect(isWsErrorEvent({ message: 'X' })).toBe(false);
      expect(isWsErrorEvent({ code: 1, message: 'X' })).toBe(false);
      expect(isWsErrorEvent(null)).toBe(false);
      expect(isWsErrorEvent('error')).toBe(false);
    });
  });
});
