'use client';

import { KeycapIcon } from '@/components/layout/icons';
import { FIGURINE_UPLOAD_COPY, useFigurineStageCopy } from '@/hooks/useFigurineStageCopy';

interface FigurineLoadingProps {
  /** 업로드한 원본 사진의 objectURL. 새로고침 등으로 없으면 플레이스홀더로 폴백한다. */
  previewUrl: string | null;
  /** AI 작업 시작 시각 (ms epoch). 업로드가 끝난 뒤 기준이라 단계 카피가 0초부터 흐른다. */
  startedAt: number;
  /** 아직 사진을 올리는 중이면 true — 경과 시간 대신 업로드 카피를 보여준다. */
  preparing?: boolean;
}

/**
 * 생성 대기 화면 — 스캔 현상 연출.
 *
 * 스캔 빔이 원본 사진을 위에서 아래로 훑고 지나가며 그 뒤로 컬러 레이어가 드러난다.
 * after 레이어는 "완성된 키캡"이 아니라 같은 사진의 컬러 버전이다. 완성본을 암시하면
 * 실제 AI 결과가 그 프리뷰와 다를 때 애니메이션이 만든 기대가 그대로 실망이 되기 때문이다.
 */
export default function FigurineLoading({
  previewUrl,
  startedAt,
  preparing = false,
}: FigurineLoadingProps) {
  const elapsed = useFigurineStageCopy(startedAt);

  // 업로드 구간은 경과 시간과 무관하다. 여기서 AI 단계 카피를 쓰면 아직 시작도 안 한
  // 작업을 진행 중이라 말하게 되고, 업로드에 쓴 시간만큼 단계가 앞질러 간다.
  const { stage, line, hint } = preparing
    ? { stage: 'uploading' as const, ...FIGURINE_UPLOAD_COPY }
    : elapsed;

  return (
    <section className="flex flex-col items-center mt-10 text-center">
      <div
        data-testid="figurine-scan-stage"
        aria-hidden="true"
        className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden bg-gray-100 shadow-[0_16px_30px_-20px_rgba(25,31,40,0.6)]"
      >
        {previewUrl ? (
          <>
            {/* before — 아직 스캔이 지나가지 않은 영역 */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */}
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-45"
            />
            {/* after — 빔이 지나간 영역. 같은 사진의 컬러 + 따뜻한 틴트 */}
            <div className="figurine-scan-after absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */}
              <img
                src={previewUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover saturate-[1.15]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/20 to-amber-300/10" />
            </div>
          </>
        ) : (
          <div className="figurine-scan-after absolute inset-0 flex items-center justify-center bg-gradient-to-b from-amber-50 to-white">
            <KeycapIcon className="w-20 h-20 text-amber-400" />
          </div>
        )}

        {/* 스캔 빔 — 높이 20%라 translateY(500%)가 컨테이너 한 바퀴 */}
        <div className="figurine-scan-beam absolute left-0 right-0 top-0 h-1/5 bg-gradient-to-b from-transparent via-amber-300 to-transparent opacity-80" />
      </div>

      <div role="status" aria-live="polite" className="mt-6">
        {/* key로 단계마다 리마운트해 페이드가 매번 재생되게 한다 */}
        <p key={stage} className="text-base font-medium text-gray-900 animate-[fadeIn_0.45s_ease-out]">
          {line}
        </p>
        <p className="mt-1 text-sm text-gray-500">{hint}</p>
      </div>

      {/* 무한 슬라이드 바 — 진행률이 아니라 "진행 중"만 전달한다 */}
      <div aria-hidden="true" className="mt-4 w-44 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div className="figurine-scan-bar h-full w-2/5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500" />
      </div>

      <p className="mt-4 text-xs text-gray-400">이 화면을 벗어나면 진행 상황을 볼 수 없어요</p>
    </section>
  );
}
