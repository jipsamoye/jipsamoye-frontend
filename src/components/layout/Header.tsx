'use client';

import Link from 'next/link';
import { MagnifyingGlassIcon, BellIcon } from './icons';
import ThemeToggle from './ThemeToggle';
import Avatar from '@/components/common/Avatar';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
  nickname?: string;
  profileImageUrl?: string | null;
}

export default function Header({ isLoggedIn = false, onLoginClick, nickname, profileImageUrl }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
          집사모여
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isLoggedIn ? (
            <>
              <Link
                href="/posts/new"
                className="hidden sm:flex items-center px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                자랑하기
              </Link>
              <Link href="/search" className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <MagnifyingGlassIcon />
              </Link>
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <BellIcon />
              </button>
              <Link href={`/users/${nickname}`} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Avatar src={profileImageUrl ?? null} size="sm" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/search" className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <MagnifyingGlassIcon />
              </Link>
              <button
                onClick={onLoginClick}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                로그인
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
