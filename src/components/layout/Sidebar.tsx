'use client';

import { usePathname } from 'next/navigation';
import { HomeIcon, TrophyIcon, NoteIcon, OpenChatIcon, PaperAirplaneIcon } from './icons';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';

interface NavItem {
  label: string;
  href: string;
  icon: (filled: boolean) => React.ReactNode;
}

const navItems: NavItem[] = [
  { label: '홈', href: '/', icon: (f) => <HomeIcon filled={f} /> },
  { label: '랭킹', href: '/ranking', icon: (f) => <TrophyIcon filled={f} /> },
  { label: '자유게시판', href: '/board', icon: (f) => <NoteIcon filled={f} /> },
  { label: '오픈채팅', href: '/chat', icon: (f) => <OpenChatIcon filled={f} /> },
  { label: 'DM', href: '/dm', icon: (f) => <PaperAirplaneIcon filled={f} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { guardedPush } = useNavigationGuard();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 w-52 h-[calc(100vh-4rem)] border-r border-gray-100 bg-white p-4">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => guardedPush(item.href)}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl text-lg font-medium transition-all duration-200 font-[family-name:var(--font-jua)] text-left
                ${isActive
                  ? 'bg-gray-50 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/70'
                }`}
            >
              <span className="w-6 h-6">{item.icon(isActive)}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
