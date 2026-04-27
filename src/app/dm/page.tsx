'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import Avatar from '@/components/common/Avatar';
import Thumbnail from '@/components/common/Thumbnail';
import Modal from '@/components/common/Modal';
import { timeAgo } from '@/lib/utils';
import type { DmRoom, DmMessage, FollowUser, PageResponse } from '@/types/api';

export default function DmPage() {
  const { user, loading } = useAuthContext();
  const [rooms, setRooms] = useState<DmRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId) ?? null;

  useEffect(() => {
    if (!user) return;
    api
      .get<DmRoom[]>(`/api/dm/rooms`)
      .then((res) => setRooms(res.data ?? []))
      .catch(() => setRooms([]));
  }, [user]);

  useEffect(() => {
    if (!selectedRoomId || !user) {
      setMessages([]);
      return;
    }
    // REST로 기존 메시지 로드
    api
      .get<PageResponse<DmMessage>>(`/api/dm/rooms/${selectedRoomId}/messages?page=0&size=50`)
      .then((res) => setMessages(res.data?.content ?? []))
      .catch(() => setMessages([]));

    // WebSocket 구독 (실시간 수신)
    const unsubscribe = wsService.onDmRoom(selectedRoomId, (data) => {
      const msg = data as DmMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return unsubscribe;
  }, [selectedRoomId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectRoom = useCallback((roomId: number) => {
    setSelectedRoomId(roomId);
    setMobileView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
    setSelectedRoomId(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !selectedRoomId || !user) return;

    // WebSocket으로 메시지 전송
    wsService.send('/pub/dm/send', {
      roomId: selectedRoomId,
      content: inputValue.trim(),
      imageUrl: null,
    });
    const sentContent = inputValue.trim();
    setInputValue('');

    setRooms((prev) =>
      prev.map((r) =>
        r.roomId === selectedRoomId
          ? { ...r, lastMessage: sentContent, lastMessageAt: new Date().toISOString() }
          : r
      )
    );
  }, [inputValue, selectedRoomId, user]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleOpenNewMessageModal = useCallback(() => {
    if (!user) return;
    setShowNewMessageModal(true);
    setModalSearchQuery('');
    api
      .get<PageResponse<FollowUser>>(`/api/users/${user.nickname}/following?page=0&size=20`)
      .then((res) => setFollowingList(res.data?.content ?? []))
      .catch(() => setFollowingList([]));
  }, [user]);

  const handleCreateRoom = useCallback(
    async (targetNickname: string) => {
      if (!user) return;
      try {
        const res = await api.post<DmRoom>(
          `/api/dm/rooms?targetNickname=${encodeURIComponent(targetNickname)}`
        );
        const newRoom = res.data;
        setRooms((prev) => {
          if (prev.some((r) => r.roomId === newRoom.roomId)) return prev;
          return [newRoom, ...prev];
        });
        setSelectedRoomId(newRoom.roomId);
        setMobileView('chat');
      } catch {
        // ignore
      }
      setShowNewMessageModal(false);
    },
    [user]
  );

  const filteredFollowing = followingList.filter((f) =>
    f.nickname.toLowerCase().includes(modalSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900">로그인이 필요해요</p>
        <p className="text-sm text-gray-500">DM 기능을 사용하려면 먼저 로그인해 주세요</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -mx-4 -my-6">
      {/* 왼쪽: 채팅방 목록 */}
      <div
        className={`w-full lg:w-80 lg:flex-shrink-0 border-r border-gray-200 flex flex-col bg-white
          ${mobileView === 'list' ? 'flex' : 'hidden lg:flex'}`}
      >
        <div className="pt-6 px-5 pb-3">
          <h2 className="text-2xl font-bold text-gray-900">DM</h2>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름을 검색해 보세요"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
            <p className="text-sm text-gray-400">아직 주고 받은 메세지가 없어요</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {rooms
              .filter((room) =>
                room.otherUserNickname.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => handleSelectRoom(room.roomId)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50
                    ${selectedRoomId === room.roomId ? 'bg-gray-100' : ''}`}
                >
                  <Avatar src={room.otherUserProfileImageUrl} alt={room.otherUserNickname} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {room.otherUserNickname}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {room.lastMessageAt ? timeAgo(room.lastMessageAt) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 truncate">
                        {room.lastMessage ?? '아직 대화가 없어요'}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 대화창 */}
      <div
        className={`flex-1 flex flex-col bg-white
          ${mobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}
      >
        {!selectedRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-gray-500 text-center">
              다른 집사에게 사진과 메시지를 보낼 수 있어요
            </p>
            <button
              onClick={handleOpenNewMessageModal}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all duration-200"
            >
              새 메세지 보내기
            </button>
          </div>
        ) : (
          <>
            {/* 채팅 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <Avatar src={selectedRoom.otherUserProfileImageUrl} alt={selectedRoom.otherUserNickname} size="md" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{selectedRoom.otherUserNickname}</p>
                  <p className="text-xs text-gray-400">@{selectedRoom.otherUserNickname}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </button>
                <button
                  onClick={handleBackToList}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar">
              {messages.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">
                  아직 메시지가 없어요. 첫 메시지를 보내보세요!
                </p>
              )}
              {messages.map((msg) => {
                const isMine = msg.senderNickname === user.nickname;
                const time = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                if (isMine) {
                  return (
                    <div key={msg.id} className="flex items-end justify-end gap-1.5">
                      <div className="flex flex-col items-end gap-0.5 mb-0.5">
                        {msg.readAt ? (
                          <span className="text-[10px] text-gray-400">읽음</span>
                        ) : (
                          <span className="text-[10px] text-amber-500">1</span>
                        )}
                        <span className="text-[10px] text-gray-400">{time}</span>
                      </div>
                      <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-amber-500 text-white text-sm break-words whitespace-pre-wrap">
                        {msg.imageUrl && (
                          <Thumbnail src={msg.imageUrl} alt="첨부 이미지" sizes="(max-width: 640px) 75vw, 400px" className="max-w-full rounded-lg mb-1" />
                        )}
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex items-start gap-2">
                    <Avatar src={selectedRoom.otherUserProfileImageUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 block mb-1">{msg.senderNickname}</span>
                      <div className="flex items-end gap-1.5">
                        <div className="inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-gray-900 text-sm break-words whitespace-pre-wrap">
                          {msg.imageUrl && (
                            <Thumbnail src={msg.imageUrl} alt="첨부 이미지" sizes="(max-width: 640px) 85vw, 400px" className="max-w-full rounded-lg mb-1" />
                          )}
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-gray-400 mb-0.5 flex-shrink-0">{time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={() => {}}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                </button>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지 보내기"
                  rows={1}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 resize-none max-h-24 overflow-y-auto"
                  style={{ height: 'auto', minHeight: '36px' }}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 96) + 'px'; } }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-sm font-medium transition-all duration-200"
                >
                  전송
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 메세지 보내기 모달 */}
      <Modal isOpen={showNewMessageModal} onClose={() => setShowNewMessageModal(false)} title="메세지 보내기">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={modalSearchQuery}
              onChange={(e) => setModalSearchQuery(e.target.value)}
              placeholder="누구에게 메시지를 보낼까요?"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="max-h-72 overflow-y-auto -mx-2">
            {filteredFollowing.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                {modalSearchQuery ? '검색 결과가 없어요' : '팔로잉 중인 유저가 없어요'}
              </p>
            ) : (
              filteredFollowing.map((followUser) => (
                <div
                  key={followUser.nickname}
                  className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={followUser.profileImageUrl} alt={followUser.nickname} size="md" />
                    <span className="text-sm font-medium text-gray-900">{followUser.nickname}</span>
                  </div>
                  <button
                    onClick={() => handleCreateRoom(followUser.nickname)}
                    className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
