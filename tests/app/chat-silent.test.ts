import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat 페이지 — 401 토스트 회귀 방지', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/app/chat/page.tsx'),
    'utf-8'
  );

  it("/api/chat/messages GET 호출은 모두 { silent: true } 옵션을 사용한다", () => {
    const calls = source.match(/api\.get<[^>]*>\([^)]*\/api\/chat\/messages[^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/silent:\s*true/);
    }
  });
});
