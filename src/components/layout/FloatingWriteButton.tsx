'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FloatingWriteButton() {
  const pathname = usePathname();

  if (pathname === '/posts/new' || pathname.startsWith('/posts/') && pathname.endsWith('/edit')) {
    return null;
  }

  return (
    <Link
      href="/posts/new"
      aria-label="자랑하기"
      className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all duration-200 active:scale-95"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </Link>
  );
}
