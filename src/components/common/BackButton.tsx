'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
  label?: string;
}

export default function BackButton({ className = '', label = '뒤로' }: BackButtonProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`inline-flex items-center gap-1 text-sm text-gray-500 hover:text-amber-600 transition-colors ${className}`}
      aria-label="뒤로 가기"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
      {label}
    </button>
  );
}
