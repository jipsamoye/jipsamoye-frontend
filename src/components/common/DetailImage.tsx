'use client';

/* eslint-disable @next/next/no-img-element -- Lambda 썸네일을 직접 서빙하므로 next/image 최적화 불필요 */

import { useState } from 'react';
import { isResizableUrl, toThumbnailUrl } from '@/lib/imageUrl';

interface DetailImageProps {
  src: string;
  alt: string;
  loading?: 'lazy' | 'eager';
  className?: string;
}

/**
 * 게시글 상세 화면 등 큰 이미지를 보여주는 용도.
 * 800 썸네일로 시작해, 실패 시 원본 URL로 fallback.
 */
export default function DetailImage({
  src,
  alt,
  loading = 'lazy',
  className,
}: DetailImageProps) {
  const [fallback, setFallback] = useState(false);

  if (!isResizableUrl(src) || fallback) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={className}
      />
    );
  }

  return (
    <img
      src={toThumbnailUrl(src, 800)}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFallback(true)}
      className={className}
    />
  );
}
