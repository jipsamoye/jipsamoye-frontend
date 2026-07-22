import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { showToast } from '@/components/common/Toast';
import type { ApiResponse, FigurineJob, FigurinePostResponse } from '@/types/api';

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
  /**
   * COMPLETED 상태에서 자랑 피드 자동 게시. 성공/이미 게시(409 복원) 시 petPostId,
   * 실패 시 null 반환(completed로 복귀해 재시도 가능).
   */
  publish: () => Promise<number | null>;
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
 * - **세대(runId) 가드**: unmount/reset뿐 아니라 겹치는 start() 호출(이전 세대 무효화)도
 *   구분해야 하므로 단순 boolean 대신 세대 카운터를 사용한다(useUserSearch의 loadingRef와
 *   같은 관례). start()마다 runId를 증가시키고, await 이후 체크포인트마다
 *   `runId !== runIdRef.current`면 즉시 return — 이전 세대의 응답/타이머 콜백은 전부 no-op.
 *   unmount cleanup과 reset()도 동일하게 runId를 증가시켜 진행 중이던 세대를 무효화한다.
 */
export function useFigurineJob(): UseFigurineJobResult {
  const [job, setJob] = useState<FigurineJob | null>(null);
  const [phase, setPhase] = useState<FigurinePhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  // phase는 React state라 같은 렌더 사이클 내 동기 이중 호출은 둘 다 같은 클로저 값을 보고
  // 가드를 통과할 수 있다 — ref로 즉시 반영되는 별도 잠금을 둔다.
  const postingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // poll 자신을 재귀 setTimeout에서 참조해야 하므로 ref로 stale 클로저를 끊는다.
  const pollRef = useRef<(jobId: number, runId: number) => void>(() => {});

  const scheduleNext = useCallback((jobId: number, runId: number) => {
    timerRef.current = setTimeout(() => pollRef.current(jobId, runId), POLL_INTERVAL_MS);
  }, []);

  const failByTimeout = useCallback(() => {
    setPhase('failed');
    setErrorMessage(TIMEOUT_MESSAGE);
  }, []);

  const poll = useCallback(async (jobId: number, runId: number) => {
    if (runId !== runIdRef.current) return;

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.get<FigurineJob>(`/api/figurines/${jobId}`, { silent: true });
    } catch (err) {
      if (runId !== runIdRef.current) return;
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
      scheduleNext(jobId, runId);
      return;
    }

    if (runId !== runIdRef.current) return;

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
    scheduleNext(jobId, runId);
  }, [clearTimer, scheduleNext, failByTimeout]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const start = useCallback(async (sourceImageUrl: string) => {
    const runId = ++runIdRef.current;
    clearTimer();
    pollCountRef.current = 0;
    setJob(null);
    setErrorMessage(null);
    setPhase('creating');

    let res: ApiResponse<FigurineJob>;
    try {
      res = await api.post<FigurineJob>('/api/figurines', { sourceImageUrl });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      // 401은 api 래퍼가 이미 토스트+전역 처리. 그 외에만 사유 안내.
      if ((err as ApiResponse<null>)?.status !== 401) {
        showToast((err as ApiResponse<null>)?.message || '생성 요청에 실패했어요');
      }
      setPhase('idle');
      return;
    }

    if (runId !== runIdRef.current) return;
    setJob(res.data);
    setPhase('generating');
    scheduleNext(res.data.jobId, runId);
  }, [clearTimer, scheduleNext]);

  const publish = useCallback(async (): Promise<number | null> => {
    if (!job || phase !== 'completed' || postingRef.current) return null;
    postingRef.current = true;
    // 현재 세대 캡처 — 게시 중 reset()/unmount가 세대를 올리면 이후 setState를 모두 건너뛴다.
    const runId = runIdRef.current;
    setPhase('posting');

    try {
      const res = await api.post<FigurinePostResponse>(`/api/figurines/${job.jobId}/post`);
      const petPostId = res.data.petPostId;
      if (runId !== runIdRef.current) return petPostId;
      setJob((prev) => (prev ? { ...prev, petPostId } : prev));
      setPhase('posted');
      return petPostId;
    } catch (err) {
      if (runId !== runIdRef.current) return null;

      // 이미 게시된 잡(409) — GET으로 petPostId를 복원해 게시 완료로 수렴
      if ((err as ApiResponse<null>)?.code === 'FIGURINE_ALREADY_POSTED') {
        try {
          const res = await api.get<FigurineJob>(`/api/figurines/${job.jobId}`, { silent: true });
          if (runId === runIdRef.current && res.data.petPostId != null) {
            setJob(res.data);
            setPhase('posted');
            return res.data.petPostId;
          }
        } catch {
          // 복원 실패 — 아래 공통 복귀 처리로 진행
        }
      }

      if (runId === runIdRef.current) {
        if ((err as ApiResponse<null>)?.status !== 401) {
          showToast((err as ApiResponse<null>)?.message || '게시에 실패했어요');
        }
        setPhase('completed'); // 버튼 재활성화 — 재시도 가능
      }
      return null;
    } finally {
      postingRef.current = false;
    }
  }, [job, phase]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    clearTimer();
    pollCountRef.current = 0;
    setJob(null);
    setPhase('idle');
    setErrorMessage(null);
  }, [clearTimer]);

  // unmount cleanup: 진행 중이던 세대를 무효화 + 타이머 해제.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      clearTimer();
    };
  }, [clearTimer]);

  return { job, phase, errorMessage, start, publish, reset };
}
