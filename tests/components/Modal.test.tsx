import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/components/common/Modal';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
  });

  it('isOpen=false 이면 아무것도 렌더되지 않는다', () => {
    render(
      <Modal isOpen={false} onClose={onClose}>
        <p>내용</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('isOpen=true 이면 role="dialog" 와 aria-modal="true" 가 존재한다', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <p>내용</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('title 전달 시 aria-labelledby 가 h2 id 와 연결된다', () => {
    render(
      <Modal isOpen onClose={onClose} title="테스트 모달">
        <p>내용</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { name: '테스트 모달' });
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(heading.id).toBe(labelledBy);
  });

  it('title 없이 ariaLabel 전달 시 aria-label 이 적용된다', () => {
    render(
      <Modal isOpen onClose={onClose} ariaLabel="로그인 모달">
        <p>내용</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', '로그인 모달');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  it('title 과 ariaLabel 모두 없으면 aria-labelledby / aria-label 없음', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <p>내용</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-label');
  });

  it('ESC 키 누르면 onClose 가 호출된다', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <p>내용</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('오버레이 클릭 시 onClose 가 호출된다', () => {
    const { container } = render(
      <Modal isOpen onClose={onClose}>
        <p>내용</p>
      </Modal>
    );
    // aria-hidden="true" 인 오버레이 div 직접 쿼리
    const overlay = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('title 있을 때 닫기 버튼에 aria-label="닫기" 가 있다', () => {
    render(
      <Modal isOpen onClose={onClose} title="모달 제목">
        <p>내용</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    expect(closeBtn).toBeInTheDocument();
  });

  it('닫기 X 버튼 클릭 시 onClose 가 호출된다', () => {
    render(
      <Modal isOpen onClose={onClose} title="모달 제목">
        <p>내용</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab 포커스 트랩: 마지막 focusable 에서 Tab 시 첫 요소로 wrap', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <button data-testid="btn1">첫째</button>
        <button data-testid="btn2">둘째</button>
        <button data-testid="btn3">셋째</button>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const buttons = screen.getAllByRole('button');
    const lastBtn = buttons[buttons.length - 1];

    // 마지막 버튼에 포커스를 준 상태에서 Tab 이벤트
    lastBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Shift+Tab 포커스 트랩: 첫 focusable 에서 Shift+Tab 시 마지막 요소로 wrap', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <button data-testid="btn1">첫째</button>
        <button data-testid="btn2">둘째</button>
        <button data-testid="btn3">셋째</button>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const buttons = screen.getAllByRole('button');
    const firstBtn = buttons[0];
    const lastBtn = buttons[buttons.length - 1];

    firstBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastBtn);
  });

  it('focusable 요소가 없으면 패널 자체(tabIndex=-1)가 포커스 대상임을 확인', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <p>텍스트만</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('모달 open 시 패널 내 첫 번째 focusable 요소로 포커스가 이동한다', () => {
    render(
      <Modal isOpen onClose={onClose}>
        <button data-testid="first-btn">첫째</button>
        <button data-testid="second-btn">둘째</button>
      </Modal>
    );
    const firstBtn = screen.getByTestId('first-btn');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('모달 close 시 트리거 버튼으로 포커스가 복원된다', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '모달 열기';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <Modal isOpen onClose={onClose}>
        <button>모달 내부 버튼</button>
      </Modal>
    );

    // 모달이 열리면 트리거에서 포커스가 이동됨
    expect(document.activeElement).not.toBe(trigger);

    // 모달을 닫으면 (isOpen=false → 언마운트) cleanup 실행 → 트리거로 복원
    rerender(
      <Modal isOpen={false} onClose={onClose}>
        <button>모달 내부 버튼</button>
      </Modal>
    );

    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});
