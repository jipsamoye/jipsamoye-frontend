import { showToast } from '@/components/common/Toast';

/**
 * 네이티브 공유 시트(navigator.share) 우선, 미지원 브라우저는 클립보드 복사 폴백.
 * 안내 토스트까지 내부에서 처리하므로 호출부는 fire-and-forget으로 쓴다.
 */
export async function shareOrCopyLink({ title, url }: { title: string; url: string }): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      // 공유 시트를 닫은 경우(AbortError) — 안내 불필요
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showToast('링크가 복사됐어요!');
  } catch {
    showToast('링크 복사에 실패했어요.');
  }
}
