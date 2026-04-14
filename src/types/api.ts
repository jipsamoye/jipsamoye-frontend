// 공통 API 응답
export interface ApiResponse<T> {
  status: number;
  code: string;
  message: string;
  data: T;
}

// 페이지네이션 응답
export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
  size: number;
  hasNext: boolean;
}

// 소셜 링크
export interface SocialLink {
  type: 'INSTAGRAM' | 'YOUTUBE';
  url: string;
}

// 유저
export interface User {
  id: number;
  nickname: string;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  socialLinks: SocialLink[];
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: string;
}

// 게시글 상세
export interface PetPost {
  id: number;
  title: string;
  content: string;
  imageUrls: string[];
  likeCount: number;
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// 게시글 목록 (카드)
export interface PetPostListItem {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  likeCount: number;
  userId: number;
  nickname: string;
  createdAt: string;
}

// 댓글
export interface Comment {
  id: number;
  content: string;
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  parentId?: number | null;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

// 팔로우 유저
export interface FollowUser {
  id: number;
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

// 댓글 작성/수정 요청
export interface CommentRequest {
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

// 알림
export interface Notification {
  id: number;
  type: string;
  targetId?: number;
  message: string;
  senderId: number;
  senderNickname: string;
  senderProfileImageUrl: string | null;
  read: boolean;
  createdAt: string;
}

// 채팅 메시지
export interface ChatMessage {
  id: number;
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  content: string;
  createdAt: string;
}

// DM 채팅방
export interface DmRoom {
  roomId: number;
  otherUserId: number;
  otherUserNickname: string;
  otherUserProfileImageUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// DM 메시지
export interface DmMessage {
  id: number;
  senderId: number;
  senderNickname: string;
  content: string;
  imageUrl?: string;
  readAt: string | null;
  createdAt: string;
}
