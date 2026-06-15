// 공통 API 응답
export interface ApiResponse<T> {
  status: number;
  code: string;
  message: string;
  data: T;
}

// 슬라이스 응답 (무한스크롤 — totalPages/totalElements 없음)
export interface SliceResponse<T> {
  content: T[];
  currentPage: number;
  size: number;
  hasNext: boolean;
}

// 페이지네이션 응답
export interface PageResponse<T> extends SliceResponse<T> {
  totalPages: number;
  totalElements: number;
}

// 소셜 링크
export interface SocialLink {
  type: 'INSTAGRAM' | 'YOUTUBE';
  url: string;
}

// 유저
export interface User {
  nickname: string;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  socialLinks: SocialLink[];
  postCount: number;
  followerCount: number;
  followingCount: number;
  totalLikeCount: number;
  ranking: number | null;
  createdAt: string;
  /** 백엔드 계약 추가 필요: GET /api/users/{nickname} 응답에 포함 */
  isFollowing?: boolean;
}

// 게시글 상세
export interface PetPost {
  id: number;
  title: string;
  content: string;
  imageUrls: string[];
  likeCount: number;
  commentCount: number;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** 백엔드 계약 추가 필요: 현재 유저의 좋아요 여부 */
  isLiked?: boolean;
}

// 게시글 목록 (카드)
export interface PetPostListItem {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  likeCount: number;
  commentCount: number;
  nickname: string;
  profileImageUrl?: string | null;
  createdAt: string;
}

// 댓글
export interface Comment {
  id: number;
  content: string | null;          // isMasked=true이면 null
  nickname: string;
  profileImageUrl: string | null;
  authorTotalLikeCount: number;
  mentionedNickname: string | null;
  isMasked: boolean;
  replyCount: number;
  replies?: Comment[];             // 부모면 ASC 처음 3개, 답글 응답이면 비어있거나 없음
  createdAt: string;
  updatedAt: string;
}

// 팔로우 유저
export interface FollowUser {
  nickname: string;
  profileImageUrl: string | null;
}

// Presigned URL 응답
export interface PresignedUrlResponse {
  presignedUrl: string;
  imageUrl: string;
}

// 게시글 작성 요청
export interface PetPostCreateRequest {
  title: string;
  content: string;
  imageUrls: string[];
}

// 게시글 수정 요청
export interface PetPostUpdateRequest {
  title?: string;
  content?: string;
  imageUrls?: string[];
}

// 댓글 작성 요청
export interface CommentCreateRequest {
  petPostId: number;
  parentId: number | null;
  mentionedUserId: number | null;  // 항상 null (서버 자동 처리)
  content: string;
}

// 댓글 수정 요청
export interface CommentUpdateRequest {
  content: string;
}

// 프로필 수정 요청
export interface UserUpdateRequest {
  nickname?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  socialLinks?: SocialLink[];
}

// Presigned URL 요청
export interface PresignedUrlRequest {
  dirName: string;
  ext: string;
}

// 자유게시판 카테고리
export type BoardCategory = 'GENERAL' | 'QUESTION' | 'NOTICE';

// 자유게시판 검색 타입
export type BoardSearchType = 'TITLE' | 'TITLE_CONTENT';

// 자유게시판 목록 아이템
export interface BoardListItem {
  id: number;
  category: BoardCategory;
  title: string;
  contentPreview: string;
  commentCount: number;
  viewCount: number;
  likeCount: number;
  nickname: string;
  profileImageUrl?: string | null;
  createdAt: string;
}

// 자유게시판 글 상세
export interface BoardPost {
  id: number;
  category: BoardCategory;
  title: string;
  content: string;
  imageUrls: string[] | null;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
  /** 백엔드 계약 추가 필요: 현재 유저의 좋아요 여부 */
  isLiked?: boolean;
}

// 자유게시판 글 작성/수정 요청
export interface BoardRequest {
  category: BoardCategory;
  title: string;
  content: string;
  imageUrls?: string[];
}

// 자유게시판 댓글
export interface BoardComment {
  id: number;
  content: string | null;          // isMasked=true이면 null
  nickname: string;
  profileImageUrl: string | null;
  authorTotalLikeCount: number;
  mentionedNickname: string | null;
  isMasked: boolean;
  replyCount: number;
  replies?: BoardComment[];        // 부모면 ASC 처음 3개
  createdAt: string;
  updatedAt: string;
}

// 자유게시판 댓글 작성 요청
export interface BoardCommentCreateRequest {
  boardId: number;
  parentId: number | null;
  mentionedUserId: number | null;  // 항상 null (서버 자동 처리)
  content: string;
}

// 자유게시판 댓글 수정 요청
export interface BoardCommentUpdateRequest {
  content: string;
}

// 알림 타입 (백엔드 PR #53 기준 known set + 미래 타입 string fallback)
export type KnownNotificationType =
  | 'LIKE'
  | 'FOLLOW'
  | 'PET_POST_COMMENT'        // 신규: 게시글 최상위 댓글
  | 'PET_POST_COMMENT_REPLY'
  | 'BOARD_COMMENT'           // 신규: 게시판 최상위 댓글
  | 'BOARD_COMMENT_REPLY';
export type NotificationType = KnownNotificationType | (string & {});

// 알림
export interface Notification {
  id: number;
  type: NotificationType;
  // type별 의미 상이: LIKE=게시글ID, FOLLOW=유저ID, *_COMMENT(_REPLY)=댓글ID
  targetId: number | null;
  relatedPostId: number | null;   // 게시글 딥링크용 postId
  message: string;
  senderNickname: string;
  senderProfileImageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

// 채팅 메시지
export interface ChatMessage {
  id: number;
  senderNickname: string;
  senderProfileImageUrl: string | null;
  content: string;
  createdAt: string;
}

// DM 채팅방
export interface DmRoom {
  roomId: number;
  otherUserNickname: string;
  otherUserProfileImageUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/**
 * POST /api/dm/rooms?targetNickname= 응답 (resolve).
 * - 메시지가 오간 기존 방이면 roomId 포함(DmRoom).
 * - 아직 방이 없으면 roomId=null + 상대 정보만 내려오는 draft 응답.
 */
export type DmRoomResolve = Omit<DmRoom, 'roomId'> & { roomId: number | null };

// DM 메시지
export interface DmMessage {
  id: number;
  /** 어느 방의 메시지인지 (이벤트/에코 payload에 포함) */
  roomId?: number;
  senderNickname: string;
  content: string;
  imageUrl?: string;
  readAt: string | null;
  createdAt: string;
  /** 클라이언트 전용 — 낙관적 UI 매칭용 */
  clientMessageId?: string;
  /** 클라이언트 전용 — 낙관적 UI 상태 */
  status?: 'sending' | 'sent' | 'failed';
}

// DM 방 채널 WS 이벤트 (roomId 포함)
export type DmRoomEvent =
  | { type: 'MESSAGE'; roomId: number; message: DmMessage }
  | { type: 'READ'; roomId: number; readerNickname: string; readAt: string };

// 랭킹 페이지 API 응답 (GET /api/posts/ranking)
export interface RankingPageResponse {
  period: 'WEEKLY' | 'MONTHLY';
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD" (UI 표시용 inclusive end)
  isOngoing: boolean;
  posts: PageResponse<PetPostListItem>;
}
