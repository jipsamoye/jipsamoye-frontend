'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/types/api';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { timeAgo } from '@/lib/utils';
import { storage } from '@/lib/storage';

function getOrCreateNickname(): string {
  if (typeof window === 'undefined') return '익명의멍집사1';
  const stored = storage.getOpenChatNickname();
  if (stored) return stored;

  const prefixes = ['익명의멍집사', '익명의냥집사'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  const nickname = `${prefix}${num}`;
  storage.setOpenChatNickname(nickname);
  return nickname;
}

export default function OpenChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize nickname
  useEffect(() => {
    setNickname(getOrCreateNickname());
  }, []);

  // Load initial messages when chat opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadMessages() {
      try {
        const res = await api.get<ChatMessage[]>('/api/chat/messages?size=50');
        setMessages(res.data ?? []);
      } catch {
        setMessages([]);
      }
    }

    loadMessages();
  }, [isOpen]);

  // Subscribe to WebSocket messages
  useEffect(() => {
    const unsubscribe = wsService.subscribe('CHAT_MESSAGE', (data) => {
      const msg = data as ChatMessage;
      setMessages((prev) => [...prev, msg]);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    wsService.send('CHAT_MESSAGE', { content: trimmed, nickname });

    // Optimistic update
    const optimisticMessage: ChatMessage = {
      id: Date.now(),
      nickname,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl flex items-center justify-center transition-all duration-200"
        aria-label="오픈채팅 열기"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[60] w-80 h-[480px] max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:h-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl max-sm:rounded-none shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              오픈채팅
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
              aria-label="채팅 닫기"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-400 mt-8">
                아직 메시지가 없어요. 첫 메시지를 보내보세요!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.nickname === nickname;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  {!isMine && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      {msg.nickname}
                    </span>
                  )}
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-xl text-sm break-words ${
                      isMine
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-gray-900 dark:text-amber-100'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요"
                className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all duration-200"
                aria-label="전송"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
