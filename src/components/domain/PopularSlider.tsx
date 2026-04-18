'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HeartIcon } from '@/components/layout/icons';

function FadeImage({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
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
  nickname?: string;
}

interface PopularSliderProps {
  items: PopularItem[];
}

export default function PopularSlider({ items }: PopularSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
        {items.map((item, i) => (
          <Link
            key={item.id}
            href={`/posts/${item.id}`}
            className="flex-shrink-0 w-[calc(25%-12px)] min-w-[200px] bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
          >
            <div className="aspect-square bg-gray-200 overflow-hidden relative">
              {item.thumbnailUrl ? (
                <FadeImage src={item.thumbnailUrl} alt={item.label} eager={i < 4} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🐾</div>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm truncate">{item.label}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {item.nickname && <span>{item.nickname}</span>}
                {item.likeCount !== undefined && (
                  <span className="flex items-center gap-1"><HeartIcon /> {item.likeCount}</span>
                )}
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
