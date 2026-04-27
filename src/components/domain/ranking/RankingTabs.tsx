'use client';

interface RankingTabsProps {
  type: 'weekly' | 'monthly';
  onChange: (type: 'weekly' | 'monthly') => void;
}

/**
 * 주간/월간 토글 탭
 * - 활성: bg-green-500 text-white
 * - 비활성: bg-gray-100 text-gray-600
 */
export default function RankingTabs({ type, onChange }: RankingTabsProps) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onChange('weekly')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          type === 'weekly'
            ? 'bg-green-500 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        주간
      </button>
      <button
        onClick={() => onChange('monthly')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          type === 'monthly'
            ? 'bg-green-500 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        월간
      </button>
    </div>
  );
}
