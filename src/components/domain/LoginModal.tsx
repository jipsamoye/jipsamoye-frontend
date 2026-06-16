'use client';

import Modal from '@/components/common/Modal';
import { startNaverLogin } from '@/lib/naverAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuestLogin: () => void;
}

export default function LoginModal({ isOpen, onClose, onGuestLogin }: LoginModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="로그인">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">집사모여</h2>
        <p className="text-sm text-gray-500 mb-6">
          우리 애 자랑하러 오세요!
        </p>

        <div className="flex flex-col gap-3">
          {/* 네이버 로그인 — 실제 동작 */}
          <button
            onClick={() => startNaverLogin()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#03C75A] text-white font-medium text-sm hover:bg-[#02B350] transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M12.27 9.64 5.5 0H0v18h5.73V8.36L12.5 18H18V0h-5.73v9.64Z" fill="#fff"/></svg>
            네이버로 계속하기
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">또는</span>
            </div>
          </div>

          {/* Guest 로그인 — 실제 동작 */}
          <button
            onClick={() => { onGuestLogin(); onClose(); }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-[1.5px] border-amber-300 bg-white text-amber-600 font-medium text-sm hover:bg-amber-50 hover:border-amber-400 transition-all duration-200"
          >
            <span aria-hidden="true">🐾</span>
            게스트로 둘러보기
          </button>
          <div className="mt-1 flex justify-center">
            <span className="inline-block px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-600 text-sm font-semibold leading-snug">
              회원가입 없이 모든 기능을 체험할 수 있어요
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
