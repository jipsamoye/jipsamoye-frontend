import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/layout/icons', () => ({
  HeartIcon: ({ filled }: { filled: boolean }) => <svg data-testid="heart" data-filled={String(filled)} />,
  ShareIcon: () => <svg data-testid="share" />,
}));

import PostActions from '@/components/domain/PostActions';

describe('PostActions', () => {
  it('좋아요 버튼에 카운트가 표시된다', () => {
    render(<PostActions likeCount={1987} liked={false} onLike={vi.fn()} onShare={vi.fn()} />);
    expect(screen.getByRole('button', { name: /좋아요/ })).toHaveTextContent('1987');
  });

  it('좋아요 클릭 시 onLike가 호출된다', () => {
    const onLike = vi.fn();
    render(<PostActions likeCount={0} liked={false} onLike={onLike} onShare={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /좋아요/ }));
    expect(onLike).toHaveBeenCalledOnce();
  });

  it('공유하기 클릭 시 onShare가 호출된다', () => {
    const onShare = vi.fn();
    render(<PostActions likeCount={0} liked={false} onLike={vi.fn()} onShare={onShare} />);
    fireEvent.click(screen.getByRole('button', { name: /공유하기/ }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('liked=true 이면 amber-600 클래스가 적용된다', () => {
    render(<PostActions likeCount={1} liked={true} onLike={vi.fn()} onShare={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /좋아요/ });
    expect(btn.className).toContain('bg-amber-600');
  });
});
