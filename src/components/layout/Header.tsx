'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, BellIcon } from './icons';
import Avatar from '@/components/common/Avatar';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useHomeRefresh } from '@/components/providers/HomeRefreshProvider';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types/api';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
  onLogout?: () => void;
  onMobileMenuClick?: () => void;
  nickname?: string;
  profileImageUrl?: string | null;
}

export default function Header({ isLoggedIn = false, onLoginClick, onLogout, onMobileMenuClick, nickname, profileImageUrl }: HeaderProps) {
  const { guardedPush } = useNavigationGuard();
  const { refreshHome } = useHomeRefresh();
  const router = useRouter();
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogoClick = () => {
    if (pathname === '/') {
      refreshHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      guardedPush('/');
    }
  };
  const [showNotification, setShowNotification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const notificationContext = useNotification();
  const notifications = notificationContext.notifications;
  const unreadCount = notificationContext.unreadCount;

  const handleNotificationClick = (notification: Notification) => {
    notificationContext.markAsRead(notification.id);
    setShowNotification(false);
    if (notification.type === 'FOLLOW') {
      router.push(`/users/${notification.senderNickname}`);
    } else if (notification.targetId) {
      router.push(`/posts/${notification.targetId}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotification(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-300">
      <div className="flex items-center justify-between h-full px-4 lg:pl-6 lg:pr-8">
        <button onClick={handleLogoClick} className="text-2xl font-bold text-gray-900 lg:pl-4">
          집사모여
        </button>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                href={pathname.startsWith('/board') ? '/board/new' : '/posts/new'}
                className="hidden lg:flex items-center px-6 py-2 bg-amber-500 text-white rounded-xl text-base font-medium hover:bg-amber-600 transition-all duration-200"
              >
                {pathname.startsWith('/board') ? '글쓰기' : '자랑하기'}
              </Link>
              <Link href="/search" className="p-2.5 text-gray-800 hover:text-gray-900">
                <MagnifyingGlassIcon className="w-6 h-6" />
              </Link>
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotification(!showNotification)}
                  className="relative p-2.5 text-gray-800 hover:text-gray-900"
                >
                  <BellIcon className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotification && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-base text-gray-900">알림</h3>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <button
                            onClick={() => notificationContext.markAllAsRead()}
                            className="text-xs text-amber-600 hover:underline"
                          >
                            모두 읽기
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotification(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {notifications.length > 0 ? (
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                              !notification.read ? 'bg-amber-50' : ''
                            }`}
                          >
                            <Avatar src={notification.senderProfileImageUrl} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {timeAgo(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.read && (
                              <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <BellIcon />
                        <p className="mt-3 text-sm">새로운 알림이 없어요</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="pl-2.5 py-2.5 text-gray-800 hover:text-gray-900"
                >
                  <Avatar src={profileImageUrl ?? null} size="sm" />
                </button>
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 z-50">
                    <Link
                      href={`/users/${nickname}`}
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      내 프로필
                    </Link>
                    <Link
                      href="/liked"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      좋아요한 게시글
                    </Link>
                    <Link
                      href="/feed"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      구독한 유저 게시글
                    </Link>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => { setShowDropdown(false); onLogout?.(); router.push('/'); }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/search" className="p-2.5 text-gray-800 hover:text-gray-900">
                <MagnifyingGlassIcon className="w-6 h-6" />
              </Link>
              <button
                onClick={onLoginClick}
                className="px-6 py-2 bg-amber-500 text-white rounded-xl text-base font-medium hover:bg-amber-600 transition-all duration-200"
              >
                로그인
              </button>
            </>
          )}

          <button
            onClick={onMobileMenuClick}
            className="lg:hidden p-2 text-gray-700 hover:text-gray-900"
            aria-label="메뉴 열기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
