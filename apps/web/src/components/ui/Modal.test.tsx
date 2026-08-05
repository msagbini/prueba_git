import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders the title and children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit client">
        <p>form fields</p>
      </Modal>,
    );

    expect(screen.getByRole('heading', { name: 'Edit client' })).toBeInTheDocument();
    expect(screen.getByText('form fields')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit client">
        <p>form fields</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the dialog fires a native close/cancel event', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit client">
        <p>form fields</p>
      </Modal>,
    );

    const dialog = screen.getByRole('heading', { name: 'Edit client' }).closest('dialog');
    expect(dialog).not.toBeNull();
    fireEvent(dialog as HTMLDialogElement, new Event('cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
