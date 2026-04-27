import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '@/components/common/Pagination';

describe('Pagination', () => {
  it('totalPages가 1 이하면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('totalPages가 5면 1~5만 표시한다', () => {
    render(<Pagination currentPage={1} totalPages={5} onChange={() => {}} />);
    [1, 2, 3, 4, 5].forEach((p) => {
      expect(screen.getByLabelText(`${p} 페이지로 이동`)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('이전 페이지 그룹')).toBeNull();
    expect(screen.queryByLabelText('다음 페이지 그룹')).toBeNull();
  });

  it('totalPages 25에서 1페이지면 1~10 표시 + 다음 그룹 버튼', () => {
    render(<Pagination currentPage={1} totalPages={25} onChange={() => {}} />);
    expect(screen.getByLabelText('10 페이지로 이동')).toBeInTheDocument();
    expect(screen.queryByLabelText('11 페이지로 이동')).toBeNull();
    expect(screen.getByLabelText('다음 페이지 그룹')).toBeInTheDocument();
    expect(screen.queryByLabelText('이전 페이지 그룹')).toBeNull();
  });

  it('totalPages 25에서 11페이지면 11~20 표시 + 양쪽 그룹 버튼', () => {
    render(<Pagination currentPage={11} totalPages={25} onChange={() => {}} />);
    expect(screen.getByLabelText('11 페이지로 이동')).toBeInTheDocument();
    expect(screen.getByLabelText('20 페이지로 이동')).toBeInTheDocument();
    expect(screen.queryByLabelText('10 페이지로 이동')).toBeNull();
    expect(screen.getByLabelText('이전 페이지 그룹')).toBeInTheDocument();
    expect(screen.getByLabelText('다음 페이지 그룹')).toBeInTheDocument();
  });

  it('totalPages 25에서 21페이지면 21~25 표시 + 이전 그룹만', () => {
    render(<Pagination currentPage={21} totalPages={25} onChange={() => {}} />);
    expect(screen.getByLabelText('21 페이지로 이동')).toBeInTheDocument();
    expect(screen.getByLabelText('25 페이지로 이동')).toBeInTheDocument();
    expect(screen.queryByLabelText('26 페이지로 이동')).toBeNull();
    expect(screen.getByLabelText('이전 페이지 그룹')).toBeInTheDocument();
    expect(screen.queryByLabelText('다음 페이지 그룹')).toBeNull();
  });

  it('페이지 버튼 클릭 시 onChange가 호출된다', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={10} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('5 페이지로 이동'));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('다음 그룹 버튼 클릭 시 다음 그룹 첫 페이지로 이동', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={5} totalPages={25} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('다음 페이지 그룹'));
    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('이전 그룹 버튼 클릭 시 이전 그룹 마지막 페이지로 이동', () => {
    const onChange = vi.fn();
    render(<Pagination currentPage={15} totalPages={25} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('이전 페이지 그룹'));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('현재 페이지에 aria-current="page" 표시', () => {
    render(<Pagination currentPage={3} totalPages={10} onChange={() => {}} />);
    expect(screen.getByLabelText('3 페이지로 이동')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('4 페이지로 이동')).not.toHaveAttribute('aria-current');
  });
});
