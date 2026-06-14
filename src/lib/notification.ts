import type { Notification } from '@/types/api';

/**
 * 알림 클릭 시 이동할 URL을 결정.
 * - FOLLOW: /users/{senderNickname}
 * - BOARD_COMMENT / BOARD_COMMENT_REPLY: /board/{relatedPostId}(#comment-{targetId})
 * - PET_POST_COMMENT / PET_POST_COMMENT_REPLY: /posts/{relatedPostId}(#comment-{targetId})
 * - 그 외 게시글 알림(LIKE 등): /posts/{relatedPostId}
 * - 구버전 호환 fallback: /posts/{targetId}
 *
 * 라우팅 정보가 부족하면 null.
 */
export function getNotificationLink(n: Notification): string | null {
  if (n.type === 'FOLLOW') {
    return `/users/${n.senderNickname}`;
  }
  // 게시판 댓글/답글 → /board (앵커는 targetId 있을 때만)
  if ((n.type === 'BOARD_COMMENT' || n.type === 'BOARD_COMMENT_REPLY') && n.relatedPostId) {
    return n.targetId
      ? `/board/${n.relatedPostId}#comment-${n.targetId}`
      : `/board/${n.relatedPostId}`;
  }
  // 게시글 댓글/답글 → /posts
  if ((n.type === 'PET_POST_COMMENT' || n.type === 'PET_POST_COMMENT_REPLY') && n.relatedPostId) {
    return n.targetId
      ? `/posts/${n.relatedPostId}#comment-${n.targetId}`
      : `/posts/${n.relatedPostId}`;
  }
  if (n.relatedPostId) {
    return `/posts/${n.relatedPostId}`;
  }
  if (n.targetId) {
    return `/posts/${n.targetId}`;
  }
  return null;
}
