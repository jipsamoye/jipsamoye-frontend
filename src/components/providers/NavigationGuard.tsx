'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';

interface NavigationGuardContextType {
  setBlocked: (blocked: boolean, message?: string) => void;
  guardedPush: (url: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  setBlocked: () => {},
  guardedPush: () => {},
});

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export default function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const blockedRef = useRef(false);
  const messageRef = useRef('작성을 취소하고 나가시겠어요?');
  const pendingUrl = useRef<string | null>(null);
  const isBackRef = useRef(false);
  const dummyPushedRef = useRef(false);

  const setBlocked = useCallback((blocked: boolean, message?: string) => {
    blockedRef.current = blocked;
    if (message) messageRef.current = message;

    if (blocked && !dummyPushedRef.current) {
      // 더미 히스토리 추가 → 뒤로가기 시 더미가 먼저 pop됨 (페이지 전환 안 됨)
      window.history.pushState({ navGuard: true }, '', window.location.href);
      dummyPushedRef.current = true;
    }
    if (!blocked && dummyPushedRef.current) {
      // 가드 해제 시 더미를 현재 상태로 교체 (history.back() 안 씀)
      window.history.replaceState(null, '', window.location.href);
      dummyPushedRef.current = false;
    }
  }, []);

  const guardedPush = useCallback((url: string) => {
    if (blockedRef.current) {
      pendingUrl.current = url;
      isBackRef.current = false;
      setShowModal(true);
    } else {
      router.push(url);
    }
  }, [router]);

  const confirmLeave = () => {
    blockedRef.current = false;
    dummyPushedRef.current = false;
    setShowModal(false);
    if (isBackRef.current) {
      isBackRef.current = false;
      router.back();
    } else if (pendingUrl.current) {
      router.push(pendingUrl.current);
    }
  };

  const cancelLeave = () => {
    // 취소 시 더미 히스토리 다시 추가
    if (!dummyPushedRef.current && blockedRef.current) {
      window.history.pushState({ navGuard: true }, '', window.location.href);
      dummyPushedRef.current = true;
    }
    setShowModal(false);
    isBackRef.current = false;
    pendingUrl.current = null;
  };

  // 브라우저 뒤로가기 감지
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (blockedRef.current) {
        // 더미가 pop됐으므로 페이지 전환은 안 됨
        dummyPushedRef.current = false;
        isBackRef.current = true;
        pendingUrl.current = null;
        setShowModal(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setBlocked, guardedPush }}>
      {children}
      <Modal isOpen={showModal} onClose={cancelLeave}>
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">{messageRef.current}</h3>
          <p className="text-sm text-gray-500 mb-6">작성한 내용이 모두 초기화돼요</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="lg" onClick={cancelLeave}>닫기</Button>
            <Button size="lg" onClick={confirmLeave}>나가기</Button>
          </div>
        </div>
      </Modal>
    </NavigationGuardContext.Provider>
  );
}
