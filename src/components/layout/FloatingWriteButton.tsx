'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FloatingWriteButton() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const onScroll = () => setIsExpanded(window.scrollY <= 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isFormPage =
    pathname === '/posts/new' ||
    pathname === '/board/new' ||
    (pathname.startsWith('/posts/') && pathname.endsWith('/edit')) ||
    (pathname.startsWith('/board/') && pathname.endsWith('/edit'));
  if (isFormPage) return null;

  const config =
    pathname === '/'
      ? { href: '/posts/new', label: '자랑하기' }
      : pathname.startsWith('/board')
      ? { href: '/board/new', label: '글쓰기' }
      : null;
  if (!config) return null;

  return (
    <Link
      href={config.href}
      aria-label={config.label}
      className={`lg:hidden fixed bottom-6 right-6 z-50 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 flex items-center overflow-hidden transition-all duration-500 active:scale-95 pl-4 pr-4 ${isExpanded ? 'max-w-[200px]' : 'max-w-[56px]'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      <span className={`overflow-hidden whitespace-nowrap font-semibold text-base transition-all duration-500 ${isExpanded ? 'max-w-[120px] opacity-100 ml-2 pr-1' : 'max-w-0 opacity-0 ml-0'}`}>
        {config.label}
      </span>
    </Link>
  );
}
