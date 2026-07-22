import { describe, it, expect } from 'vitest';
import { isAiKeycapPost, AI_KEYCAP_POST_TITLE } from '@/lib/aiPost';

describe('isAiKeycapPost', () => {
  it('aiGenerated=true면 제목과 무관하게 true', () => {
    expect(isAiKeycapPost({ title: '아무 제목', aiGenerated: true })).toBe(true);
  });

  it('aiGenerated=false면 제목이 자동 게시 제목이어도 false (백엔드 플래그 우선)', () => {
    expect(
      isAiKeycapPost({ title: AI_KEYCAP_POST_TITLE, aiGenerated: false })
    ).toBe(false);
  });

  it('aiGenerated가 없으면 제목 "AI 키캡 자랑" 휴리스틱으로 true', () => {
    expect(isAiKeycapPost({ title: 'AI 키캡 자랑' })).toBe(true);
  });

  it('aiGenerated가 없고 제목도 다르면 false', () => {
    expect(isAiKeycapPost({ title: '우리 콩이 자랑' })).toBe(false);
  });

  it('제목 휴리스틱은 완전 일치만 인정한다 (부분 포함은 false)', () => {
    expect(isAiKeycapPost({ title: 'AI 키캡 자랑해요' })).toBe(false);
    expect(isAiKeycapPost({ title: ' AI 키캡 자랑' })).toBe(false);
  });

  it('AI_KEYCAP_POST_TITLE 상수는 백엔드 자동 게시 제목과 일치한다', () => {
    expect(AI_KEYCAP_POST_TITLE).toBe('AI 키캡 자랑');
  });
});
