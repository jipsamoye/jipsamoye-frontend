import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// chat 페이지는 WS/AuthProvider 의존이 무거워 렌더 테스트 대신 소스 검증으로
// 회귀를 방지한다(동일 관례: chat-source.test.ts). 병합 로직 자체는
// tests/lib/chatMessages.test.ts 에서 단위 테스트로 검증한다.
describe('chat 페이지 — 재연결 재동기화 배선', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/app/chat/page.tsx'),
    'utf-8'
  );

  it('wsService.onReconnect를 등록하고 해제 함수를 cleanup으로 반환한다', () => {
    expect(source).toMatch(/wsService\.onReconnect\(/);
    const afterRegistration = source.slice(source.indexOf('wsService.onReconnect('));
    expect(afterRegistration).toMatch(/return unsubscribe/);
  });

  it('재조회 결과를 mergeChatMessages(messagesRef.current, ...)로 병합한다', () => {
    expect(source).toMatch(/import \{ mergeChatMessages \} from '@\/lib\/chatMessages'/);
    expect(source).toMatch(/mergeChatMessages\(messagesRef\.current/);
  });

  it('통째 교체(replaced)일 때만 hasMore를 갱신한다', () => {
    expect(source).toMatch(/if \(replaced\) setHasMore/);
  });
});
