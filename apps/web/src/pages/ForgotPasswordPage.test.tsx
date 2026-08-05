import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './ForgotPasswordPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a generic "check your email" message after submitting, on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument());
    expect(screen.getByText('user@test.local')).toBeInTheDocument();
  });

  it('shows the same generic message even when the request fails — never reveals if the email exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'error' }, 500)));

    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument());
  });

  it('links back to login', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    renderPage();

    fireEvent.click(screen.getByRole('link', { name: 'Back to sign in' }));

    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
