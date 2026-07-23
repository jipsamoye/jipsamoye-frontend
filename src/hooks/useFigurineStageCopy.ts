'use client';

import { useEffect, useState } from 'react';

export type FigurineStage = 'analyzing' | 'sculpting' | 'casting' | 'polishing' | 'overtime';

interface StageDef {
  /** 이 단계가 시작되는 경과 초 */
  at: number;
  stage: FigurineStage;
  line: string;
}

/**
 * 서버는 PENDING/PROCESSING/COMPLETED/FAILED 4상태만 주고 진행률 필드가 없다.
 * 퍼센트를 그리면 전부 클라이언트가 지어낸 값이 되므로, 대신 경과 시간으로
 * "지금 무슨 작업 중인지"를 설명한다. 이건 거짓 진행률이 아니라 작업 설명이다.
 */
export const FIGURINE_STAGES: readonly StageDef[] = [
  { at: 0, stage: 'analyzing', line: '사진에서 우리 애를 찾고 있어요' },
  { at: 8, stage: 'sculpting', line: '이목구비를 피규어로 다듬는 중이에요' },
  { at: 22, stage: 'casting', line: '키캡 안에 레진을 붓고 있어요' },
  { at: 40, stage: 'polishing', line: '표면을 반짝반짝 광내는 중이에요' },
  { at: 60, stage: 'overtime', line: '거의 다 왔어요. 조금만 더 기다려 주세요' },
] as const;

const HINT_NORMAL = '보통 1분 안에 완성돼요';
const HINT_OVERTIME = '사진에 따라 더 걸릴 수 있어요';

const TICK_MS = 1000;

const stageIndexFor = (elapsedSec: number) => {
  let idx = 0;
  for (let i = 0; i < FIGURINE_STAGES.length; i++) {
    if (elapsedSec >= FIGURINE_STAGES[i].at) idx = i;
  }
  return idx;
};

const elapsedSecondsSince = (startedAt: number) =>
  Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

export interface FigurineStageCopy {
  stage: FigurineStage;
  line: string;
  hint: string;
  elapsedSec: number;
}

/**
 * @param startedAt 생성 요청 시각 (ms epoch). 호출부가 넘겨야 테스트에서 시간 주입이 가능하다.
 */
export function useFigurineStageCopy(startedAt: number): FigurineStageCopy {
  // 지연 초기화 — 새로고침 등으로 뒤늦게 마운트돼도 첫 tick을 기다리지 않고 올바른 단계로 시작
  const [elapsedSec, setElapsedSec] = useState(() => elapsedSecondsSince(startedAt));

  // startedAt이 바뀌면 다음 tick(최대 1초)을 기다리지 않고 렌더 중에 즉시 맞춘다.
  // effect 안에서 setState하면 cascading render가 되므로 React 권장 패턴을 쓴다.
  const [trackedStartedAt, setTrackedStartedAt] = useState(startedAt);
  if (trackedStartedAt !== startedAt) {
    setTrackedStartedAt(startedAt);
    setElapsedSec(elapsedSecondsSince(startedAt));
  }

  useEffect(() => {
    const id = setInterval(() => setElapsedSec(elapsedSecondsSince(startedAt)), TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);

  const { stage, line } = FIGURINE_STAGES[stageIndexFor(elapsedSec)];

  return {
    stage,
    line,
    hint: stage === 'overtime' ? HINT_OVERTIME : HINT_NORMAL,
    elapsedSec,
  };
}
