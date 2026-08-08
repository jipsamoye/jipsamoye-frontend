import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playKeycapSound, warmKeycapSound, resetKeycapSoundForTest } from '@/lib/keycapSound';

const flush = () => new Promise((r) => setTimeout(r, 0));

const sourceMock = { buffer: null as unknown, connect: vi.fn(), start: vi.fn() };

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'suspended';
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  decodeAudioData = vi.fn(() => Promise.resolve({ duration: 0.08 } as AudioBuffer));
  createBufferSource = vi.fn(() => sourceMock);
  constructor() {
    MockAudioContext.instances.push(this);
  }
}

describe('keycapSound', () => {
  beforeEach(() => {
    resetKeycapSoundForTest();
    MockAudioContext.instances = [];
    sourceMock.connect.mockClear();
    sourceMock.start.mockClear();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    ));
  });

  it('warm은 fetch만 하고 AudioContext를 만들지 않는다 (제약 2: 제스처 전 생성 금지)', async () => {
    warmKeycapSound('brown');
    await flush();
    expect(fetch).toHaveBeenCalledWith('/sounds/keycap/brown-down.wav');
    expect(fetch).toHaveBeenCalledWith('/sounds/keycap/brown-up.wav');
    expect(MockAudioContext.instances).toHaveLength(0);
  });

  it('play는 AudioContext를 호출 즉시(동기로) 생성하고 소스를 시작한다', async () => {
    playKeycapSound('brown', 'down');
    // 제스처 핸들러의 동기 구간 안에서 생성돼야 자동재생 정책을 통과한다
    expect(MockAudioContext.instances).toHaveLength(1);
    await flush();
    expect(sourceMock.start).toHaveBeenCalledTimes(1);
  });

  it('suspended 상태면 resume을 호출한다', async () => {
    playKeycapSound('brown', 'down');
    await flush();
    expect(MockAudioContext.instances[0].resume).toHaveBeenCalled();
  });

  it('AudioContext·fetch·decode는 재호출 시 캐시를 쓴다 (각 1회)', async () => {
    playKeycapSound('brown', 'down');
    await flush();
    playKeycapSound('brown', 'down');
    await flush();
    expect(MockAudioContext.instances).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === '/sounds/keycap/brown-down.wav')).toHaveLength(1);
    expect(MockAudioContext.instances[0].decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sourceMock.start).toHaveBeenCalledTimes(2);
  });

  it('warm으로 미리 받은 버퍼를 play가 재사용한다', async () => {
    warmKeycapSound('jade');
    await flush();
    playKeycapSound('jade', 'down');
    await flush();
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === '/sounds/keycap/jade-down.wav')).toHaveLength(1);
    expect(sourceMock.start).toHaveBeenCalledTimes(1);
  });

  it('fetch 실패(404)면 조용히 무시한다 — 소리는 보조 기능', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
    expect(() => playKeycapSound('brown', 'down')).not.toThrow();
    await flush();
    expect(sourceMock.start).not.toHaveBeenCalled();
  });

  it('AudioContext 미지원 환경이면 아무 일도 하지 않는다', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playKeycapSound('brown', 'down')).not.toThrow();
    await flush();
    expect(sourceMock.start).not.toHaveBeenCalled();
  });
});
