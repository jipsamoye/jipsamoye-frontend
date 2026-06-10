'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { showToast } from '@/components/common/Toast';
import { NAVER_STATE_KEY, requestNaverLogin } from '@/lib/naverAuth';

function NaverCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateUser } = useAuthContext();
  // 인가코드는 일회용·단명. StrictMode 이중 실행 시 같은 code로 두 번 호출하면
  // 두 번째는 401이 나므로 ref 가드로 한 번만 실행한다.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // state 검증은 프론트 책임 (CSRF 방지). 저장값과 비교 후 즉시 삭제.
    const saved = sessionStorage.getItem(NAVER_STATE_KEY);
    sessionStorage.removeItem(NAVER_STATE_KEY);

    if (!code || !state || state !== saved) {
      showToast('잘못된 접근이에요. 다시 로그인해주세요.');
      router.replace('/');
      return;
    }

    requestNaverLogin(code, state).then((result) => {
      if (result.ok) {
        updateUser(result.user);
        if (result.isNewUser) {
          showToast('환영합니다! 집사모여에 오신 걸 환영해요 🐾');
        }
        router.replace('/');
        return;
      }

      if (result.code === 'NAVER_TOKEN_EXCHANGE_FAILED') {
        showToast('인증이 만료됐어요. 다시 로그인해주세요.');
      } else {
        showToast('잠시 후 다시 시도해주세요.');
      }
      router.replace('/');
    });
  }, [router, searchParams, updateUser]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#03C75A] animate-spin" />
      <p className="text-sm text-gray-500">네이버 로그인 중...</p>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <NaverCallbackContent />
    </Suspense>
  );
}
