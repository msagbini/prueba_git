import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthCard } from './AuthCard';

describe('AuthCard', () => {
  it('renders the title and body content', () => {
    render(
      <AuthCard title="Sign in to DOS">
        <p>form goes here</p>
      </AuthCard>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in to DOS' })).toBeInTheDocument();
    expect(screen.getByText('form goes here')).toBeInTheDocument();
  });
});
