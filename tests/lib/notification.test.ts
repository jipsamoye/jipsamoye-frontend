import { describe, it, expect } from 'vitest';
import { getNotificationLink } from '@/lib/notification';
import type { Notification } from '@/types/api';

const base: Notification = {
  id: 1,
  type: 'LIKE',
  targetId: null,
  relatedPostId: null,
  message: '',
  senderNickname: '집사A',
  senderProfileImageUrl: null,
  isRead: false,
  createdAt: '',
};

describe('getNotificationLink', () => {
  it('FOLLOW → /users/{senderNickname}', () => {
    expect(getNotificationLink({ ...base, type: 'FOLLOW', targetId: 5 })).toBe('/users/집사A');
  });

  it('PET_POST_COMMENT_REPLY + relatedPostId + targetId → 해시 포함 URL', () => {
    expect(
      getNotificationLink({
        ...base,
        type: 'PET_POST_COMMENT_REPLY',
        relatedPostId: 42,
        targetId: 30,
      }),
    ).toBe('/posts/42#comment-30');
  });

  it('LIKE + relatedPostId → /posts/{relatedPostId}', () => {
    expect(getNotificationLink({ ...base, type: 'LIKE', relatedPostId: 99 })).toBe('/posts/99');
  });

  it('relatedPostId 우선 — targetId 가 있어도 게시글로', () => {
    expect(
      getNotificationLink({ ...base, type: 'LIKE', relatedPostId: 99, targetId: 7 }),
    ).toBe('/posts/99');
  });

  it('relatedPostId 없고 targetId 만 있으면 구버전 호환 fallback', () => {
    expect(getNotificationLink({ ...base, type: 'LIKE', targetId: 7 })).toBe('/posts/7');
  });

  it('BOARD_COMMENT_REPLY + relatedPostId + targetId → /board/{id}#comment-{id}', () => {
    expect(
      getNotificationLink({
        ...base,
        type: 'BOARD_COMMENT_REPLY',
        relatedPostId: 7,
        targetId: 55,
      }),
    ).toBe('/board/7#comment-55');
  });

  it('BOARD_COMMENT_REPLY 인데 relatedPostId 가 null 이면 fallback', () => {
    expect(
      getNotificationLink({
        ...base,
        type: 'BOARD_COMMENT_REPLY',
        relatedPostId: null,
        targetId: 55,
      }),
    ).toBe('/posts/55');
  });

  it('PET_POST_COMMENT_REPLY 인데 relatedPostId 가 null 이면 fallback (안전망)', () => {
    expect(
      getNotificationLink({
        ...base,
        type: 'PET_POST_COMMENT_REPLY',
        relatedPostId: null,
        targetId: 30,
      }),
    ).toBe('/posts/30');
  });

  it('아무 정보 없으면 null', () => {
    expect(getNotificationLink(base)).toBeNull();
  });
});
