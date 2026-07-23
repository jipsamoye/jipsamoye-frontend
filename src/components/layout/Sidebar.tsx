'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, TrophyIcon, NoteIcon, OpenChatIcon, PaperAirplaneIcon, KeycapIcon } from './icons';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useAuthContext } from '@/components/providers/AuthProvider';
import AiKeycapBadge from '@/components/common/AiKeycapBadge';

interface NavItem {
  label: string;
  href: string;
  icon: (filled: boolean) => React.ReactNode;
  requiresAuth?: boolean;
  isNew?: boolean;
}

const navItems: NavItem[] = [
  { label: '홈', href: '/', icon: (f) => <HomeIcon filled={f} /> },
  { label: '랭킹', href: '/ranking', icon: (f) => <TrophyIcon filled={f} /> },
  { label: '자유게시판', href: '/board', icon: (f) => <NoteIcon filled={f} /> },
  { label: '오픈채팅', href: '/chat', icon: (f) => <OpenChatIcon filled={f} /> },
  { label: 'DM', href: '/dm', icon: (f) => <PaperAirplaneIcon filled={f} />, requiresAuth: true },
  // 진입은 항상 열어 두고, 실제 이용 시점(/figurines/new)에서 로그인 모달로 유도한다
  { label: 'AI 키캡 만들기', href: '/figurines/new', icon: (f) => <KeycapIcon filled={f} />, isNew: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { interceptLink } = useNavigationGuard();
  const { user } = useAuthContext();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] border-r border-gray-300 bg-white p-4">
      <nav className="flex flex-col gap-1">
        {navItems.filter((item) => !item.requiresAuth || !!user).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => interceptLink(e, item.href)}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl text-lg font-medium transition-all duration-200
                ${isActive
                  ? 'bg-gray-50 text-amber-500 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50/70'
                }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 ${isActive ? 'text-amber-500' : 'text-gray-500'}`}>
                {item.icon(isActive)}
              </span>
              <span className="leading-none">{item.label}</span>
              {item.isNew && <AiKeycapBadge size="xs" label="신규" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
