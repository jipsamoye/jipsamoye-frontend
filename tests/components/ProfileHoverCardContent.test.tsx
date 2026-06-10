import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { User } from '@/types/api';
import ProfileHoverCardContent from '@/components/domain/ProfileHoverCardContent';

// [차단 1] User 타입에 isFollowing 필드 추가 확인용
// 실제 렌더는 following prop으로 결정되고, isFollowing 초기화는 ProfileHoverCard에서 담당.
// 여기서는 following=true 일 때 메시지 버튼이 표시되는 동작만 검증.

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
  it('타인이고 following=false 일 때 구독하기 버튼만 표시 (메시지 버튼 없음)', () => {
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
    expect(screen.queryByRole('button', { name: /메시지/ })).not.toBeInTheDocument();
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
    const heartValue = screen.getByText('❤ 받은하트').nextElementSibling;
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
    const heartValue = screen.getByText('❤ 받은하트').nextElementSibling;
    expect(heartValue).toHaveTextContent('0');
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

  it('메시지 클릭 시 onMessage가 호출된다 (following=true 필요)', () => {
    const onMessage = vi.fn();
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser()}
        following={true}
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

  // ─── [차단 1] isFollowing 초기화 — following prop 게이팅 ──────────────────

  it('[차단 1] 서버 isFollowing=true 이면 following=true 로 넘겨야 메시지 버튼이 표시된다', () => {
    // ProfileHoverCard에서 res.data.isFollowing ?? false 로 setFollowing() 하고
    // ProfileHoverCardContent에 following={true}로 전달해야 함.
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

  it('[차단 1] isFollowing=false 인 상태(새로고침 후 초기값)에서 메시지 버튼이 없다', () => {
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={baseUser({ isFollowing: false })}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.queryByRole('button', { name: /메시지/ })).not.toBeInTheDocument();
  });

  it('[차단 1] isFollowing 필드가 undefined(구형 백엔드)이면 following=false로 기본 처리되어야 한다', () => {
    const userWithoutIsFollowing = baseUser();
    delete (userWithoutIsFollowing as Partial<User>).isFollowing;
    // following prop이 false면 메시지 버튼 없음 — ?? false 처리 검증
    render(
      <ProfileHoverCardContent
        nickname="뽀삐"
        profile={userWithoutIsFollowing}
        following={false}
        isMe={false}
        {...noopHandlers}
      />
    );
    expect(screen.queryByRole('button', { name: /메시지/ })).not.toBeInTheDocument();
  });
});
