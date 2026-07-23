'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, TrophyIcon, NoteIcon, OpenChatIcon, PaperAirplaneIcon, KeycapIcon } from './icons';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';
import { useAuthContext } from '@/components/providers/AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: (filled: boolean) => React.ReactNode;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { label: '홈', href: '/', icon: (f) => <HomeIcon filled={f} /> },
  { label: '랭킹', href: '/ranking', icon: (f) => <TrophyIcon filled={f} /> },
  { label: '자유게시판', href: '/board', icon: (f) => <NoteIcon filled={f} /> },
  { label: '오픈채팅', href: '/chat', icon: (f) => <OpenChatIcon filled={f} /> },
  { label: 'DM', href: '/dm', icon: (f) => <PaperAirplaneIcon filled={f} />, requiresAuth: true },
  // 진입은 항상 열어 두고, 실제 이용 시점(/figurines/new)에서 로그인 모달로 유도한다
  { label: 'AI 키캡 만들기', href: '/figurines/new', icon: (f) => <KeycapIcon filled={f} /> },
];

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { interceptLink } = useNavigationGuard();
  const { user } = useAuthContext();

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
          {navItems.filter((item) => !item.requiresAuth || !!user).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => { interceptLink(e, item.href); onClose(); }}
                className={`flex items-center gap-4 px-6 py-3.5 text-base font-medium
                  ${isActive ? 'text-amber-500 bg-gray-50 font-semibold' : 'text-gray-900 hover:bg-gray-50'}`}
              >
                <span className="inline-flex items-center justify-center w-6 h-6 text-amber-500">{item.icon(true)}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
