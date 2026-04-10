'use client';

import Link from 'next/link';
import { MagnifyingGlassIcon, BellIcon, UserCircleIcon } from './icons';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
}

export default function Header({ isLoggedIn = false, onLoginClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* 로고 */}
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
          집사모여
        </Link>

        {/* 오른쪽 메뉴 */}
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
              <Link href="/profile" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <UserCircleIcon />
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
