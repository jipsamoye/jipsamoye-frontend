import type { Notification } from '@/types/api';

/**
 * 알림 클릭 시 이동할 URL을 결정.
 * - FOLLOW: /users/{senderNickname}
 * - PET_POST_COMMENT_REPLY: /posts/{relatedPostId}#comment-{targetId}
 * - BOARD_COMMENT_REPLY: /board/{relatedPostId}#comment-{targetId}
 * - 그 외 게시글 알림: /posts/{relatedPostId}
 * - 구버전 호환 fallback: /posts/{targetId}
 *
 * 라우팅 정보가 부족하면 null.
 */
export function getNotificationLink(n: Notification): string | null {
  if (n.type === 'FOLLOW') {
    return `/users/${n.senderNickname}`;
  }
  if (n.type === 'PET_POST_COMMENT_REPLY' && n.relatedPostId && n.targetId) {
    return `/posts/${n.relatedPostId}#comment-${n.targetId}`;
  }
  if (n.type === 'BOARD_COMMENT_REPLY' && n.relatedPostId && n.targetId) {
    return `/board/${n.relatedPostId}#comment-${n.targetId}`;
  }
  if (n.relatedPostId) {
    return `/posts/${n.relatedPostId}`;
  }
  if (n.targetId) {
    return `/posts/${n.targetId}`;
  }
  return null;
}
