import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import FigurineLoading from '@/components/domain/FigurineLoading';

const T0 = 1_700_000_000_000;

const advanceTo = (sec: number) => {
  act(() => {
    const delta = T0 + sec * 1000 - Date.now();
    if (delta > 0) vi.advanceTimersByTime(delta);
  });
};

describe('FigurineLoading — 스캔 현상 대기 화면', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('현재 단계 카피를 role=status 영역에 담는다', () => {
    render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('사진에서 우리 애를 찾고 있어요');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('경과에 따라 카피가 바뀐다', () => {
    render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    advanceTo(22);
    expect(screen.getByRole('status')).toHaveTextContent('키캡 안에 레진을 붓고 있어요');
  });

  it('60초를 넘기면 지연 카피와 보조 문구로 전환된다', () => {
    render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    advanceTo(61);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('거의 다 왔어요. 조금만 더 기다려 주세요');
    expect(status).toHaveTextContent('사진에 따라 더 걸릴 수 있어요');
  });

  it('preparing이면 경과 시간과 무관하게 업로드 카피를 보여준다', () => {
    // startedAt이 한참 전이어도 업로드 중이면 AI 단계로 넘어가면 안 된다
    render(<FigurineLoading previewUrl="blob:preview" startedAt={T0 - 90_000} preparing />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('사진을 올리고 있어요');
    expect(status).toHaveTextContent('잠시만 기다려 주세요');
    expect(status).not.toHaveTextContent('거의 다 왔어요');
  });

  it('preparing이 풀리면 AI 단계 카피가 0초부터 시작한다', () => {
    const { rerender } = render(
      <FigurineLoading previewUrl="blob:preview" startedAt={T0 - 90_000} preparing />,
    );
    // 업로드 완료 — 호출부가 startedAt을 지금으로 갱신한다
    rerender(<FigurineLoading previewUrl="blob:preview" startedAt={Date.now()} />);
    expect(screen.getByRole('status')).toHaveTextContent('사진에서 우리 애를 찾고 있어요');
  });

  it('preparing 중에도 스캔 스테이지와 진행바는 그대로 보인다', () => {
    const { container } = render(
      <FigurineLoading previewUrl="blob:preview" startedAt={T0} preparing />,
    );
    expect(container.querySelector('[data-testid="figurine-scan-stage"]')).not.toBeNull();
    expect(container.querySelector('.figurine-scan-bar')).not.toBeNull();
  });

  it('애니메이션 스테이지는 장식이므로 aria-hidden이다', () => {
    const { container } = render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    const stage = container.querySelector('[data-testid="figurine-scan-stage"]');
    expect(stage).not.toBeNull();
    expect(stage?.getAttribute('aria-hidden')).toBe('true');
  });

  it('previewUrl이 있으면 원본 사진을 before/after 두 레이어로 쓴다', () => {
    const { container } = render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    imgs.forEach((img) => expect(img.getAttribute('src')).toBe('blob:preview'));
    // after 레이어만 스캔 리빌 애니메이션을 갖는다
    expect(container.querySelectorAll('.figurine-scan-after')).toHaveLength(1);
  });

  it('previewUrl이 없으면 이미지 대신 키캡 플레이스홀더를 그린다', () => {
    const { container } = render(<FigurineLoading previewUrl={null} startedAt={T0} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('스캔 빔과 무한 진행바가 존재한다', () => {
    const { container } = render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    expect(container.querySelector('.figurine-scan-beam')).not.toBeNull();
    expect(container.querySelector('.figurine-scan-bar')).not.toBeNull();
  });

  it('퍼센트를 화면에 표시하지 않는다 (서버가 진행률을 주지 않음)', () => {
    const { container } = render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    advanceTo(45);
    expect(container.textContent).not.toContain('%');
  });

  it('이탈 시 진행 상황을 볼 수 없다는 안내를 유지한다', () => {
    render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    expect(screen.getByText(/이 화면을 벗어나면 진행 상황을 볼 수 없어요/)).toBeInTheDocument();
  });

  it('amber 계열 포인트 컬러를 쓴다 (앱 전역 액센트와 일관)', () => {
    const { container } = render(<FigurineLoading previewUrl="blob:preview" startedAt={T0} />);
    expect(container.innerHTML).toContain('amber-');
  });
});
