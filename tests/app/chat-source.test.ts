import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 오픈채팅 페이지의 시간 표시(H-3) / 전송 실패 처리(H-4) 회귀 방지.
// chat 페이지는 WS·AuthProvider 의존이 무거워 렌더 테스트 대신 소스 검사로 가드한다
// (chat-silent.test.ts 컨벤션). 시간 포매팅 자체의 동작 검증은 lib/utils.test.ts가 담당.
describe('chat 페이지 — 시간/전송실패 회귀 방지', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/app/chat/page.tsx'),
    'utf-8'
  );

  // ── H-3: 시간 9시간 오차 — 단일 파이프라인(@/lib/utils formatTime) 사용 ──
  it('로컬 formatTime 함수를 정의하지 않는다 (버그 재도입 방지)', () => {
    // `function formatTime(` 형태의 로컬 정의가 없어야 한다.
    expect(source).not.toMatch(/function\s+formatTime\s*\(/);
  });

  it('@/lib/utils 에서 formatTime을 import한다', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bformatTime\b[^}]*\}\s*from\s*['"]@\/lib\/utils['"]/);
  });

  it("createdAt에 'Z'를 강제로 붙이거나 endsWith('Z')로 UTC 해석하지 않는다", () => {
    // 버그였던 `dateStr + 'Z'` / `.endsWith('Z')` 패턴이 없어야 한다.
    expect(source).not.toMatch(/\+\s*['"]Z['"]/);
    expect(source).not.toMatch(/endsWith\(\s*['"]Z['"]\s*\)/);
  });

  // ── H-4: 전송 실패 무피드백 소실 — 반환값 확인 + 입력 보존 + 토스트 ──
  it('handleSend가 wsService.send(...)의 반환값을 변수로 받는다', () => {
    expect(source).toMatch(/const\s+\w+\s*=\s*wsService\.send\(/);
  });

  it('전송 실패 시 showToast로 사용자에게 알린다', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bshowToast\b[^}]*\}\s*from\s*['"]@\/components\/common\/Toast['"]/);
    expect(source).toMatch(/showToast\(/);
  });

  it('전송 실패 시 setInput으로 입력을 비우기 전에 early return 한다 (입력 보존)', () => {
    // `if (!sent) { ... return; }` 패턴으로 실패 시 입력 초기화를 건너뛴다.
    const handleSend = source.slice(source.indexOf('function handleSend'));
    const body = handleSend.slice(0, handleSend.indexOf('\n  }') + 4);
    // 실패 분기(return)가 setInput('') 호출보다 먼저 등장해야 입력이 보존된다.
    const returnIdx = body.search(/if\s*\(\s*!sent\s*\)[\s\S]*?return/);
    const clearIdx = body.indexOf("setInput('')");
    expect(returnIdx).toBeGreaterThanOrEqual(0);
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(returnIdx).toBeLessThan(clearIdx);
  });
});
