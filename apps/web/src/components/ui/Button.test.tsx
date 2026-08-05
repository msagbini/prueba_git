import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and defaults to the primary variant', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-gray-900');
  });

  it('applies the secondary variant class', () => {
    render(<Button variant="secondary">Cancel</Button>);

    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border-gray-300');
  });

  it('applies the danger variant class', () => {
    render(<Button variant="danger">Delete</Button>);

    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-red-600');
  });

  it('merges an extra className onto the variant classes', () => {
    render(<Button className="w-full">Wide</Button>);

    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain('w-full');
  });

  it('forwards standard button attributes, including onClick and disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Submit
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
