import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { showToast } from '@/components/common/Toast';
import type { ApiResponse, FigurineJob } from '@/types/api';

export const POLL_INTERVAL_MS = 2_500;
// 서버가 5분 초과 작업을 자동 FAILED 처리 → 클라이언트는 네트워크 단절 대비 6분 백스톱만 유지
export const MAX_POLLS = 144; // 2.5초 × 144 = 360초

/**
 * 화면 상태 머신.
 * - `idle`: 시작 전(또는 생성 요청 실패로 복귀)
 * - `creating`: POST /api/figurines 진행 중
 * - `generating`: PENDING/PROCESSING — 2.5초 간격 폴링 중
 * - `completed`: COMPLETED — resultImageUrl 표시 + 게시 가능
 * - `failed`: FAILED 수신 또는 클라이언트 백스톱 초과
 * - `posting`: POST /{jobId}/post 진행 중 (Task 4)
 * - `posted`: 게시 완료 — petPostId 확보 (Task 4)
 */
export type FigurinePhase =
  | 'idle'
  | 'creating'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'posting'
  | 'posted';

interface UseFigurineJobResult {
  job: FigurineJob | null;
  phase: FigurinePhase;
  /** phase=failed일 때 사용자 안내문 (서버 failReason 우선) */
  errorMessage: string | null;
  /** 업로드 완료된 sourceImageUrl로 생성 요청 + 폴링 시작 */
  start: (sourceImageUrl: string) => Promise<void>;
  /** 전체 초기화 (다시 시도) */
  reset: () => void;
}

const TIMEOUT_MESSAGE = '생성이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.';
const DEFAULT_FAIL_MESSAGE = '이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.';

/**
 * AI 키캡 피규어 잡 훅.
 *
 * 핵심 설계:
 * - **setTimeout 재귀**(setInterval 금지) — 응답이 늦어도 중첩 호출이 쌓이지 않음.
 * - **일시 네트워크 오류 내성**: 폴링 GET이 실패해도 백스톱 한도까지 계속 재시도.
 * - **401은 전파**: api 래퍼가 unauthorizedHandler 호출 + throw → 폴링 중단(전역 처리).
 * - **unmount cleanup**: cancelled 플래그 + clearTimeout. 언마운트 후 setState 금지.
 */
export function useFigurineJob(): UseFigurineJobResult {
  const [job, setJob] = useState<FigurineJob | null>(null);
  const [phase, setPhase] = useState<FigurinePhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // poll 자신을 재귀 setTimeout에서 참조해야 하므로 ref로 stale 클로저를 끊는다.
  const pollRef = useRef<(jobId: number) => void>(() => {});

  const scheduleNext = useCallback((jobId: number) => {
    timerRef.current = setTimeout(() => pollRef.current(jobId), POLL_INTERVAL_MS);
  }, []);

  const failByTimeout = useCallback(() => {
    setPhase('failed');
    setErrorMessage(TIMEOUT_MESSAGE);
  }, []);

  const poll = useCallback(async (jobId: number) => {
    if (cancelledRef.current) return;

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.get<FigurineJob>(`/api/figurines/${jobId}`, { silent: true });
    } catch (err) {
      if (cancelledRef.current) return;
      if ((err as ApiResponse<null>)?.status === 401) {
        clearTimer();
        return;
      }
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        failByTimeout();
        clearTimer();
        return;
      }
      scheduleNext(jobId);
      return;
    }

    if (cancelledRef.current) return;

    const next = res.data;
    setJob(next);

    if (next.status === 'COMPLETED') {
      setPhase('completed');
      clearTimer();
      return;
    }
    if (next.status === 'FAILED') {
      setPhase('failed');
      setErrorMessage(next.failReason ?? DEFAULT_FAIL_MESSAGE);
      clearTimer();
      return;
    }

    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLLS) {
      failByTimeout();
      clearTimer();
      return;
    }
    scheduleNext(jobId);
  }, [clearTimer, scheduleNext, failByTimeout]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const start = useCallback(async (sourceImageUrl: string) => {
    cancelledRef.current = false;
    clearTimer();
    pollCountRef.current = 0;
    setErrorMessage(null);
    setPhase('creating');

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.post<FigurineJob>('/api/figurines', { sourceImageUrl });
    } catch (err) {
      if (cancelledRef.current) return;
      // 401은 api 래퍼가 이미 토스트+전역 처리. 그 외에만 사유 안내.
      if ((err as ApiResponse<null>)?.status !== 401) {
        showToast((err as ApiResponse<null>)?.message || '생성 요청에 실패했어요');
      }
      setPhase('idle');
      return;
    }

    if (cancelledRef.current) return;
    setJob(res.data);
    setPhase('generating');
    scheduleNext(res.data.jobId);
  }, [clearTimer, scheduleNext]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    pollCountRef.current = 0;
    setJob(null);
    setPhase('idle');
    setErrorMessage(null);
  }, [clearTimer]);

  // unmount cleanup: 진행 중 폴링 무력화 + 타이머 해제.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);

  return { job, phase, errorMessage, start, reset };
}
