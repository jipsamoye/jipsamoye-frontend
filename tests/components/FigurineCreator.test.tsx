import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { FigurineJob, User } from '@/types/api';
import type { FigurinePhase } from '@/hooks/useFigurineJob';

const { hookState, routerMock, authMock, uploadMock, toastMock, preloadMock, loginModalMock } = vi.hoisted(() => ({
  hookState: {
    job: null as FigurineJob | null,
    phase: 'idle' as FigurinePhase,
    errorMessage: null as string | null,
    start: vi.fn(),
    publish: vi.fn(),
    reset: vi.fn(),
  },
  routerMock: { push: vi.fn() },
  authMock: { user: null as User | null, loading: false },
  uploadMock: { uploadPostImage: vi.fn() },
  toastMock: { showToast: vi.fn() },
  preloadMock: { preloadImage: vi.fn() },
  loginModalMock: { openLoginModal: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuthContext: () => authMock }));
vi.mock('@/hooks/useFigurineJob', () => ({ useFigurineJob: () => hookState }));
vi.mock('@/lib/uploadImage', () => uploadMock);
vi.mock('@/components/common/Toast', () => ({ showToast: toastMock.showToast }));
vi.mock('@/lib/preloadImage', () => ({ preloadImage: preloadMock.preloadImage }));
vi.mock('@/lib/loginModal', () => ({ openLoginModal: loginModalMock.openLoginModal }));

import FigurineCreator from '@/components/domain/FigurineCreator';

const sampleUser = { nickname: '집사' } as unknown as User;

const completedJob = (overrides: Partial<FigurineJob> = {}): FigurineJob => ({
  jobId: 1,
  status: 'COMPLETED',
  resultImageUrl: 'https://cdn/results/1.png',
  failReason: null,
  petPostId: null,
  ...overrides,
});

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('파일 입력을 찾지 못했습니다');
  fireEvent.change(input, { target: { files: [file] } });
}

describe('FigurineCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.job = null;
    hookState.phase = 'idle';
    hookState.errorMessage = null;
    authMock.user = sampleUser;
    preloadMock.preloadImage.mockResolvedValue(undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true, configurable: true, value: vi.fn(() => 'blob:preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true, configurable: true, value: vi.fn(),
    });
  });

  it('idle: 파일 미선택 시 생성 버튼이 비활성화된다', () => {
    render(<FigurineCreator />);
    expect(screen.getByText('키캡 피규어 만들기')).toBeDisabled();
  });

  it('유효한 파일 선택 시 미리보기가 뜨고 생성 버튼이 활성화된다', () => {
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    expect(screen.getByAltText('선택한 사진 미리보기')).toBeInTheDocument();
    expect(screen.getByText('키캡 피규어 만들기')).toBeEnabled();
  });

  it('미리보기 이미지는 잘리지 않고 전체가 선택 영역 안에 들어간다', () => {
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    const preview = screen.getByAltText('선택한 사진 미리보기');
    expect(preview.className).toContain('object-contain');
    // object-cover 는 정사각형 칸과 비율이 다른 사진의 위아래/좌우를 잘라낸다
    expect(preview.className).not.toContain('object-cover');
  });

  it('파일 입력은 clip 으로 완전히 숨긴다 (opacity 로 남기지 않는다)', () => {
    // iOS Safari 는 opacity:0 인 파일 입력 자리에 하이라이트를 그려, 시트 뒤로
    // 동그란 잔상이 비쳤다. sr-only(clip:rect(0,0,0,0))는 페인트 자체를 없앤다.
    const { container } = render(<FigurineCreator />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input!.className).toContain('sr-only');
    expect(input!.className).not.toContain('opacity-0');
    expect(input!.className).not.toMatch(/(^|\s)fixed(\s|$)/);
  });

  it('파일 선택 트리거는 영역 전체가 아니라 중앙 버튼이다', () => {
    // iOS 는 시트를 "탭한 좌표"에 띄운다. 앵커를 CSS 로 지정할 수 없으므로
    // 탭 지점 자체를 중앙 한 곳으로 좁혀야 시트 위치가 고정된다.
    const { container } = render(<FigurineCreator />);
    const label = container.querySelector('label');
    const input = container.querySelector('input[type="file"]');
    const dropzone = container.querySelector('.aspect-square');

    expect(label).not.toBeNull();
    expect(label!.contains(input!)).toBe(true);
    // 드롭존은 라벨이 아니다 — 라벨이 영역을 덮으면 탭 지점이 다시 흩어진다
    expect(dropzone).not.toBeNull();
    expect(dropzone!.tagName).not.toBe('LABEL');
    expect(label!.className).not.toContain('aspect-square');
    expect(label!.className).not.toContain('w-full');
    // 버튼은 드롭존 안에 있다
    expect(dropzone!.contains(label!)).toBe(true);
  });

  it('사진 선택 전후로 버튼 문구가 바뀐다', () => {
    const { container } = render(<FigurineCreator />);
    expect(screen.getByText('사진 선택')).toBeInTheDocument();

    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));
    expect(screen.getByText('다른 사진 선택')).toBeInTheDocument();
  });

  it('허용되지 않은 확장자는 토스트 안내 후 무시한다', () => {
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.gif', { type: 'image/gif' }));

    expect(toastMock.showToast).toHaveBeenCalledWith('jpg, jpeg, png, webp 이미지만 올릴 수 있어요');
    expect(screen.queryByAltText('선택한 사진 미리보기')).not.toBeInTheDocument();
    expect(screen.getByText('키캡 피규어 만들기')).toBeDisabled();
  });

  it('10MB 초과 파일은 토스트 안내 후 무시한다', () => {
    const { container } = render(<FigurineCreator />);
    const bigFile = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    selectFile(container, bigFile);

    expect(toastMock.showToast).toHaveBeenCalledWith('10MB 이하 이미지만 올릴 수 있어요');
    expect(screen.queryByAltText('선택한 사진 미리보기')).not.toBeInTheDocument();
    expect(screen.getByText('키캡 피규어 만들기')).toBeDisabled();
  });

  it('생성 클릭: 업로드 후 반환된 URL로 start를 호출한다', async () => {
    uploadMock.uploadPostImage.mockResolvedValueOnce('https://cdn/posts/1/a.webp');
    const { container } = render(<FigurineCreator />);
    const file = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
    selectFile(container, file);

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      expect(uploadMock.uploadPostImage).toHaveBeenCalledWith(file);
      expect(hookState.start).toHaveBeenCalledWith('https://cdn/posts/1/a.webp');
    });
  });

  it('생성 클릭 즉시 대기 화면으로 전환된다 (업로드가 끝나기를 기다리지 않음)', async () => {
    // 업로드를 붙잡아 둔다 — 이 구간에서 화면이 안 바뀌면 "누르고 멍한" 체감이 된다
    let finishUpload!: (url: string) => void;
    uploadMock.uploadPostImage.mockImplementationOnce(
      () => new Promise<string>((resolve) => { finishUpload = resolve; }),
    );
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    // 업로드가 아직 진행 중인데도 대기 화면이 떠 있어야 한다
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('사진을 올리고 있어요');
    });
    expect(container.querySelector('[data-testid="figurine-scan-stage"]')).not.toBeNull();
    // 업로드 화면은 사라진다
    expect(screen.queryByText('키캡 피규어 만들기')).not.toBeInTheDocument();

    finishUpload('https://cdn/posts/1/a.webp');
    await waitFor(() => expect(hookState.start).toHaveBeenCalled());
  });

  it('업로드 중에는 AI 단계 카피가 아니라 업로드 카피를 보여준다', async () => {
    uploadMock.uploadPostImage.mockImplementationOnce(() => new Promise<string>(() => {}));
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('사진을 올리고 있어요');
      expect(status).not.toHaveTextContent('사진에서 우리 애를 찾고 있어요');
      expect(status).not.toHaveTextContent('키캡 안에 레진을 붓고 있어요');
    });
  });

  it('업로드 실패 시 대기 화면을 걷고 업로드 화면으로 돌아간다', async () => {
    uploadMock.uploadPostImage.mockRejectedValueOnce(new Error('S3 업로드 실패 (500)'));
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      expect(screen.getByText('키캡 피규어 만들기')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="figurine-scan-stage"]')).toBeNull();
  });

  it('업로드 실패 시 토스트 안내 (start 미호출)', async () => {
    uploadMock.uploadPostImage.mockRejectedValueOnce(new Error('S3 업로드 실패 (500)'));
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    await waitFor(() => {
      expect(toastMock.showToast).toHaveBeenCalledWith('사진 업로드에 실패했어요. 다시 시도해 주세요.');
    });
    expect(hookState.start).not.toHaveBeenCalled();
  });

  it('generating: 스캔 현상 대기 화면(FigurineLoading)을 렌더한다', () => {
    hookState.phase = 'generating';
    const { container } = render(<FigurineCreator />);
    expect(screen.getByRole('status')).toHaveTextContent('사진에서 우리 애를 찾고 있어요');
    expect(container.querySelector('[data-testid="figurine-scan-stage"]')).not.toBeNull();
    expect(screen.getByText(/이 화면을 벗어나면 진행 상황을 볼 수 없어요/)).toBeInTheDocument();
  });

  it('completed: 프리로드 완료 후 결과 이미지 + 게시/다시 만들기 버튼을 렌더한다', async () => {
    hookState.phase = 'completed';
    hookState.job = completedJob();
    render(<FigurineCreator />);

    expect(await screen.findByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
    expect(preloadMock.preloadImage).toHaveBeenCalledWith('https://cdn/results/1.png');
    expect(screen.getByText('자랑 피드에 게시하기')).toBeEnabled();
    expect(screen.getByText('다른 사진으로 다시 만들기')).toBeEnabled();
  });

  it('completed 직후 프리로드가 끝나기 전엔 로딩 화면을 유지한다', () => {
    preloadMock.preloadImage.mockImplementationOnce(() => new Promise<void>(() => {}));
    hookState.phase = 'completed';
    hookState.job = completedJob();
    render(<FigurineCreator />);

    expect(screen.getByRole('status')).toHaveTextContent('사진에서 우리 애를 찾고 있어요');
    expect(screen.queryByAltText('완성된 AI 키캡 피규어')).not.toBeInTheDocument();
  });

  it('프리로드 완료 시 결과 화면으로 전환된다', async () => {
    let resolvePreload!: () => void;
    preloadMock.preloadImage.mockImplementationOnce(
      () => new Promise<void>((r) => { resolvePreload = r; })
    );
    hookState.phase = 'completed';
    hookState.job = completedJob();
    render(<FigurineCreator />);
    expect(screen.queryByAltText('완성된 AI 키캡 피규어')).not.toBeInTheDocument();

    resolvePreload();
    expect(await screen.findByAltText('완성된 AI 키캡 피규어')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('게시 클릭: publish 성공 시 게시글로 이동한다', async () => {
    hookState.phase = 'completed';
    hookState.job = completedJob();
    hookState.publish.mockResolvedValueOnce(77);
    render(<FigurineCreator />);

    fireEvent.click(await screen.findByText('자랑 피드에 게시하기'));

    await waitFor(() => {
      expect(hookState.publish).toHaveBeenCalled();
      expect(routerMock.push).toHaveBeenCalledWith('/posts/77');
    });
  });

  it('posting: 게시 버튼이 "게시 중…"으로 비활성화된다', () => {
    hookState.phase = 'posting';
    hookState.job = completedJob();
    render(<FigurineCreator />);

    expect(screen.getByText('게시 중…')).toBeDisabled();
  });

  it('failed: errorMessage와 다시 시도 버튼을 렌더하고, 클릭 시 reset을 호출한다', () => {
    hookState.phase = 'failed';
    hookState.errorMessage = '이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.';
    render(<FigurineCreator />);

    expect(screen.getByText('이미지 생성에 실패했어요. 다른 사진으로 다시 시도해 주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('다른 사진으로 다시 시도'));
    expect(hookState.reset).toHaveBeenCalled();
  });

  it('비로그인 상태에서 생성 클릭 시 로그인 모달을 띄운다 (업로드 미시도)', () => {
    authMock.user = null;
    const { container } = render(<FigurineCreator />);
    selectFile(container, new File(['x'], 'cat.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByText('키캡 피규어 만들기'));

    expect(loginModalMock.openLoginModal).toHaveBeenCalledTimes(1);
    expect(uploadMock.uploadPostImage).not.toHaveBeenCalled();
  });

  it('비로그인 상태에서 사진 선택 클릭 시 파일 선택창 대신 로그인 모달을 띄운다', () => {
    authMock.user = null;
    render(<FigurineCreator />);

    // fireEvent는 preventDefault가 호출되면 false를 반환한다 — 파일 선택창 차단 확인
    const defaultNotPrevented = fireEvent.click(screen.getByText('사진 선택'));

    expect(defaultNotPrevented).toBe(false);
    expect(loginModalMock.openLoginModal).toHaveBeenCalledTimes(1);
  });

  it('로그인 상태에서 사진 선택 클릭 시 로그인 모달을 띄우지 않는다', () => {
    authMock.user = sampleUser;
    render(<FigurineCreator />);

    const defaultNotPrevented = fireEvent.click(screen.getByText('사진 선택'));

    expect(defaultNotPrevented).toBe(true);
    expect(loginModalMock.openLoginModal).not.toHaveBeenCalled();
  });
});
