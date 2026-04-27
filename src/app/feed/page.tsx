'use client';

import { useAuthContext } from '@/components/providers/AuthProvider';
import { UsersIcon } from '@/components/layout/icons';

export default function FeedPage() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">구독 피드</h1>
      </div>

      {!user ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-20 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-500 mb-4">
            <UsersIcon filled />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">로그인 후 이용할 수 있어요</h2>
          <p className="text-sm text-gray-500">
            로그인하면 구독한 집사들의 새 자랑을 모아 볼 수 있어요.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 py-20 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-500 mb-4">
            <UsersIcon filled />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">구독 피드 준비 중이에요 🐾</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            <span className="font-medium text-amber-600">{user.nickname}</span>님이 구독한 집사들의 새 자랑이<br />
            곧 이 화면에 모아져 보일 예정이에요.
          </p>
        </div>
      )}
    </div>
  );
}
