'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Thumbnail from '@/components/common/Thumbnail';
import Avatar from '@/components/common/Avatar';
import ProfileHoverCard from '@/components/domain/ProfileHoverCard';

function FadeImage({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <Thumbnail
        src={src}
        alt={alt}
        sizes="(max-width: 768px) 50vw, 199px"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

interface PopularItem {
  id: number;
  label: string;
  thumbnailUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
  nickname?: string;
  profileImageUrl?: string | null;
}

interface PopularSliderProps {
  items: PopularItem[];
}

export default function PopularSlider({ items }: PopularSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const goToProfile = (nickname: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/users/${encodeURIComponent(nickname)}`);
  };

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide px-1 py-3 -mx-1 -my-3">
        {items.map((item, i) => (
          <Link
            key={item.id}
            href={`/posts/${item.id}`}
            className="flex-shrink-0 w-[calc(25%-12px)] min-w-[200px] bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
          >
            <div className="aspect-square bg-gray-200 overflow-hidden relative">
              {item.thumbnailUrl ? (
                <FadeImage src={item.thumbnailUrl} alt={item.label} eager={i < 4} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🐾</div>
              )}
            </div>
            <div className="p-3">
              <p className="font-semibold text-sm text-gray-900 truncate">{item.label}</p>
              <div className="flex items-center justify-between mt-2">
                {item.nickname ? (
                  <ProfileHoverCard nickname={item.nickname}>
                    <button
                      type="button"
                      onClick={goToProfile(item.nickname)}
                      className="flex items-center gap-2 min-w-0 hover:opacity-70 transition-opacity"
                      aria-label={`${item.nickname} 프로필 보기`}
                    >
                      <Avatar src={item.profileImageUrl ?? null} size="sm" />
                      <span className="text-xs text-gray-500 truncate hover:text-gray-700">{item.nickname}</span>
                    </button>
                  </ProfileHoverCard>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.likeCount !== undefined && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium tabular-nums">
                      ❤ {item.likeCount}
                    </span>
                  )}
                  {item.commentCount !== undefined && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium tabular-nums">
                      💬 {item.commentCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
