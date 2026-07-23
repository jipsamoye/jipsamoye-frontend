interface AiKeycapBadgeProps {
  /** 위치 지정용 (예: "absolute top-3 left-3") */
  className?: string;
  /** xs: 메뉴 라벨 옆 인라인용 (사이드바 "신규"). sm: 카드 썸네일용 — 모바일에서 축소, md 이상 기본 크기. md: 항상 기본 크기 (상세 페이지) */
  size?: 'xs' | 'sm' | 'md';
  /** 뱃지 텍스트 (기본 "AI 키캡") */
  label?: string;
}

const SIZE_CLASSES = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2.5 py-1 text-xs md:px-4 md:py-1.5 md:text-sm',
  md: 'px-4 py-1.5 text-sm',
} as const;

/** AI 키캡 생성 이미지 위에 올리는 그라데이션 라벨 */
export default function AiKeycapBadge({ className = '', size = 'md', label = 'AI 키캡' }: AiKeycapBadgeProps) {
  return (
    <span
      className={`inline-flex items-center ${SIZE_CLASSES[size]} font-extrabold rounded-full bg-gradient-to-r from-amber-500 to-[#ff5c8a] text-white shadow-[0_3px_10px_rgba(255,92,138,0.45)] ${className}`}
    >
      {label}
    </span>
  );
}
