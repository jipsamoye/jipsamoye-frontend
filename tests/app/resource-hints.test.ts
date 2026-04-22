import { describe, it, expect } from 'vitest';
import { resourceHints } from '@/app/resource-hints';

describe('resourceHints (preconnect)', () => {
  it('이미지 CDN 도메인에 preconnect 힌트를 포함한다', () => {
    const hint = resourceHints.find((h) => h.href === 'https://images.jipsamoye.com');
    expect(hint).toBeDefined();
    expect(hint?.rel).toBe('preconnect');
  });

  it('API 도메인에 preconnect 힌트를 포함한다', () => {
    const hint = resourceHints.find((h) => h.href === 'https://api.jipsamoye.com');
    expect(hint).toBeDefined();
    expect(hint?.rel).toBe('preconnect');
  });

  it('API 도메인 preconnect 는 use-credentials crossOrigin 을 사용한다', () => {
    // api.ts 가 credentials:"include" 로 호출하므로 preconnect 커넥션을 공유하려면
    // credentials 모드가 일치해야 한다. 없으면 실제 요청 시 새 커넥션을 맺어 preconnect 효과 소멸.
    const hint = resourceHints.find((h) => h.href === 'https://api.jipsamoye.com');
    expect(hint?.crossOrigin).toBe('use-credentials');
  });

  it('이미지 CDN preconnect 는 crossOrigin 을 지정하지 않는다', () => {
    // <img> 태그는 기본적으로 CORS 모드 아님. crossOrigin 지정하면 오히려 커넥션 분리됨.
    const hint = resourceHints.find((h) => h.href === 'https://images.jipsamoye.com');
    expect(hint?.crossOrigin).toBeUndefined();
  });
});
