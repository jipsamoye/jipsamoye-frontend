'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/types/api';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';

function formatTime(dateStr: string): string {
  // UTC로 인식시켜서 브라우저가 로컬(한국) 시간으로 자동 변환
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const date = new Date(utcStr);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function OpenChat() {
  const { user } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgPreview, setNewMsgPreview] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoad = useRef(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgPreview(null);
  }, []);

  // 초기 메시지 로드
  useEffect(() => {
    if (!isOpen) {
      prevMsgCountRef.current = 0;
      return;
    }
    async function loadMessages() {
      try {
        const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>('/api/chat/messages?size=30');
        setMessages(res.data?.messages ?? []);
        setHasMore(res.data?.hasMore ?? false);
      } catch {
        setMessages([]);
        setHasMore(false);
      }
    }
    loadMessages();
  }, [isOpen]);

  // 이전 메시지 로드
  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(`/api/chat/messages?size=30&beforeId=${oldestId}`);
      const older = res.data?.messages ?? [];
      setHasMore(res.data?.hasMore ?? false);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages]);

  // user를 ref로 추적 (useEffect 의존성 문제 방지)
  const userRef = useRef(user);
  userRef.current = user;

  // 채팅 메시지 수신 (type이 없거나 CHAT_MESSAGE인 경우)
  useEffect(() => {
    const unsubscribe = wsService.subscribe('CHAT_MESSAGE', (data) => {
      const msg = data as ChatMessage;
      if (!msg.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // 위에서 읽고 있으면 미리보기 표시
      if (!wasNearBottomRef.current && userRef.current && msg.userId !== userRef.current.id) {
        setNewMsgPreview(msg);
      }
    });
    return unsubscribe;
  }, []);

  // 프로필 변경 수신
  useEffect(() => {
    const unsubscribe = wsService.subscribe('PROFILE_UPDATED', (data) => {
      const parsed = data as { userId: number; nickname: string; profileImageUrl: string | null };
      setMessages((prev) =>
        prev.map((m) =>
          m.userId === parsed.userId ? { ...m, nickname: parsed.nickname, profileImageUrl: parsed.profileImageUrl } : m
        )
      );
    });
    return unsubscribe;
  }, []);

  // 스크롤 위치 추적
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isOpen) return;
    const trackScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      wasNearBottomRef.current = distFromBottom < 100;
      // 300px 이상 올라가면 화살표 버튼 표시
      setShowScrollBtn(distFromBottom > 300);
      // 맨 아래로 돌아오면 미리보기 숨기기
      if (distFromBottom < 100) setNewMsgPreview(null);
    };
    container.addEventListener('scroll', trackScroll);
    return () => container.removeEventListener('scroll', trackScroll);
  }, [isOpen]);

  // 새 메시지 추가 시 자동 스크롤
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (!isOpen) return;
    const isNewMessage = messages.length > prevMsgCountRef.current;
    const isFirstLoad = prevMsgCountRef.current === 0 && messages.length > 0;
    prevMsgCountRef.current = messages.length;

    if (isFirstLoad) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    } else if (isNewMessage && wasNearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [messages, isOpen, scrollToBottom]);

  // 스크롤 맨 위 감지 → 이전 메시지 로드
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isOpen) return;

    const handleScroll = () => {
      if (container.scrollTop < 10 && hasMore && !loadingMore) {
        loadOlderMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, hasMore, loadingMore, loadOlderMessages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !user) return;
    wsService.send('/pub/chat/send', { userId: user.id, content: trimmed });
    setInput('');
    setTimeout(() => scrollToBottom(), 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl flex items-center justify-center transition-all duration-200"
        aria-label="오픈채팅 열기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      </button>

      {/* 채팅창 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[60] w-80 h-[480px] max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:h-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl max-sm:rounded-none shadow-2xl flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">오픈채팅</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 메시지 목록 */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loadingMore && hasMore && messages.length > 0 && (
              <p className="text-center text-[10px] text-gray-300 py-1">위로 스크롤하면 이전 메시지를 불러와요</p>
            )}
            {!user && (
              <p className="text-center text-sm text-gray-400 mt-8">로그인하면 채팅에 참여할 수 있어요</p>
            )}
            {user && messages.length === 0 && !loadingMore && (
              <p className="text-center text-sm text-gray-400 mt-8">아직 메시지가 없어요. 첫 메시지를 보내보세요!</p>
            )}
            {messages.map((msg) => {
              const isMine = user ? msg.userId === user.id : false;

              if (isMine) {
                return (
                  <div key={msg.id} className="flex items-end justify-end gap-1.5">
                    <span className="text-[10px] text-gray-400 mb-0.5">{formatTime(msg.createdAt)}</span>
                    <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-amber-500 text-white text-sm break-words whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <Avatar src={msg.profileImageUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">{msg.nickname}</span>
                    <div className="flex items-end gap-1.5">
                      <div className="inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm break-words whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mb-0.5 flex-shrink-0">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 맨 아래로 이동 버튼 + 새 메시지 미리보기 */}
          <div className="relative">
            {showScrollBtn && !newMsgPreview && (
              <button
                onClick={scrollToBottom}
                className="absolute -top-12 right-4 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200 z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                </svg>
              </button>
            )}
            {newMsgPreview && (
              <button
                onClick={scrollToBottom}
                className="absolute -top-12 left-3 right-3 flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <Avatar src={newMsgPreview.profileImageUrl} size="xs" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">{newMsgPreview.nickname}</span>
                <span className="text-xs text-gray-500 truncate">{newMsgPreview.content}</span>
              </button>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus-within:ring-2 focus-within:ring-amber-400 transition-all duration-200">
                  {!inputFocused && !input && (
                    <div className="flex-shrink-0">
                      <Avatar src={user.profileImageUrl} size="xs" />
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px'; } }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => { if (!input) setInputFocused(false); }}
                    placeholder={`${user.nickname}(으)로 메시지 입력`}
                    rows={1}
                    className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white outline-none resize-none max-h-24 overflow-y-auto placeholder-gray-400"
                    style={{ minHeight: '20px' }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-400 py-1">로그인이 필요해요</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
