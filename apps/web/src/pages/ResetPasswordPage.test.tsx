import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderPage(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/forgot-password" element={<p>forgot password page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an invalid-link message when there is no token', () => {
    renderPage('/reset-password');

    expect(screen.getByText('Invalid link')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'forgot password' }));
    expect(screen.getByText('forgot password page')).toBeInTheDocument();
  });

  it('submits the new password and shows a success screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    renderPage('/reset-password?token=tok123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newSecret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => expect(screen.getByText('Password updated')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('shows an expired-link error on a 400 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Invalid token' }, 400)),
    );

    renderPage('/reset-password?token=expired');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newSecret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(
        screen.getByText('This link is invalid or has expired — request a new one.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows a generic error on an unexpected failure status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'oops' }, 500)));

    renderPage('/reset-password?token=tok123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newSecret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(screen.getByText('Could not reset your password. Try again.')).toBeInTheDocument(),
    );
  });
});
