import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { PetPost, User } from '@/types/api';

const { routerMock, apiMock, authMock, soundMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  soundMock: { playKeycapSound: vi.fn(), warmKeycapSound: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useOpenDm', () => ({ useOpenDm: () => vi.fn() }));
vi.mock('@/lib/keycapSound', () => soundMock);
vi.mock('@/components/common/Avatar', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/PostCard', () => ({ default: () => <div /> }));
vi.mock('@/components/domain/CommentSection', () => ({ default: () => <div /> }));

import PostDetailPage from '@/app/posts/[id]/page';

const basePost: PetPost = {
  id: 7,
  title: 'AI 키캡 자랑',
  content: '자랑합니다',
  imageUrls: [
    'https://images.jipsamoye.com/posts/7/1.png',
    'https://images.jipsamoye.com/posts/7/2.png',
  ],
  likeCount: 3,
  commentCount: 0,
  nickname: '집사',
  profileImageUrl: null,
  createdAt: '2026-08-08T10:00:00',
  updatedAt: '2026-08-08T10:00:00',
  isLiked: false,
  aiGenerated: true,
};

async function renderPage(post: PetPost) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === `/api/posts/${post.id}`) return Promise.resolve({ data: post });
    return Promise.resolve({ data: { content: [] } });
  });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PostDetailPage params={Promise.resolve({ id: String(post.id) })} />
      </Suspense>,
    );
  });
  await screen.findByText('자랑합니다');
}

describe('게시글 상세 — 키캡 누르기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('AI 키캡 글: 첫 이미지만 눌리고 두 번째는 그대로다', async () => {
    await renderPage(basePost);
    const keyButtons = screen.getAllByRole('button', { name: '키캡 누르기' });
    expect(keyButtons).toHaveLength(1);
    expect(keyButtons[0]).toContainElement(screen.getByAltText('AI 키캡 자랑 1'));
    expect(keyButtons[0]).not.toContainElement(screen.getByAltText('AI 키캡 자랑 2'));
  });

  it('누르면 소리가 난다 — 동작은 결과 화면과 동일', async () => {
    await renderPage(basePost);
    fireEvent.pointerDown(screen.getByRole('button', { name: '키캡 누르기' }));
    expect(soundMock.playKeycapSound).toHaveBeenCalledWith('brown', 'down');
  });

  it('유도도 배지도 없다 — 눌러보기·물결·AI 키캡 배지 모두 없음', async () => {
    await renderPage(basePost);
    expect(screen.queryByText('눌러보기')).toBeNull();
    expect(document.querySelector('[data-testid="keycap-ripple"]')).toBeNull();
    // AI 키캡 배지는 상세에서 제거 — 스쿼시 시 배지만 홀로 남는 위화감 때문 (식별은 칩바·제목이 맡음)
    expect(screen.queryByText('AI 키캡')).toBeNull();
  });

  it('키캡 블록은 데스크톱에서 max-w-xl로 제한된다 — 칩바·음소거가 폴드 안에 들어오게', async () => {
    await renderPage(basePost);
    const keyButton = screen.getByRole('button', { name: '키캡 누르기' });
    // 결과 화면·공유 페이지와 같은 폭(576px). 넓은 상세 컬럼에서 1:1 이미지가
    // 900px로 커지면 칩바·음소거가 폴드 아래로 밀린다 (음소거 상시 가시 원칙 위반)
    expect(keyButton.closest('.max-w-xl.mx-auto')).not.toBeNull();
  });

  it('일반 글(aiGenerated=false): 아무 것도 안 바뀐다', async () => {
    await renderPage({ ...basePost, id: 8, title: '우리집 고양이', aiGenerated: false });
    expect(screen.queryByRole('button', { name: '키캡 누르기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '갈축' })).toBeNull();
  });
});
