'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import Avatar from '@/components/common/Avatar';
import Thumbnail from '@/components/common/Thumbnail';
import Modal from '@/components/common/Modal';
import { timeAgo, formatTime } from '@/lib/utils';
import { useDmRooms } from '@/hooks/useDmRooms';
import { useDmRoom } from '@/hooks/useDmRoom';
import type { DmRoom, DmRoomResolve, FollowUser, PageResponse } from '@/types/api';

/** draft(아직 방이 생성되지 않은) 대화 상대 정보 */
interface DraftPartner {
  nickname: string;
  profileImageUrl: string | null;
}

// ─── 자동 스크롤 결정 로직 ────────────────────────────────────────────────
// prevLastId: 직전 렌더의 마지막 메시지 id (undefined = effect 미실행, null = 메시지 없음)
// nextLastId: 현재 렌더의 마지막 메시지 id
// append(새 메시지 추가)/최초 로드/방 전환 → 마지막 id 변화 → true(스크롤)
// prepend(과거 메시지 로드) → 마지막 id 동일 → false(스크롤 억제)
export function shouldScrollToBottom(
  prevLastId: number | null | undefined,
  nextLastId: number | null | undefined
): boolean {
  // 최초 실행(prevLastId===undefined)이면서 메시지가 있을 때만 스크롤
  if (prevLastId === undefined) return nextLastId != null;
  // 마지막 id가 변했으면 append/방전환 → 스크롤
  return nextLastId !== prevLastId && nextLastId != null;
}

// ─── 딥링크 처리 + 실제 DM UI ─────────────────────────────────────────────

function DmPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuthContext();

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  // draft 대화: 아직 방이 없는 상대(roomId=null). 첫 메시지 전송 시 백엔드가 방 생성.
  const [draftPartner, setDraftPartner] = useState<DraftPartner | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  const { rooms, setRooms, resetUnread, updateLastMessage, applyServerLastMessage, applyRoomUpdate } =
    useDmRooms(user?.nickname ?? null);

  const { messages, hasOlderMessages, loadingOlder, loadOlderMessages, scrollAnchorRef, sendMessage, retryMessage } =
    useDmRoom({
      roomId: selectedRoomId,
      targetNickname: draftPartner?.nickname ?? null,
      userNickname: user?.nickname ?? null,
      onMessageSent: (roomId, content, createdAt) => {
        applyServerLastMessage(roomId, content, createdAt);
      },
      onUnread: (roomId) => {
        resetUnread(roomId);
      },
    });

  const selectedRoom: DmRoom | null = rooms.find((r) => r.roomId === selectedRoomId) ?? null;

  // 대화창에 표시할 상대 정보 — 실제 방(selectedRoom) 또는 draft 상대.
  // 채팅 패널은 이 값이 있을 때 렌더된다(draft도 빈 채팅창을 연다).
  const activePartner: { nickname: string; profileImageUrl: string | null } | null =
    selectedRoom
      ? {
          nickname: selectedRoom.otherUserNickname,
          profileImageUrl: selectedRoom.otherUserProfileImageUrl,
        }
      : draftPartner
        ? { nickname: draftPartner.nickname, profileImageUrl: draftPartner.profileImageUrl }
        : null;

  // dm-rooms 핸들러에서 stale closure 없이 최신 열림 상태를 참조하기 위한 ref
  const selectedRoomIdRef = useRef<number | null>(selectedRoomId);
  const draftPartnerRef = useRef<DraftPartner | null>(draftPartner);
  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    draftPartnerRef.current = draftPartner;
  }, [selectedRoomId, draftPartner]);

  // ─── 사용자별 DM 방 채널 구독 (버그②: 목록 화면 실시간 반영, 버그①: draft→실제 방 전환) ──
  useEffect(() => {
    if (!user) return;
    const unsubscribe = wsService.on('dm-rooms', (data: unknown) => {
      const payload = data as DmRoom;
      if (payload == null || typeof payload.roomId !== 'number') return;

      // draft 상태에서 첫 메시지를 보낸 상대의 방이 막 생성된 경우 → 실제 roomId로 전환.
      // NOTE: 백엔드가 발신자에게도 이 채널로 push하도록 보장됨. 만약 push가 누락되면
      //       draft가 실제 방으로 전환되지 않아 첫 메시지가 목록에 안 뜰 수 있음(설계상 의존성).
      // NOTE: 닉네임 단일 매칭의 한계 — 방은 pair(두 사용자)당 유일하므로 닉네임이 일치하는
      //       전환 대상 방은 항상 정확하다. 닉네임 변경/재사용 같은 희귀 엣지에서만 오매칭 여지.
      const draft = draftPartnerRef.current;
      if (draft && payload.otherUserNickname === draft.nickname) {
        setSelectedRoomId(payload.roomId);
        setDraftPartner(null);
        // 전환된 방은 지금 열려 있으므로 unread 0으로 반영
        applyRoomUpdate(payload, payload.roomId);
        return;
      }

      applyRoomUpdate(payload, selectedRoomIdRef.current);
    });
    return unsubscribe;
  }, [user, applyRoomUpdate]);

  // ─── 딥링크: ?room= 으로 기존 방 선택 / ?draft= 으로 draft 대화 열기 ──────
  useEffect(() => {
    const roomParam = searchParams.get('room');
    const draftParam = searchParams.get('draft');
    if (roomParam) {
      const roomId = parseInt(roomParam, 10);
      if (!isNaN(roomId)) {
        setSelectedRoomId(roomId);
        setDraftPartner(null);
        setMobileView('chat');
      }
    } else if (draftParam) {
      // 아직 방이 없는 상대와의 draft 대화. 진입부(프로필/호버카드)가 ?img= 로 넘긴
      // 프로필 이미지를 헤더 아바타에 즉시 반영. 없으면 dm-rooms 갱신/방 전환 시 채워짐.
      const imgParam = searchParams.get('img');
      setDraftPartner({ nickname: draftParam, profileImageUrl: imgParam || null });
      setSelectedRoomId(null);
      setMobileView('chat');
    } else {
      return;
    }
    // URL에서 쿼리 파라미터 제거 (뒤로가기 시 깔끔하게)
    router.replace('/dm', { scroll: false });
  }, [searchParams, router]);

  // ─── 새 메시지 도착 시 스크롤 ─────────────────────────────────────────
  // 마지막 메시지 id 변화로 append(새 메시지 추가/최초 로드) vs prepend(과거 메시지 로드)를 구분.
  // prepend는 첫 메시지 id만 바뀌고 마지막 id는 동일 → 스크롤하지 않음.
  // append/최초 로드/방 전환은 마지막 id가 바뀜 → 바닥으로 스크롤.
  const prevLastMessageIdRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const currentLastId = messages[messages.length - 1]?.id;
    if (shouldScrollToBottom(prevLastMessageIdRef.current, currentLastId)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLastMessageIdRef.current = currentLastId;
  }, [messages]);

  // ─── 위로 스크롤 감지 (무한스크롤) ─────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 60 && hasOlderMessages && !loadingOlder) {
        loadOlderMessages();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasOlderMessages, loadingOlder, loadOlderMessages]);

  const handleSelectRoom = useCallback((roomId: number) => {
    setSelectedRoomId(roomId);
    setDraftPartner(null);
    setMobileView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
    setSelectedRoomId(null);
    setDraftPartner(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    const content = inputValue.trim();
    setInputValue('');
    sendMessage(content);
    // draft(roomId 없음)일 땐 목록 낙관적 갱신을 건너뜀.
    // 첫 메시지 후 /user/sub/dm/rooms 푸시로 새 방이 목록에 반영된다.
    if (selectedRoomId != null) {
      updateLastMessage(selectedRoomId, content);
    }
  }, [inputValue, selectedRoomId, sendMessage, updateLastMessage]);

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
    async (followUser: FollowUser) => {
      if (!user) return;
      // resolve: 메시지가 오간 기존 방이면 roomId 포함, 없으면 draft 응답(roomId=null).
      // 방을 즉시 만들지 않고, 메시지가 없으면 draft 상태로만 연다(버그①).
      try {
        const res = await api.post<DmRoomResolve>(
          `/api/dm/rooms?targetNickname=${encodeURIComponent(followUser.nickname)}`
        );
        const resolved = res.data;
        if (resolved && resolved.roomId != null) {
          // 기존 방 → 목록에 없으면 합치고 선택
          const roomId = resolved.roomId;
          setRooms((prev) =>
            prev.some((r) => r.roomId === roomId)
              ? prev
              : [{ ...resolved, roomId }, ...prev]
          );
          setSelectedRoomId(roomId);
          setDraftPartner(null);
        } else {
          // 아직 방 없음 → draft 상태로 빈 채팅창 열기
          setDraftPartner({
            nickname: followUser.nickname,
            profileImageUrl: resolved?.otherUserProfileImageUrl ?? followUser.profileImageUrl ?? null,
          });
          setSelectedRoomId(null);
        }
        setMobileView('chat');
      } catch {
        // ignore
      }
      setShowNewMessageModal(false);
    },
    [user, setRooms]
  );

  const filteredFollowing = followingList.filter((f) =>
    f.nickname.toLowerCase().includes(modalSearchQuery.toLowerCase())
  );

  // ─── 로딩 / 미로그인 ─────────────────────────────────────────────────────
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
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-gray-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
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
          <div className="flex flex-col flex-1 items-center justify-center p-4 gap-2">
            <p className="text-sm text-gray-400">아직 주고 받은 메세지가 없어요</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const filtered = rooms.filter((room) =>
                room.otherUserNickname.toLowerCase().includes(searchQuery.toLowerCase())
              );
              if (filtered.length === 0) {
                return (
                  <p className="py-8 text-center text-sm text-gray-400">
                    검색 결과가 없어요
                  </p>
                );
              }
              return filtered.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => handleSelectRoom(room.roomId)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50
                    ${selectedRoomId === room.roomId ? 'bg-gray-100' : ''}`}
                >
                  <Avatar
                    src={room.otherUserProfileImageUrl}
                    alt={room.otherUserNickname}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {room.otherUserNickname}
                      </span>
                      <span className="flex-shrink-0 ml-2 text-xs text-gray-400">
                        {room.lastMessageAt ? timeAgo(room.lastMessageAt) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 truncate">
                        {room.lastMessage ?? '아직 대화가 없어요'}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center ml-2 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ));
            })()}
          </div>
        )}
      </div>

      {/* 오른쪽: 대화창 */}
      <div
        className={`flex-1 flex flex-col bg-white
          ${mobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}
      >
        {!activePartner ? (
          <div className="flex flex-col flex-1 items-center justify-center gap-4">
            <p className="text-center text-gray-500">
              다른 집사에게 사진과 메시지를 보낼 수 있어요
            </p>
            <button
              onClick={handleOpenNewMessageModal}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all duration-200"
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
                      d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>
                <Avatar
                  src={activePartner.profileImageUrl}
                  alt={activePartner.nickname}
                  size="md"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activePartner.nickname}
                  </p>
                </div>
              </div>
              {/* 닫기 버튼 (X 아이콘) */}
              <button
                onClick={handleBackToList}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                aria-label="대화 닫기"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
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

            {/* 메시지 목록 */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar"
            >
              {/* 과거 메시지 로딩 표시 */}
              {loadingOlder && (
                <p className="text-center text-xs text-gray-400 py-2">이전 메시지 불러오는 중...</p>
              )}
              {/* 더 이상 과거 메시지 없음 표시 */}
              {!hasOlderMessages && messages.length > 0 && !loadingOlder && (
                <p className="text-center text-xs text-gray-300 py-1">
                  대화의 시작이에요
                </p>
              )}

              {messages.length === 0 && !loadingOlder && (
                <p className="py-8 text-center text-sm text-gray-400">
                  아직 메시지가 없어요. 첫 메시지를 보내보세요!
                </p>
              )}

              {messages.map((msg) => {
                const isMine = msg.senderNickname === user.nickname;
                const time = formatTime(msg.createdAt);

                if (isMine) {
                  return (
                    <div key={msg.clientMessageId ?? msg.id} className="flex items-end justify-end gap-1.5">
                      <div className="flex flex-col items-end gap-0.5 mb-0.5">
                        {msg.status === 'failed' ? (
                          <button
                            onClick={() => retryMessage(msg.clientMessageId!)}
                            className="text-[10px] text-red-500 underline"
                          >
                            재전송
                          </button>
                        ) : msg.status === 'sending' ? (
                          <span className="text-[10px] text-gray-400">전송 중</span>
                        ) : msg.readAt ? (
                          <span className="text-[10px] text-gray-400">읽음</span>
                        ) : (
                          <span className="text-[10px] text-amber-500">1</span>
                        )}
                        <span className="text-[10px] text-gray-400">{time}</span>
                      </div>
                      <div
                        className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm break-words whitespace-pre-wrap
                          ${msg.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-500 text-white'}`}
                      >
                        {msg.imageUrl && (
                          <Thumbnail
                            src={msg.imageUrl}
                            alt="첨부 이미지"
                            sizes="(max-width: 640px) 75vw, 400px"
                            className="max-w-full rounded-lg mb-1"
                          />
                        )}
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.clientMessageId ?? msg.id} className="flex items-start gap-2">
                    <Avatar src={activePartner.profileImageUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="block mb-1 text-xs font-medium text-gray-700">
                        {msg.senderNickname}
                      </span>
                      <div className="flex items-end gap-1.5">
                        <div className="inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-gray-900 text-sm break-words whitespace-pre-wrap">
                          {msg.imageUrl && (
                            <Thumbnail
                              src={msg.imageUrl}
                              alt="첨부 이미지"
                              sizes="(max-width: 640px) 85vw, 400px"
                              className="max-w-full rounded-lg mb-1"
                            />
                          )}
                          {msg.content}
                        </div>
                        <span className="flex-shrink-0 mb-0.5 text-[10px] text-gray-400">
                          {time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={(el) => {
                messagesEndRef.current = el;
                (scrollAnchorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }} />
            </div>

            {/* 입력 영역 */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지 보내기"
                  rows={1}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 resize-none max-h-24 overflow-y-auto"
                  style={{ height: 'auto', minHeight: '36px' }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                    }
                  }}
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
      <Modal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        title="메세지 보내기"
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              value={modalSearchQuery}
              onChange={(e) => setModalSearchQuery(e.target.value)}
              placeholder="누구에게 메시지를 보낼까요?"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="-mx-2 max-h-72 overflow-y-auto">
            {filteredFollowing.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                {modalSearchQuery ? '검색 결과가 없어요' : '팔로잉 중인 유저가 없어요'}
              </p>
            ) : (
              filteredFollowing.map((followUser) => (
                <div
                  key={followUser.nickname}
                  className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={followUser.profileImageUrl}
                      alt={followUser.nickname}
                      size="md"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {followUser.nickname}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCreateRoom(followUser)}
                    className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
                        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                      />
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

// ─── Suspense 경계 (useSearchParams 빌드 실패 방지) ───────────────────────

export default function DmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-gray-500">불러오는 중...</p>
        </div>
      }
    >
      <DmPageInner />
    </Suspense>
  );
}
