'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/types/api';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { useAuthContext } from '@/components/providers/AuthProvider';
import Avatar from '@/components/common/Avatar';

function formatTime(dateStr: string): string {
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const date = new Date(utcStr);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuthContext();
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgPreview(null);
  }, []);

  // 초기 메시지 로드
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>('/api/chat/messages?size=30', { silent: true });
        setMessages(res.data?.messages ?? []);
        setHasMore(res.data?.hasMore ?? false);
      } catch {
        setMessages([]);
        setHasMore(false);
      }
    }
    loadMessages();
  }, []);

  // 이전 메시지 로드
  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(`/api/chat/messages?size=30&beforeId=${oldestId}`, { silent: true });
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

  // user를 ref로 추적
  const userRef = useRef(user);
  userRef.current = user;

  // 채팅 채널 수신 (메시지 + 프로필 변경)
  useEffect(() => {
    const unsubscribe = wsService.on('chat', (data) => {
      const parsed = data as Record<string, unknown>;

      if (parsed.type === 'PROFILE_UPDATED') {
        const profile = data as { nickname: string; profileImageUrl: string | null };
        setMessages((prev) =>
          prev.map((m) =>
            m.senderNickname === profile.nickname ? { ...m, senderProfileImageUrl: profile.profileImageUrl } : m
          )
        );
        return;
      }

      // 채팅 메시지
      const msg = data as ChatMessage;
      if (!msg.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!wasNearBottomRef.current && userRef.current && msg.senderNickname !== userRef.current.nickname) {
        setNewMsgPreview(msg);
      }
    });
    return unsubscribe;
  }, []);

  // 스크롤 위치 추적
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const trackScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      wasNearBottomRef.current = distFromBottom < 100;
      setShowScrollBtn(distFromBottom > 300);
      if (distFromBottom < 100) setNewMsgPreview(null);
    };
    container.addEventListener('scroll', trackScroll);
    return () => container.removeEventListener('scroll', trackScroll);
  }, []);

  // 새 메시지 자동 스크롤
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
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
  }, [messages, scrollToBottom]);

  // 스크롤 맨 위 감지
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop < 10 && hasMore && !loadingMore) {
        loadOlderMessages();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loadOlderMessages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !user) return;
    wsService.send('/pub/chat/send', { content: trimmed });
    setInput('');
    setTimeout(() => scrollToBottom(), 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  if (authLoading) {
    return <div className="flex justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] -mx-4 -my-6 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">오픈채팅</h1>
      </div>

      {/* 메시지 목록 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 chat-scrollbar">
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loadingMore && hasMore && messages.length > 0 && (
          <p className="text-center text-[10px] text-gray-300 py-1">위로 스크롤하면 이전 메시지를 불러와요</p>
        )}
        {!user && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-400">로그인하면 채팅에 참여할 수 있어요</p>
          </div>
        )}
        {user && messages.length === 0 && !loadingMore && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-400">아직 메시지가 없어요. 첫 메시지를 보내보세요!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = user ? msg.senderNickname === user.nickname : false;

          if (isMine) {
            return (
              <div key={msg.id} className="flex items-end justify-end gap-1.5">
                <span className="text-[10px] text-gray-400 mb-0.5">{formatTime(msg.createdAt)}</span>
                <div className="max-w-[75%] lg:max-w-md px-3.5 py-2.5 rounded-2xl rounded-br-md bg-amber-500 text-white text-sm break-words whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2">
              <Avatar src={msg.senderProfileImageUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-700 block mb-1">{msg.senderNickname}</span>
                <div className="flex items-end gap-1.5">
                  <div className="inline-block max-w-[85%] lg:max-w-md px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-gray-900 text-sm break-words whitespace-pre-wrap">
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
            className="absolute -top-12 right-6 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
          </button>
        )}
        {newMsgPreview && (
          <button
            onClick={scrollToBottom}
            className="absolute -top-12 left-6 right-6 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-lg z-10 hover:bg-gray-50 transition-all duration-200"
          >
            <Avatar src={newMsgPreview.senderProfileImageUrl} size="xs" />
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">{newMsgPreview.senderNickname}</span>
            <span className="text-sm text-gray-500 truncate">{newMsgPreview.content}</span>
          </button>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="px-6 py-4 border-t border-gray-100">
        {user ? (
          <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-gray-50 rounded-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-amber-400 transition-all duration-200">
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
              className="flex-1 text-base bg-transparent text-gray-900 outline-none resize-none max-h-24 overflow-y-auto placeholder-gray-400"
              style={{ minHeight: '20px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all duration-200 flex-shrink-0 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-2">로그인하면 채팅에 참여할 수 있어요</p>
        )}
      </div>
    </div>
  );
}
