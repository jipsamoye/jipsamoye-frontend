import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'sounds', 'keycap');
const IDS = ['brown', 'blue', 'red', 'navy', 'cream', 'jade', 'black'] as const;

// mono 44.1kHz 16bit = 88,200 bytes/초. 헤더 여유 1KB.
const bytesForMs = (ms: number) => Math.ceil((88_200 * ms) / 1000) + 1024;

describe('키캡 사운드 자산', () => {
  it('7축 × down/up = WAV 14개가 존재하고 RIFF/WAVE 헤더를 가진다', () => {
    for (const id of IDS) {
      for (const dir of ['down', 'up'] as const) {
        const buf = readFileSync(path.join(DIR, `${id}-${dir}.wav`));
        expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
        expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
      }
    }
  });

  it('모든 클립이 160ms 이하다 — 제이드 252ms 원본이 트림 없이 들어오면 실패', () => {
    for (const id of IDS) {
      for (const dir of ['down', 'up'] as const) {
        const { size } = statSync(path.join(DIR, `${id}-${dir}.wav`));
        expect(size, `${id}-${dir}.wav`).toBeLessThanOrEqual(bytesForMs(160));
      }
    }
  });

  it('LICENSE.txt에 kbsim MIT 고지가 있다', () => {
    const text = readFileSync(path.join(DIR, 'LICENSE.txt'), 'utf-8');
    expect(text).toContain('kbsim');
    expect(text).toContain('Thomas Lai');
    expect(text).toContain('MIT');
  });
});
