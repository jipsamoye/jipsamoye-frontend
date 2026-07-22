import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { User } from '@/types/api';

const { routerMock, authMock, guardMock, toastMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  authMock: { user: { nickname: '손님4c8775' } as unknown as User, loading: false },
  guardMock: { setBlocked: vi.fn(), guardedPush: vi.fn(), interceptLink: vi.fn() },
  toastMock: { showToast: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/components/providers/NavigationGuard', () => ({ useNavigationGuard: () => guardMock }));
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

import PostEditor from '@/components/domain/PostEditor';

// 재현: AI 키캡 자동 게시 글은 content가 null로 내려온다 (GET /api/posts/{id}).
// 수정 페이지가 이를 그대로 PostEditor에 넘기면, 내용 textarea 포커스 시
// content.length 평가에서 TypeError → Next.js 기본 에러 화면("This page couldn't load").
describe('PostEditor — 피규어 자동 게시 글(content: null) 수정', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('content가 null이어도 내용 textarea 포커스 시 크래시하지 않는다', () => {
    render(
      <PostEditor
        mode="edit"
        postId="28"
        initialTitle="AI 키캡 자랑"
        initialContent={null as unknown as string}
        initialImageUrls={['https://images.jipsamoye.com/posts/94/a.png']}
      />
    );

    const textarea = screen.getByPlaceholderText('내용을 입력해 주세요');
    expect(() => fireEvent.focus(textarea)).not.toThrow();
    expect(screen.getByText(/\/1000|\/2000|\/\d+/)).toBeTruthy();
  });

  it('content가 null이어도 글자수 카운터가 0으로 표시된다', () => {
    render(
      <PostEditor
        mode="edit"
        postId="28"
        initialTitle="AI 키캡 자랑"
        initialContent={null as unknown as string}
        initialImageUrls={['https://images.jipsamoye.com/posts/94/a.png']}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('내용을 입력해 주세요'));
    expect(screen.getByText(/^0\//)).toBeTruthy();
  });
});
