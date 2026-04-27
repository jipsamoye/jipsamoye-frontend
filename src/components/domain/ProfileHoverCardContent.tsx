'use client';

import { User } from '@/types/api';
import Avatar from '@/components/common/Avatar';

interface ProfileHoverCardContentProps {
  nickname: string;
  profile: User | null;
  following: boolean;
  isMe: boolean;
  onFollow: (e: React.MouseEvent) => void;
  onMessage: (e: React.MouseEvent) => void;
  onEditProfile: (e: React.MouseEvent) => void;
}

/**
 * ProfileHoverCard popover 내부 content. hover/floating 로직과 분리되어 있어
 * 단위 테스트로 본인/타인 분기·로딩 상태·bio 처리를 직접 검증할 수 있다.
 */
export default function ProfileHoverCardContent({
  nickname,
  profile,
  following,
  isMe,
  onFollow,
  onMessage,
  onEditProfile,
}: ProfileHoverCardContentProps) {
  return (
    <div
      className="w-80 rounded-2xl bg-white border border-amber-200 shadow-2xl p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 사진 + 닉네임 */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={profile?.profileImageUrl ?? null} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-gray-900 truncate">{nickname}</p>
        </div>
      </div>
      {/* bio */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-800 leading-relaxed mb-3 min-h-[44px]">
        {profile ? (
          profile.bio ? (
            profile.bio.split('\n').map((line, i) => <p key={i}>{line}</p>)
          ) : (
            <p className="text-gray-400">아직 자기소개가 없어요</p>
          )
        ) : (
          <p className="text-gray-300">불러오는 중...</p>
        )}
      </div>
      {/* stats */}
      <div className="rounded-xl border-2 border-amber-200 bg-white p-3 mb-3">
        <div className="grid grid-cols-3 gap-2 divide-x divide-amber-100">
          <div className="flex flex-col items-center gap-1 px-1">
            <span className="text-[10px] text-gray-600">❤ 받은하트</span>
            <span className="text-xs font-bold text-amber-700 tabular-nums">
              {profile ? profile.totalLikeCount.toLocaleString() : '-'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1">
            <span className="text-[10px] text-gray-600">👥 구독자</span>
            <span className="text-xs font-bold text-amber-700 tabular-nums">
              {profile ? profile.followerCount.toLocaleString() : '-'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1">
            <span className="text-[10px] text-gray-600">🏆 랭킹</span>
            <span className="text-xs font-bold text-amber-700 tabular-nums">
              {profile && profile.ranking !== null ? profile.ranking.toLocaleString() : '-'}
            </span>
          </div>
        </div>
      </div>
      {/* 버튼 */}
      {isMe ? (
        <button
          type="button"
          onClick={onEditProfile}
          className="w-full py-2 rounded-xl border-2 border-amber-400 text-amber-600 hover:bg-amber-50 text-xs font-bold transition-colors"
        >
          ✏️ 프로필 편집
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFollow}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              following
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'border-2 border-amber-400 text-amber-600 hover:bg-amber-50'
            }`}
          >
            {following ? '구독 중' : '📣 구독하기'}
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="flex-1 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors"
          >
            💬 메시지
          </button>
        </div>
      )}
    </div>
  );
}
