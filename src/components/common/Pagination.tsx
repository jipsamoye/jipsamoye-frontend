'use client';

interface PaginationProps {
  currentPage: number; // 1-indexed
  totalPages: number;
  onChange: (page: number) => void;
}

const GROUP_SIZE = 10;

export default function Pagination({ currentPage, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const currentGroup = Math.ceil(currentPage / GROUP_SIZE);
  const groupStart = (currentGroup - 1) * GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + GROUP_SIZE - 1, totalPages);
  const hasPrevGroup = currentGroup > 1;
  const hasNextGroup = groupEnd < totalPages;

  const pages: number[] = [];
  for (let i = groupStart; i <= groupEnd; i++) pages.push(i);

  return (
    <nav className="flex items-center justify-center gap-1 mt-12 mb-8" aria-label="페이지네이션">
      {hasPrevGroup && (
        <button
          onClick={() => onChange(groupStart - 1)}
          aria-label="이전 페이지 그룹"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onChange(page)}
          aria-label={`${page} 페이지로 이동`}
          aria-current={page === currentPage ? 'page' : undefined}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
            page === currentPage
              ? 'bg-gray-100 text-gray-900 font-semibold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium'
          }`}
        >
          {page}
        </button>
      ))}
      {hasNextGroup && (
        <button
          onClick={() => onChange(groupEnd + 1)}
          aria-label="다음 페이지 그룹"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </nav>
  );
}
