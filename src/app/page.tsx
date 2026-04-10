import PopularSlider from '@/components/domain/PopularSlider';

const popularItems = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  label: `인기 게시글 ${i + 1}`,
}));

export default function Home() {
  return (
    <div>
      {/* 배너 */}
      <section className="mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 p-8 md:p-12">
          <div className="relative z-10">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
              반려동물 커뮤니티
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              우리 애 자랑하러 오세요!
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-lg whitespace-nowrap">
              강아지, 고양이와 함께하는 일상을 공유하고 다른 집사들과 소통해보세요.
            </p>
          </div>
          {/* 장식 요소 */}
          <div className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 text-6xl md:text-8xl opacity-20 select-none">
            🐾
          </div>
          <div className="absolute right-20 md:right-32 bottom-2 text-4xl md:text-5xl opacity-10 select-none">
            🐕
          </div>
          <div className="absolute right-8 md:right-16 bottom-4 text-3xl md:text-4xl opacity-10 select-none">
            🐈
          </div>
        </div>
      </section>

      {/* 오늘의 멍냥 */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">오늘의 멍냥</h2>
        <PopularSlider items={popularItems} />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">최신 게시글</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden"
            >
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                사진 {i}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">게시글 제목 {i}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>♥ 12</span>
                  <span>👁 34</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">닉네임{i}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
