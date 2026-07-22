interface AiKeycapBadgeProps {
  /** 위치 지정용 (예: "absolute top-3 left-3") */
  className?: string;
}

/** AI 키캡 생성 이미지 위에 올리는 그라데이션 라벨 */
export default function AiKeycapBadge({ className = '' }: AiKeycapBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-4 py-1.5 text-sm font-extrabold rounded-full bg-gradient-to-r from-amber-500 to-[#ff5c8a] text-white shadow-[0_3px_10px_rgba(255,92,138,0.45)] ${className}`}
    >
      AI 키캡
    </span>
  );
}
