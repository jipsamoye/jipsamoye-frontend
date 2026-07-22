// AI 키캡 자동 게시 제목 (백엔드 POST /api/figurines/{jobId}/post 가 생성)
export const AI_KEYCAP_POST_TITLE = 'AI 키캡 자랑';

interface AiPostSource {
  title: string;
  aiGenerated?: boolean;
}

/**
 * AI 키캡 생성 게시글 여부.
 * 백엔드 aiGenerated 플래그가 있으면 그 값을 따르고,
 * 아직 없으면(undefined) 자동 게시 제목 완전 일치로 판별한다.
 */
export function isAiKeycapPost(post: AiPostSource): boolean {
  return post.aiGenerated ?? post.title === AI_KEYCAP_POST_TITLE;
}
