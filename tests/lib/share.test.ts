import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shareOrCopyLink } from '@/lib/share';

const { toastMock } = vi.hoisted(() => ({ toastMock: { showToast: vi.fn() } }));
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));

function setNavigatorProp(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { writable: true, configurable: true, value });
}

describe('shareOrCopyLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorProp('share', undefined);
    setNavigatorProp('clipboard', undefined);
  });

  it('navigator.share 지원 시 title·url로 네이티브 공유 시트를 연다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('share', share);

    await shareOrCopyLink({ title: '제목 — 집사모여', url: 'https://jipsamoye.com/posts/7' });

    expect(share).toHaveBeenCalledWith({ title: '제목 — 집사모여', url: 'https://jipsamoye.com/posts/7' });
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('공유 시트를 닫아 reject(AbortError)돼도 토스트 없이 조용히 끝난다', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError'));
    setNavigatorProp('share', share);

    await expect(
      shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' }),
    ).resolves.toBeUndefined();
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('navigator.share 미지원 시 클립보드에 url을 복사하고 성공 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('clipboard', { writeText });

    await shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' });

    expect(writeText).toHaveBeenCalledWith('https://jipsamoye.com/posts/7');
    expect(toastMock.showToast).toHaveBeenCalledWith('링크가 복사됐어요!');
  });

  it('클립보드 복사 실패 시 실패 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setNavigatorProp('clipboard', { writeText });

    await shareOrCopyLink({ title: 't', url: 'https://jipsamoye.com/posts/7' });

    expect(toastMock.showToast).toHaveBeenCalledWith('링크 복사에 실패했어요.');
  });
});
