'use client';

/* eslint-disable @next/next/no-img-element -- Lambda 썸네일을 직접 서빙하므로 next/image 최적화 불필요 */

import { useState } from 'react';
import { isResizableUrl, toThumbnailUrl } from '@/lib/imageUrl';

interface AvatarProps {
  src: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

/**
 * 프로필 아바타 전용. 헤더·댓글·상세·DM 등 작은 표시 영역에 맞춰
 * Lambda 200 썸네일만 사용 (srcset 없음 — 800은 아바타에 과도하므로).
 * 썸네일 미생성/404 시 원본 URL로 자동 fallback.
 */
export default function Avatar({ src, alt = '', size = 'md' }: AvatarProps) {
  const [fallback, setFallback] = useState(false);

  if (!src) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center`}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-1/2 h-1/2 text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
        </svg>
      </div>
    );
  }

  const effectiveSrc = !fallback && isResizableUrl(src) ? toThumbnailUrl(src, 200) : src;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFallback(true)}
      className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white shadow-sm`}
    />
  );
}
