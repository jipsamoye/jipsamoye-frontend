'use client';

interface RankingTabsProps {
  type: 'weekly' | 'monthly';
  onChange: (type: 'weekly' | 'monthly') => void;
}

export default function RankingTabs({ type, onChange }: RankingTabsProps) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onChange('weekly')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          type === 'weekly'
            ? 'bg-amber-50 text-amber-600'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        주간
      </button>
      <button
        onClick={() => onChange('monthly')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          type === 'monthly'
            ? 'bg-amber-50 text-amber-600'
            : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        월간
      </button>
    </div>
  );
}
