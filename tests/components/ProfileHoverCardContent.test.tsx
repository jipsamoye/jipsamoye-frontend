import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { User } from '@/types/api';
import ProfileHoverCardContent from '@/components/domain/ProfileHoverCardContent';

// DM 개방: 메시지 버튼은 본인(isMe)이 아니면 팔로우 여부와 무관하게 항상 노출된다.
// following prop은 구독 버튼의 텍스트/스타일(구독 중 vs 구독하기)에만 영향을 준다.
// isFollowing 초기화는 ProfileHoverCard에서 담당.

const baseUser = (overrides: Partial<User> = {}): User => ({
  nickname: '뽀삐',
  bio: '안녕하세요~~ 뽀삐 아빠입니다',
  profileImageUrl: null,
  coverImageUrl: null,
  socialLinks: [],
  postCount: 5,
  followerCount: 128,
  followingCount: 12,
  totalLikeCount: 324,
  ranking: 52,
  createdAt: '2026-04-01T00:00:00Z',
  isFollowing: false,
  ...overrides,
});

const noopHandlers = {
  onFollow: vi.fn(),
  onMessage: vi.fn(),
  onEditProfile: vi.fn(),
};

describe('ProfileHoverCardContent', () => {
  it('타인이고 following=false 일 때 구독하기 + 메시지 버튼 모두 표시', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /구독하기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /프로필 편집/ })).not.toBeInTheDocument();
  });

  it('타인이고 following=true 일 때 구독 중 + 메시지 버튼 모두 표시', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={true}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: '구독 중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /프로필 편집/ })).not.toBeInTheDocument();
  });

  it('본인일 때 프로필 편집 단일 버튼만 표시된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={true}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /프로필 편집/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /구독하기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /메시지/ })).not.toBeInTheDocument();
  });

  it('following=false 일 때 버튼 텍스트가 "구독하기" 이다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /구독하기/ })).toBeInTheDocument();
  });

  it('profile이 null이면 "불러오는 중..." 표시 + 구독자 "-"', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={null}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    // 구독자 라벨 옆 값이 "-" 인지 확인
    const subscriberValue = screen.getByText('👥 구독자').nextElementSibling;
    expect(subscriberValue).toHaveTextContent('-');
  });

  it('bio가 null이면 "아직 자기소개가 없어요" 표시', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ bio: null })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByText('아직 자기소개가 없어요')).toBeInTheDocument();
  });

  it('followerCount는 천단위 콤마로 포맷된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ followerCount: 12345 })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    const subscriberValue = screen.getByText('👥 구독자').nextElementSibling;
    expect(subscriberValue).toHaveTextContent('12,345');
  });

  it('totalLikeCount는 천단위 콤마로 표시된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ totalLikeCount: 1234 })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    const heartValue = screen.getByText('받은하트').nextElementSibling;
    expect(heartValue).toHaveTextContent('1,234');
  });

  it('totalLikeCount=0이면 "0" 표시 (placeholder가 아님)', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ totalLikeCount: 0 })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    const heartValue = screen.getByText('받은하트').nextElementSibling;
    expect(heartValue).toHaveTextContent('0');
  });

  it('받은하트 하트 아이콘에 amber-500 색상이 적용된다 (프로필 페이지와 통일)', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByText('❤')).toHaveClass('text-amber-500');
  });

  it('ranking이 숫자이면 그대로 표시된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ ranking: 42 })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    const rankingValue = screen.getByText('🏆 랭킹').nextElementSibling;
    expect(rankingValue).toHaveTextContent('42');
  });

  it('ranking이 null이면 "-" 표시 (랭킹 미산정 유저)', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ ranking: null })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    const rankingValue = screen.getByText('🏆 랭킹').nextElementSibling;
    expect(rankingValue).toHaveTextContent('-');
  });

  it('구독하기 클릭 시 onFollow가 호출된다', () => {
    const onFollow = vi.fn();
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        onFollow={onFollow}
        onMessage={vi.fn()}
        onEditProfile={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /구독하기/ }));
    expect(onFollow).toHaveBeenCalledTimes(1);
  });

  it('메시지 클릭 시 onMessage가 호출된다 (following=false 여도 노출·동작)', () => {
    const onMessage = vi.fn();
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        onFollow={vi.fn()}
        onMessage={onMessage}
        onEditProfile={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /메시지/ }));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('본인 프로필 편집 클릭 시 onEditProfile 호출', () => {
    const onEditProfile = vi.fn();
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={true}
        onFollow={vi.fn()}
        onMessage={vi.fn()}
        onEditProfile={onEditProfile}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /프로필 편집/ }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  // ─── DM 개방: 메시지 버튼은 following과 무관하게 타인이면 항상 노출 ──────────

  it('following=false(미구독)여도 타인이면 메시지 버튼이 노출된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ isFollowing: false })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();
  });

  it('following=true(구독 중)일 때도 메시지 버튼이 노출된다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ isFollowing: true })}
        following={true}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();
  });

  it('본인이면 following과 무관하게 메시지 버튼이 노출되지 않는다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={true}
        {...noopHandlers}
      />
    );
    expect(screen.queryByRole('button', { name: /메시지/ })).not.toBeInTheDocument();
  });

  it('following prop은 구독 버튼 라벨에만 영향을 준다 (메시지 노출엔 무영향)', () => {
    const { rerender } = render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /구독하기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();

    rerender(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={true}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: '구독 중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /메시지/ })).toBeInTheDocument();
  });
});
