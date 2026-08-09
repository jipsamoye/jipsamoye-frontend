import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom은 AnimationEvent를 구현하지 않는다 — Testing Library가 plain Event로 폴백하면서
// animationName이 통째로 사라져 "어떤 애니메이션이 끝났는지"로 분기하는 코드를 테스트할 수 없다.
// 브라우저와 동일하게 init을 그대로 노출하는 최소 구현만 채운다.
if (typeof window.AnimationEvent === 'undefined') {
  class AnimationEventPolyfill extends Event {
    readonly animationName: string;
    readonly elapsedTime: number;
    readonly pseudoElement: string;
    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init);
      this.animationName = init.animationName ?? '';
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? '';
    }
  }
  window.AnimationEvent = AnimationEventPolyfill as unknown as typeof AnimationEvent;
}

afterEach(() => {
  cleanup();
});
