export const storage = {
  getUserId: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem('userId') : null,
  setUserId: (id: string): void => localStorage.setItem('userId', id),
  clearUserId: (): void => localStorage.removeItem('userId'),
  getOpenChatNickname: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem('openChatNickname') : null,
  setOpenChatNickname: (name: string): void =>
    localStorage.setItem('openChatNickname', name),
};
