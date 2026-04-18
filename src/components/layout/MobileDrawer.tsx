'use client';

import { useEffect } from 'react';
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

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { guardedPush } = useNavigationGuard();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavigate = (href: string) => {
    onClose();
    guardedPush(href);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-[60] transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 right-0 z-[70] h-full w-72 max-w-[85vw] bg-white shadow-2xl lg:hidden
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-end px-5 h-16 border-b border-gray-100">
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-900"
            aria-label="메뉴 닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => handleNavigate(item.href)}
                className={`flex items-center gap-4 px-6 py-3.5 text-left text-base font-medium
                  ${isActive ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="w-6 h-6">{item.icon(isActive)}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
