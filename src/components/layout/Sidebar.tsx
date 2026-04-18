'use client';

import { usePathname } from 'next/navigation';
import { HomeIcon, TrophyIcon, NoteIcon, OpenChatIcon, PaperAirplaneIcon } from './icons';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';

interface NavItem {
  label: string;
  href: string;
  icon: (filled: boolean) => React.ReactNode;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  { label: '홈', href: '/', icon: (f) => <HomeIcon filled={f} /> },
  { label: '랭킹', href: '/ranking', icon: (f) => <TrophyIcon filled={f} /> },
  { label: '자유게시판', href: '/board', icon: (f) => <NoteIcon filled={f} /> },
  { label: '오픈채팅', href: '/chat', icon: (f) => <OpenChatIcon filled={f} /> },
  { label: 'DM', href: '/dm', icon: (f) => <PaperAirplaneIcon filled={f} /> },
];

const mobileNavItems: NavItem[] = [
  { label: '홈', href: '/', icon: (f) => <HomeIcon filled={f} /> },
  { label: '랭킹', href: '/ranking', icon: (f) => <TrophyIcon filled={f} /> },
  { label: '자랑하기', href: '/posts/new', highlight: true, icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> },
  { label: '오픈채팅', href: '/chat', icon: (f) => <OpenChatIcon filled={f} /> },
  { label: 'DM', href: '/dm', icon: (f) => <PaperAirplaneIcon filled={f} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { guardedPush } = useNavigationGuard();

  return (
    <>
      {/* PC 사이드바 */}
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

      {/* 모바일 하단 탭바 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100">
        <div className="flex justify-around py-2">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            if (item.highlight) {
              return (
                <button
                  key={item.href}
                  onClick={() => guardedPush(item.href)}
                  className="flex flex-col items-center gap-1 px-3 py-1 text-xs font-[family-name:var(--font-jua)] text-amber-500"
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-amber-500 rounded-full text-white">
                    {item.icon(isActive)}
                  </span>
                  {item.label}
                </button>
              );
            }
            return (
              <button
                key={item.href}
                onClick={() => guardedPush(item.href)}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs font-[family-name:var(--font-jua)]
                  ${isActive
                    ? 'text-gray-900'
                    : 'text-gray-500'
                  }`}
              >
                <span className="w-6 h-6">{item.icon(isActive)}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
