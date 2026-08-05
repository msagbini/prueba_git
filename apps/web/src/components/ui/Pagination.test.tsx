import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('shows the total count and current/total page', () => {
    render(<Pagination page={2} totalPages={5} total={47} onPageChange={vi.fn()} />);

    expect(screen.getByText('47 total')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('disables Prev on the first page and Next on the last page', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={3} total={30} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();

    rerender(<Pagination page={3} totalPages={3} total={30} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPageChange with the adjacent page when Prev/Next are clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} total={47} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('handles the single-page case (both buttons disabled)', () => {
    render(<Pagination page={1} totalPages={1} total={3} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
