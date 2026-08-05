import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailPage } from './VerifyEmailPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderPage(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error immediately when there is no token', () => {
    renderPage('/verify-email');

    expect(screen.getByText(/This link is invalid or has expired/)).toBeInTheDocument();
  });

  it('shows verifying, then a success message once the token is confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    renderPage('/verify-email?token=tok123');

    expect(screen.getByText('Verifying your email…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Your email is verified.')).toBeInTheDocument());
  });

  it('shows an error message when the token is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'bad token' }, 400)));

    renderPage('/verify-email?token=bad');

    await waitFor(() =>
      expect(screen.getByText(/This link is invalid or has expired/)).toBeInTheDocument(),
    );
  });
});
