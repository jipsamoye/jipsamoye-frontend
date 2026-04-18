'use client';

import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuestLogin: () => void;
}

export default function LoginModal({ isOpen, onClose, onGuestLogin }: LoginModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">집사모여</h2>
        <p className="text-sm text-gray-500 mb-6">
          우리 애 자랑하러 오세요!
        </p>

        <div className="flex flex-col gap-3">
          {/* 카카오 로그인 — 버튼만, 동작 안 함 */}
          <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#FEE500] text-[#191919] font-medium text-sm hover:bg-[#FDD800] transition-all duration-200">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18l-.93 3.44c-.08.3.26.54.52.37l4.13-2.72c.21.02.42.03.64.03 4.42 0 8-2.79 8-6.21S13.42 1 9 1" fill="#191919"/></svg>
            카카오로 계속하기
          </button>

          {/* 구글 로그인 — 버튼만, 동작 안 함 */}
          <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all duration-200">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
            구글로 계속하기
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
          <Button variant="secondary" size="lg" className="w-full" onClick={() => { onGuestLogin(); onClose(); }}>
            Guest로 로그인하기
          </Button>
          <p className="text-xs text-gray-400 mt-1">
            회원가입 없이 임시 계정으로 모든 기능을 체험할 수 있어요
          </p>
        </div>
      </div>
    </Modal>
  );
}
