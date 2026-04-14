'use client';

import { usePathname } from 'next/navigation';
import { HomeIcon, TrophyIcon, ChatBubbleLeftRightIcon, ChatIcon } from './icons';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: '홈', href: '/', icon: <HomeIcon /> },
  { label: '랭킹', href: '/ranking', icon: <TrophyIcon /> },
  { label: '자유게시판', href: '/board', icon: <ChatBubbleLeftRightIcon /> },
  { label: 'DM', href: '/dm', icon: <ChatIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { guardedPush } = useNavigationGuard();

  return (
    <>
      {/* PC 사이드바 */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-16 w-52 h-[calc(100vh-4rem)] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => guardedPush(item.href)}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl text-lg font-medium transition-all duration-200 font-[family-name:var(--font-jua)] text-left
                  ${isActive
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50/70 dark:hover:bg-gray-900'
                  }`}
              >
                <span className="w-6 h-6">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 모바일 하단 탭바 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => guardedPush(item.href)}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs font-[family-name:var(--font-jua)]
                  ${isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                <span className="w-6 h-6">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
