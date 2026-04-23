'use client';

/* eslint-disable @next/next/no-img-element -- Lambda 썸네일을 직접 서빙하므로 next/image 최적화 불필요 */

import { useState } from 'react';
import { buildSrcSet, isResizableUrl, toThumbnailUrl } from '@/lib/imageUrl';

interface ThumbnailProps {
  src: string;
  alt: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'auto';
  onLoad?: () => void;
  className?: string;
}

/**
 * 피드·카드·DM 첨부 등 그리드/리스트용 이미지.
 * Lambda 200·800 썸네일 srcset, onError 시 원본 URL로 fallback.
 */
export default function Thumbnail({
  src,
  alt,
  sizes,
  loading = 'lazy',
  fetchPriority = 'auto',
  onLoad,
  className,
}: ThumbnailProps) {
  const [fallback, setFallback] = useState(false);

  if (!isResizableUrl(src) || fallback) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={onLoad}
        className={className}
      />
    );
  }

  return (
    <img
      src={toThumbnailUrl(src, 200)}
      srcSet={buildSrcSet(src)}
      sizes={sizes}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onLoad={onLoad}
      onError={() => setFallback(true)}
      className={className}
    />
  );
}
