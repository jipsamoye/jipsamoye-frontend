import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import type { Comment, User } from '@/types/api';

const { useCommentsMock } = vi.hoisted(() => ({
  useCommentsMock: vi.fn(),
}));

vi.mock('@/hooks/useComments', () => ({
  useComments: useCommentsMock,
}));

import CommentSection from '@/components/domain/CommentSection';

const makeComment = (over: Partial<Comment> = {}): Comment => ({
  id: 1,
  content: '귀엽네요',
  nickname: '집사A',
  profileImageUrl: null,
  mentionedNickname: null,
  isMasked: false,
  replyCount: 0,
  replies: [],
  createdAt: '2026-04-28T12:00:00Z',
  updatedAt: '2026-04-28T12:00:00Z',
  ...over,
});

const makeUser = (nickname = '나'): User => ({
  nickname,
  bio: null,
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 0,
  followerCount: 0,
  followingCount: 0,
  totalLikeCount: 0,
  ranking: null,
  createdAt: '',
});

const setupHook = (over: {
  comments?: Comment[];
  hasNext?: boolean;
  loadMore?: ReturnType<typeof vi.fn>;
  loadReplies?: ReturnType<typeof vi.fn>;
  addComment?: ReturnType<typeof vi.fn>;
  updateComment?: ReturnType<typeof vi.fn>;
  deleteComment?: ReturnType<typeof vi.fn>;
} = {}) => {
  const mock = {
    comments: over.comments ?? [],
    hasNext: over.hasNext ?? false,
    loading: false,
    loaded: true,
    load: vi.fn(),
    loadMore: over.loadMore ?? vi.fn(),
    loadReplies: over.loadReplies ?? vi.fn(),
    addComment: over.addComment ?? vi.fn().mockResolvedValue(makeComment()),
    updateComment: over.updateComment ?? vi.fn(),
    deleteComment: over.deleteComment ?? vi.fn().mockResolvedValue(-1),
  };
  useCommentsMock.mockReturnValue(mock);
  return mock;
};

describe('CommentSection', () => {
  beforeEach(() => {
    useCommentsMock.mockReset();
  });

  it('마스킹된 댓글은 "삭제된 댓글입니다"로 표시되고 답글 버튼이 노출되지 않는다', () => {
    setupHook({
      comments: [makeComment({ id: 1, isMasked: true, content: null, replyCount: 1, replies: [makeComment({ id: 10 })] })],
    });
    const { getByText, queryAllByText } = render(<CommentSection postId="42" user={makeUser()} />);
    expect(getByText('삭제된 댓글입니다')).toBeInTheDocument();
    // 마스킹 댓글 본인의 답글 버튼은 없어야 — 단, 자식 답글의 답글 버튼은 있을 수 있음
    // 답글 버튼이 정확히 자식 답글 1개에만 있는지 확인
    expect(queryAllByText('답글')).toHaveLength(1);
  });

  it('답글에 mentionedNickname 이 있으면 @닉네임 prefix 가 보인다', () => {
    setupHook({
      comments: [
        makeComment({
          id: 1,
          replyCount: 1,
          replies: [makeComment({ id: 10, content: '저도요!', mentionedNickname: '집사A' })],
        }),
      ],
    });
    const { getByText } = render(<CommentSection postId="42" user={null} />);
    expect(getByText('@집사A')).toBeInTheDocument();
  });

  it('replyCount > replies.length 일 때 "N개 더보기" 버튼이 보이고 클릭 시 loadReplies 호출', () => {
    const loadReplies = vi.fn();
    setupHook({
      comments: [makeComment({ id: 1, replyCount: 5, replies: [makeComment({ id: 10 }), makeComment({ id: 11 }), makeComment({ id: 12 })] })],
      loadReplies,
    });
    const { getByText } = render(<CommentSection postId="42" user={null} />);
    const moreBtn = getByText('답글 2개 더보기');
    fireEvent.click(moreBtn);
    expect(loadReplies).toHaveBeenCalledWith(1);
  });

  it('hasNext=true 일 때 "댓글 더보기" 버튼이 보이고 클릭 시 loadMore 호출', () => {
    const loadMore = vi.fn();
    setupHook({
      comments: [makeComment({ id: 1 })],
      hasNext: true,
      loadMore,
    });
    const { getByText } = render(<CommentSection postId="42" user={null} />);
    const more = getByText('댓글 더보기');
    fireEvent.click(more);
    expect(loadMore).toHaveBeenCalled();
  });

  it('답글 row 에도 답글 버튼이 노출된다', () => {
    setupHook({
      comments: [
        makeComment({
          id: 1, replyCount: 1,
          replies: [makeComment({ id: 10, nickname: '다른사람' })],
        }),
      ],
    });
    const { queryAllByText } = render(<CommentSection postId="42" user={makeUser('나')} />);
    // 부모 + 답글 row 각각에 답글 버튼 = 2개
    expect(queryAllByText('답글')).toHaveLength(2);
  });

  it('답글의 답글 작성 시 rootId=부모, parentId=답글 id 로 addComment 호출', async () => {
    const addComment = vi.fn().mockResolvedValue(makeComment());
    setupHook({
      comments: [
        makeComment({
          id: 1, replyCount: 1,
          replies: [makeComment({ id: 10, nickname: '답글주인' })],
        }),
      ],
      addComment,
    });
    const { getAllByText, getByPlaceholderText } = render(<CommentSection postId="42" user={makeUser('나')} />);
    // 두 번째 답글 버튼이 답글의 답글 버튼
    fireEvent.click(getAllByText('답글')[1]);
    const input = getByPlaceholderText('답글을 입력하세요');
    fireEvent.change(input, { target: { value: '동의해요' } });
    await act(async () => {
      fireEvent.click(getAllByText('등록')[0]);
    });
    expect(addComment).toHaveBeenCalledWith({ rootId: 1, parentId: 10, content: '동의해요' });
  });

  it('부모 댓글 작성은 rootId=null, parentId=null', async () => {
    const addComment = vi.fn().mockResolvedValue(makeComment());
    const onCountChange = vi.fn();
    setupHook({ addComment });
    const { getByPlaceholderText, getByText } = render(
      <CommentSection postId="42" user={makeUser('나')} onCountChange={onCountChange} />,
    );
    fireEvent.change(getByPlaceholderText('댓글 달기'), { target: { value: '신규댓글' } });
    await act(async () => { fireEvent.click(getByText('댓글')); });
    expect(addComment).toHaveBeenCalledWith({ rootId: null, parentId: null, content: '신규댓글' });
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('삭제 시 deleteComment 가 반환한 delta 만큼 onCountChange 호출', async () => {
    const deleteComment = vi.fn().mockResolvedValue(-1);
    const onCountChange = vi.fn();
    setupHook({
      comments: [makeComment({ id: 1, nickname: '나' })],
      deleteComment,
    });
    const { getByText, container } = render(
      <CommentSection postId="42" user={makeUser('나')} onCountChange={onCountChange} />,
    );
    // 메뉴 열기 (자기 댓글이므로)
    const menuBtn = container.querySelector('button[class*="rounded"][class*="text-gray-400"]');
    if (menuBtn) fireEvent.click(menuBtn);
    await act(async () => { fireEvent.click(getByText('삭제')); });
    expect(deleteComment).toHaveBeenCalledWith(1);
    expect(onCountChange).toHaveBeenCalledWith(-1);
  });

  it('각 댓글에 id="comment-{id}" 가 부여된다 (앵커 스크롤용)', () => {
    setupHook({
      comments: [
        makeComment({ id: 1, replyCount: 1, replies: [makeComment({ id: 10 })] }),
        makeComment({ id: 2 }),
      ],
    });
    const { container } = render(<CommentSection postId="42" user={null} />);
    expect(container.querySelector('#comment-1')).toBeTruthy();
    expect(container.querySelector('#comment-2')).toBeTruthy();
    expect(container.querySelector('#comment-10')).toBeTruthy();
  });

  it('좋아요 하트 아이콘 + 숫자 0 카운트 블록은 더 이상 렌더되지 않는다', () => {
    setupHook({ comments: [makeComment({ id: 1 })] });
    const { container } = render(<CommentSection postId="42" user={makeUser('나')} />);
    // 이전 구현의 하트 SVG path d 속성 (0 카운트 영역 식별자)
    const heartPath = container.querySelector('path[d^="M21 8.25c0-2.485"]');
    expect(heartPath).toBeNull();
  });
});
