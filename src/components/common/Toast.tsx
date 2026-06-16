'use client';

import { useState, useEffect, useCallback } from 'react';

export type ToastVariant = 'default' | 'login-required';

interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

interface ToastDisplay extends ToastMessage {
  closing: boolean;
}

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function showToast(text: string, options?: { variant?: ToastVariant }) {
  const msg: ToastMessage = { id: ++toastId, text, variant: options?.variant ?? 'default' };
  listeners.forEach((fn) => fn(msg));
}

export type LoginAction = 'like' | 'comment' | 'reply' | 'follow' | 'message';

const LOGIN_ACTION_MESSAGES: Record<LoginAction, string> = {
  like: '로그인하고 좋아요를 눌러보세요',
  comment: '로그인하고 댓글을 남겨보세요',
  reply: '로그인하고 답글을 달아보세요',
  follow: '로그인하고 다른 집사를 팔로우해보세요',
  message: '로그인하고 다른 집사에게 메시지를 보내보세요',
};

export function showLoginRequiredToast(action: LoginAction) {
  showToast(LOGIN_ACTION_MESSAGES[action], { variant: 'login-required' });
}

const DURATION_MS = 3000;
const FADE_MS = 300;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastDisplay[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts((prev) => [...prev, { ...msg, closing: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === msg.id ? { ...t, closing: true } : t));
    }, DURATION_MS - FADE_MS);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== msg.id));
    }, DURATION_MS);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => { listeners.delete(addToast); };
  }, [addToast]);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2">
      {toasts.map((toast) =>
        toast.variant === 'login-required' ? (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-6 py-4 bg-white border-2 border-red-300 rounded-2xl shadow-md transition-opacity duration-300 ${
              toast.closing ? 'opacity-0' : 'opacity-100 animate-[slideDown_0.3s_ease-out]'
            }`}
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3.5 h-3.5">
                <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </span>
            <span className="text-base font-semibold text-gray-700">{toast.text}</span>
          </div>
        ) : (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-3 bg-white border border-gray-100 rounded-2xl shadow-xl transition-opacity duration-300 ${
              toast.closing ? 'opacity-0' : 'opacity-100 animate-[slideDown_0.3s_ease-out]'
            }`}
          >
            <span className="text-red-500 text-lg">&#x2716;</span>
            <span className="text-sm font-medium text-gray-900">{toast.text}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      )}
    </div>
  );
}
