import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field, SelectField, TextareaField } from './Field';

describe('Field', () => {
  it('associates the label with the input via a generated id', () => {
    render(<Field label="Email" />);

    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('uses an explicit id when given instead of generating one', () => {
    render(<Field label="Email" id="email-field" />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email-field');
  });

  it('renders and links an error message via aria-describedby', () => {
    render(<Field label="Email" error="Invalid email" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('Invalid email')).toHaveAttribute('id', describedBy);
  });

  it('omits aria-invalid/aria-describedby when there is no error', () => {
    render(<Field label="Email" />);

    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('forwards standard input props', () => {
    const onChange = vi.fn();
    render(<Field label="Email" value="a@b.com" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c@d.com' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('SelectField', () => {
  it('renders the label and options, and reports the selected value', () => {
    const onChange = vi.fn();
    render(
      <SelectField label="Status" value="ACTIVE" onChange={onChange}>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </SelectField>,
    );

    const select = screen.getByLabelText('Status');
    expect(select).toHaveValue('ACTIVE');
    fireEvent.change(select, { target: { value: 'INACTIVE' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders an error message', () => {
    render(
      <SelectField label="Status" error="Required" onChange={vi.fn()}>
        <option value="">-</option>
      </SelectField>,
    );

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('TextareaField', () => {
  it('associates the label with the textarea', () => {
    render(<TextareaField label="Notes" />);

    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('renders an error message', () => {
    render(<TextareaField label="Notes" error="Too long" />);

    expect(screen.getByText('Too long')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-invalid', 'true');
  });
});
